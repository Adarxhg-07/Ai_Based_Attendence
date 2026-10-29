"""
Encoding store - manages stored face encodings.
Uses a local JSON + numpy file approach for MVP.
Includes per-student stats, centroid computation, and outlier removal.
"""

import os
import json
import logging
import threading
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENCODINGS_DIR = os.path.join(BASE_DIR, "encodings")

# ─── In-memory cache ─────────────────────────────────────────────────
# Loading ~113 students × ~40 encodings per recognition request hits disk
# 113+ times. We cache the parsed dict per student and invalidate based on
# the mtime of the student's directory (any save/delete bumps the mtime).
# Thread-safe via a single lock for the cache map itself; numpy arrays are
# treated as immutable after being placed in the cache.
_cache_lock = threading.Lock()
_student_cache: Dict[str, Dict] = {}         # student_id -> cached payload
_student_cache_mtime: Dict[str, float] = {}  # student_id -> dir mtime when cached


class EncodingStore:
    """
    Manages face encodings storage.
    Each student has a directory with:
      - metadata.json  (studentId, name, registrationNumber)
      - encodings.npy  (numpy array of ArcFace embeddings)
      - centroid.npy   (L2-normalised mean of clean encodings)
      - stats.json     (intra-class distance stats for adaptive thresholds)
    """

    def __init__(self):
        os.makedirs(ENCODINGS_DIR, exist_ok=True)

    def save_encodings(
        self,
        student_id: str,
        encodings: List[np.ndarray],
        metadata: Optional[Dict] = None,
    ):
        """Save encodings for a student."""
        student_dir = os.path.join(ENCODINGS_DIR, student_id)
        os.makedirs(student_dir, exist_ok=True)

        enc_path = os.path.join(student_dir, "encodings.npy")
        if os.path.exists(enc_path):
            existing = np.load(enc_path)
            all_encodings = np.vstack([existing, np.array(encodings)])
        else:
            all_encodings = np.array(encodings)

        np.save(enc_path, all_encodings)

        # Auto-generate projected encodings & centroid if projection head is loaded
        try:
            from app.services.projection_head import projection_head
            if projection_head.is_loaded and all_encodings.shape[-1] == 512:
                proj = projection_head.project_batch(all_encodings)
                proj_path = os.path.join(student_dir, "projected_encodings.npy")
                np.save(proj_path, proj)

                centroid = np.mean(proj, axis=0)
                c_norm = np.linalg.norm(centroid)
                if c_norm > 0:
                    centroid = centroid / c_norm
                np.save(os.path.join(student_dir, "projected_centroid.npy"), centroid)
        except Exception as e:
            logger.warning(f"Could not auto-project encodings for student {student_id}: {e}")

        if metadata:
            meta_path = os.path.join(student_dir, "metadata.json")
            with open(meta_path, "w") as f:
                json.dump(metadata, f)

        # The saved file bumps the student directory mtime, which our
        # mtime-based cache check will pick up automatically. We still
        # eagerly invalidate to avoid reading a stale entry in the next
        # ~1ms window before the filesystem timestamp settles.
        self.invalidate_cache(student_id)

        logger.info(
            f"Saved {len(encodings)} encodings for student {student_id} "
            f"(total: {len(all_encodings)})"
        )

    def _load_student_from_disk(self, student_id: str) -> Optional[Dict]:
        student_dir = os.path.join(ENCODINGS_DIR, student_id)
        enc_path = os.path.join(student_dir, "encodings.npy")
        if not os.path.exists(enc_path):
            return None

        encodings = np.load(enc_path)
        metadata = {}
        meta_path = os.path.join(student_dir, "metadata.json")
        if os.path.exists(meta_path):
            with open(meta_path, "r") as f:
                metadata = json.load(f)

        centroid = None
        centroid_path = os.path.join(student_dir, "centroid.npy")
        if os.path.exists(centroid_path):
            centroid = np.load(centroid_path)

        projected_np = None
        proj_path = os.path.join(student_dir, "projected_encodings.npy")
        if os.path.exists(proj_path):
            projected_np = np.load(proj_path)
        else:
            # Auto-project on load if projection head is loaded and raw encodings are 512-d
            try:
                from app.services.projection_head import projection_head
                if projection_head.is_loaded and encodings is not None and len(encodings) > 0 and encodings.shape[-1] == 512:
                    projected_np = projection_head.project_batch(encodings)
                    np.save(proj_path, projected_np)
            except Exception as e:
                logger.warning(f"Could not auto-project encodings on load for {student_id}: {e}")

        projected_centroid = None
        proj_centroid_path = os.path.join(student_dir, "projected_centroid.npy")
        if os.path.exists(proj_centroid_path):
            projected_centroid = np.load(proj_centroid_path)
        elif projected_np is not None and len(projected_np) > 0:
            centroid_calc = np.mean(projected_np, axis=0)
            c_norm = np.linalg.norm(centroid_calc)
            if c_norm > 0:
                projected_centroid = centroid_calc / c_norm
            try:
                np.save(proj_centroid_path, projected_centroid)
            except Exception:
                pass

        return {
            "encodings": encodings.tolist() if isinstance(encodings, np.ndarray) else encodings,
            "encodings_np": encodings,
            "centroid": centroid,
            "projected_np": projected_np,
            "projected_centroid": projected_centroid,
            **metadata,
        }

    def get_encodings(self, student_id: str) -> Optional[Dict]:
        """Get encodings and metadata for a student (cached, mtime-invalidated)."""
        student_dir = os.path.join(ENCODINGS_DIR, student_id)
        if not os.path.isdir(student_dir):
            return None
        try:
            disk_mtime = os.path.getmtime(student_dir)
        except OSError:
            disk_mtime = 0.0

        with _cache_lock:
            cached = _student_cache.get(student_id)
            cached_mtime = _student_cache_mtime.get(student_id, -1.0)
            if cached is not None and cached_mtime == disk_mtime:
                return cached

        # Cache miss — load from disk outside the lock to avoid blocking other readers
        data = self._load_student_from_disk(student_id)
        if data is None:
            return None

        with _cache_lock:
            _student_cache[student_id] = data
            _student_cache_mtime[student_id] = disk_mtime
        return data

    def invalidate_cache(self, student_id: Optional[str] = None):
        """Drop cached encodings for a student (or all if student_id is None)."""
        with _cache_lock:
            if student_id is None:
                _student_cache.clear()
                _student_cache_mtime.clear()
            else:
                _student_cache.pop(student_id, None)
                _student_cache_mtime.pop(student_id, None)

    def get_encodings_for_students(self, student_ids: List[str]) -> Dict[str, Dict]:
        """Get encodings for multiple students (only those who have them).

        Returns projected 128-d encodings for L2 matching when available,
        plus raw 512-d encodings for SVM classification.
        """
        try:
            from app.services.projection_head import projection_head
            use_proj = projection_head.is_loaded
        except Exception:
            use_proj = False

        result = {}
        for sid in student_ids:
            data = self.get_encodings(sid)
            if data:
                raw = data.get("encodings_np")
                proj = data.get("projected_np")

                # Guarantee dimensionality matches active projection head
                if use_proj and proj is not None and proj.shape[-1] == 128:
                    chosen = proj
                    is_p = True
                elif not use_proj and raw is not None and raw.shape[-1] == 512:
                    chosen = raw
                    is_p = False
                elif proj is not None:
                    chosen = proj
                    is_p = True
                else:
                    chosen = raw
                    is_p = False

                result[sid] = {
                    "encodings": chosen,
                    "raw_encodings": raw,
                    "projected_encodings": proj,
                    "centroid": data.get("centroid"),
                    "projected_centroid": data.get("projected_centroid"),
                    "registrationNumber": data.get("registrationNumber", ""),
                    "name": data.get("name", ""),
                    "is_projected": is_p,
                }
        return result

    def delete_encodings(self, student_id: str) -> bool:
        """Delete all encodings for a student."""
        import shutil

        student_dir = os.path.join(ENCODINGS_DIR, student_id)
        if os.path.exists(student_dir):
            shutil.rmtree(student_dir)
            self.invalidate_cache(student_id)
            logger.info(f"Deleted encodings for student {student_id}")
            return True
        return False

    def get_all_student_ids(self) -> List[str]:
        """List all students that have stored encodings."""
        if not os.path.exists(ENCODINGS_DIR):
            return []
        return [
            d
            for d in os.listdir(ENCODINGS_DIR)
            if os.path.isdir(os.path.join(ENCODINGS_DIR, d))
        ]

    def compute_centroid(self, student_id: str) -> Optional[np.ndarray]:
        """
        Compute and save L2-normalised centroid of a student's encodings.
        The centroid is the "average face" — matching against it is fast and robust.
        """
        data = self.get_encodings(student_id)
        if not data or data["encodings_np"] is None or len(data["encodings_np"]) < 1:
            return None

        encodings = data["encodings_np"]
        # L2-normalize each encoding
        norms = np.linalg.norm(encodings, axis=1, keepdims=True)
        norms = np.where(norms > 0, norms, 1)
        normed = encodings / norms

        # Mean → L2-normalize to get unit centroid
        centroid = np.mean(normed, axis=0)
        c_norm = np.linalg.norm(centroid)
        if c_norm > 0:
            centroid = centroid / c_norm

        student_dir = os.path.join(ENCODINGS_DIR, student_id)
        np.save(os.path.join(student_dir, "centroid.npy"), centroid)
        self.invalidate_cache(student_id)

        return centroid

    def remove_outlier_encodings(
        self, student_id: str, max_std_devs: float = 2.5
    ) -> Tuple[int, int]:
        """
        Remove outlier encodings that are too far from the centroid.
        Returns (kept, removed) counts.

        Outliers are encodings whose cosine distance from the centroid exceeds
        mean_dist + max_std_devs * std_dist. These are usually bad augmentations
        or misdetected faces that pollute matching.
        """
        data = self.get_encodings(student_id)
        if not data or data["encodings_np"] is None or len(data["encodings_np"]) < 4:
            return (len(data["encodings_np"]) if data and data["encodings_np"] is not None else 0, 0)

        encodings = data["encodings_np"]
        norms = np.linalg.norm(encodings, axis=1, keepdims=True)
        norms = np.where(norms > 0, norms, 1)
        normed = encodings / norms

        centroid = np.mean(normed, axis=0)
        c_norm = np.linalg.norm(centroid)
        if c_norm > 0:
            centroid = centroid / c_norm

        # Cosine distance from centroid
        distances = 1 - np.dot(normed, centroid)
        mean_d = np.mean(distances)
        std_d = np.std(distances)
        threshold = mean_d + max_std_devs * std_d

        keep_mask = distances <= threshold
        kept = int(np.sum(keep_mask))
        removed = len(encodings) - kept

        if removed > 0 and kept >= 2:
            student_dir = os.path.join(ENCODINGS_DIR, student_id)
            clean_encodings = encodings[keep_mask]
            np.save(os.path.join(student_dir, "encodings.npy"), clean_encodings)
            self.invalidate_cache(student_id)
            logger.info(
                f"Outlier removal for {student_id}: kept {kept}, removed {removed} "
                f"(threshold={threshold:.4f})"
            )
            # Recompute centroid after cleaning
            self.compute_centroid(student_id)

        return (kept, removed)

    def compute_student_stats(self, student_id: str) -> Optional[Dict]:
        """Compute encoding statistics for adaptive thresholding."""
        data = self.get_encodings(student_id)
        if not data or data["encodings_np"] is None or len(data["encodings_np"]) < 2:
            return None

        encodings = data["encodings_np"]
        norms = np.linalg.norm(encodings, axis=1, keepdims=True)
        norms = np.where(norms > 0, norms, 1)
        normed = encodings / norms

        # Pairwise cosine distances
        similarities = np.dot(normed, normed.T)
        distances = 1 - similarities
        upper = distances[np.triu_indices_from(distances, k=1)]

        # Compute centroid and save it
        centroid = self.compute_centroid(student_id)
        centroid_spread = 0.0
        if centroid is not None:
            centroid_dists = 1 - np.dot(normed, centroid)
            centroid_spread = float(np.mean(centroid_dists))

        stats = {
            "mean_intra_dist": float(np.mean(upper)) if len(upper) > 0 else 0,
            "max_intra_dist": float(np.max(upper)) if len(upper) > 0 else 0,
            "std_intra_dist": float(np.std(upper)) if len(upper) > 0 else 0,
            "centroid_spread": centroid_spread,
            "num_encodings": int(len(encodings)),
        }

        student_dir = os.path.join(ENCODINGS_DIR, student_id)
        stats_path = os.path.join(student_dir, "stats.json")
        with open(stats_path, "w") as f:
            json.dump(stats, f)

        return stats

    def get_student_threshold(self, student_id: str, base_threshold: float) -> float:
        """Get adaptive threshold for a student based on encoding spread."""
        student_dir = os.path.join(ENCODINGS_DIR, student_id)
        stats_path = os.path.join(student_dir, "stats.json")

        if not os.path.exists(stats_path):
            return base_threshold

        try:
            with open(stats_path, "r") as f:
                stats = json.load(f)
        except Exception:
            return base_threshold

        intra_max = stats.get("max_intra_dist", 0)
        adaptive = base_threshold + 0.25 * intra_max
        return min(adaptive, base_threshold * 1.35)


encoding_store = EncodingStore()
