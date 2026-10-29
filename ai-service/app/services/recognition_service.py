"""
Face recognition service.

Pipeline:
  1. Detect faces (MTCNN + RetinaFace)
  2. Raw MTCNN crop (no alignment)
  3. FaceNet embedding (512-d, keras_facenet)
  4. Match: min L2 (Euclidean) distance, threshold 1.0
  5. SVM as confirmation bonus
  6. Dedup
"""

import os
import logging
import time
from typing import List, Dict, Optional
from collections import defaultdict

import numpy as np
import cv2

from app.models.face_detector import (
    detect_faces,
    preprocess_face,
    get_embedding,
    get_embeddings_batch,
    draw_annotations,
    assess_face_quality,
    upscale_tiny_face,
)
from app.services.encoding_store import encoding_store
from app.services.classifier import face_classifier
from app.services.model_loader import model_loader
from app.services.projection_head import projection_head

logger = logging.getLogger(__name__)

# L2 distance threshold for projected 128-d embeddings.
# Empirical optimum 1.1 with the original (random-mining) projection head.
# After a future better retrain, re-tune via the suggested-threshold output
# of train_projection_head.py and override with FACENET_THRESHOLD env var.
FACENET_THRESHOLD = float(os.getenv("FACENET_THRESHOLD", "1.1"))


def recognize_faces_in_image(
    image_rgb: np.ndarray,
    enrolled_student_ids: List[str],
    threshold: float = FACENET_THRESHOLD,
    output_dir: Optional[str] = None,
) -> Dict:
    """Process a class image and return recognition results."""
    start_time = time.time()

    faces = detect_faces(image_rgb)

    if not faces:
        return {
            "facesDetected": 0,
            "facesRecognized": 0,
            "recognizedStudents": [],
            "unknownFaces": [],
            "processingTimeMs": int((time.time() - start_time) * 1000),
        }

    student_encodings = encoding_store.get_encodings_for_students(enrolled_student_ids)

    recognized_students = []
    unknown_faces = []
    boxes = []
    names = []
    confidences = []
    skipped_quality = 0
    rec_embeddings = []
    rec_box_indices = []

    # ── Pass 1: preprocess + quality filter, collect crops for batched embedding ──
    preprocessed_crops: List[np.ndarray] = []
    crop_contexts: List[Dict] = []  # parallel to preprocessed_crops
    for face in faces:
        box = face["box"]
        left_eye = face.get("left_eye")
        right_eye = face.get("right_eye")
        try:
            preprocessed, new_box = preprocess_face(image_rgb, box, left_eye, right_eye)
            is_acceptable, quality_info = assess_face_quality(
                preprocessed, left_eye=left_eye, right_eye=right_eye, face_box=box
            )
            if not is_acceptable:
                skipped_quality += 1
                unknown_faces.append({
                    "faceLocation": {
                        "x1": int(new_box[0]), "y1": int(new_box[1]),
                        "x2": int(new_box[2]), "y2": int(new_box[3]),
                    },
                    "confidence": float(face["confidence"]),
                    "qualityIssue": quality_info.get("reason", "unknown"),
                })
                boxes.append(new_box)
                names.append("Unknown")
                confidences.append(0)
                continue
            # Tier 2.7: upscale tiny faces before batching. Gated by env;
            # default on. Only affects crops under 60px on the short side.
            if os.getenv("SR_TINY_FACES", "1") == "1":
                preprocessed = upscale_tiny_face(preprocessed)
            preprocessed_crops.append(preprocessed)
            crop_contexts.append({"box": new_box, "det_conf": face["confidence"]})
        except Exception as e:
            logger.warning(f"Error preprocessing face: {e}")
            unknown_faces.append({
                "faceLocation": {
                    "x1": int(box[0]), "y1": int(box[1]),
                    "x2": int(box[0] + box[2]), "y2": int(box[1] + box[3]),
                },
                "confidence": float(face["confidence"]),
            })
            boxes.append((box[0], box[1], box[0] + box[2], box[1] + box[3]))
            names.append("Unknown")
            confidences.append(0)

    # ── Pass 2: single batched FaceNet call (the big speed win) ──
    # Tier 2.3: test-time augmentation — embed the horizontally flipped crop
    # and average with the original. Default OFF: the current projection
    # head was trained on non-augmented embeddings so averaging shifts the
    # distribution it sees. Enable TTA=1 after retraining with flip-aug
    # included in the triplet miner.
    use_tta = os.getenv("TTA", "0") == "1"
    if preprocessed_crops:
        if use_tta:
            flipped_crops = [np.ascontiguousarray(c[:, ::-1]) for c in preprocessed_crops]
            batch_input = preprocessed_crops + flipped_crops
            raw_all = get_embeddings_batch(batch_input, project=False)
            n = len(preprocessed_crops)
            raw_batch = (raw_all[:n] + raw_all[n:]) * 0.5
            # L2-renormalize the averaged raw embedding
            norms = np.linalg.norm(raw_batch, axis=1, keepdims=True)
            norms = np.where(norms > 0, norms, 1)
            raw_batch = raw_batch / norms
        else:
            raw_batch = get_embeddings_batch(preprocessed_crops, project=False)
        if projection_head.is_loaded:
            projected_batch = projection_head.project_batch(raw_batch)
        else:
            projected_batch = raw_batch
    else:
        raw_batch = np.zeros((0, 512), dtype=np.float32)
        projected_batch = np.zeros((0, 128), dtype=np.float32)

    # ── Pass 3: match each embedding against the student store ──
    for i, ctx in enumerate(crop_contexts):
        new_box = ctx["box"]
        raw_embedding = raw_batch[i]
        projected_embedding = projected_batch[i]
        match = _match_face(
            projected_embedding, raw_embedding,
            student_encodings, threshold, enrolled_student_ids,
        )
        boxes.append(new_box)
        if match:
            recognized_students.append({
                "studentId": match["studentId"],
                "registrationNumber": match.get("registrationNumber", ""),
                "name": match.get("name", ""),
                "confidence": float(match["confidence"]),
                "distance": float(match["distance"]),
                "matchMethod": match.get("matchMethod", "l2"),
                "faceLocation": {
                    "x1": int(new_box[0]), "y1": int(new_box[1]),
                    "x2": int(new_box[2]), "y2": int(new_box[3]),
                },
            })
            names.append(match.get("name", match["studentId"][:8]))
            confidences.append(float(match["confidence"]))
            rec_embeddings.append((projected_embedding, raw_embedding))
            rec_box_indices.append(len(boxes) - 1)
        else:
            unknown_faces.append({
                "faceLocation": {
                    "x1": int(new_box[0]), "y1": int(new_box[1]),
                    "x2": int(new_box[2]), "y2": int(new_box[3]),
                },
                "confidence": float(ctx["det_conf"]),
            })
            names.append("Unknown")
            confidences.append(0)

    # ── Dedup via Hungarian algorithm (optimal assignment, single pass) ──
    # When enabled (default), finds the globally optimal one-to-one mapping
    # between faces and students by total distance. Replaces the prior
    # 10-round greedy reassignment loop.
    use_hungarian = os.getenv("HUNGARIAN_MATCHING", "1") == "1"
    if use_hungarian and len(recognized_students) > 1:
        recognized_students, unknown_extra = _hungarian_dedup(
            recognized_students, rec_embeddings, rec_box_indices,
            student_encodings, threshold, enrolled_student_ids,
            names, confidences,
        )
        unknown_faces.extend(unknown_extra)
    else:
        # Legacy greedy dedup (kept as fallback)
        claimed_students: set = set()
        for _dedup_round in range(10):
            student_faces: Dict[str, list] = defaultdict(list)
            for idx, rec in enumerate(recognized_students):
                if rec is not None:
                    student_faces[rec["studentId"]].append((idx, rec["distance"]))

            has_conflict = False
            for sid, face_list in student_faces.items():
                if len(face_list) <= 1:
                    claimed_students.add(sid)
                    continue
                has_conflict = True
                face_list.sort(key=lambda x: x[1])
                claimed_students.add(sid)
                for idx, _dist in face_list[1:]:
                    proj_emb, raw_emb = rec_embeddings[idx]
                    filtered = {k: v for k, v in student_encodings.items() if k not in claimed_students}
                    new_match = _match_face(proj_emb, raw_emb, filtered, threshold, enrolled_student_ids, is_rematch=True)
                    box_idx = rec_box_indices[idx]
                    if new_match:
                        recognized_students[idx] = {
                            "studentId": new_match["studentId"],
                            "registrationNumber": new_match.get("registrationNumber", ""),
                            "name": new_match.get("name", ""),
                            "confidence": float(new_match["confidence"]),
                            "distance": float(new_match["distance"]),
                            "matchMethod": new_match.get("matchMethod", "l2") + "_rematch",
                            "faceLocation": recognized_students[idx]["faceLocation"],
                        }
                        names[box_idx] = new_match.get("name", new_match["studentId"][:8])
                        confidences[box_idx] = float(new_match["confidence"])
                    else:
                        unknown_faces.append({
                            "faceLocation": recognized_students[idx]["faceLocation"],
                            "confidence": recognized_students[idx]["confidence"],
                        })
                        names[box_idx] = "Unknown"
                        confidences[box_idx] = 0
                        recognized_students[idx] = None
            if not has_conflict:
                break

    recognized_students = [r for r in recognized_students if r is not None]

    # Save annotated image
    annotated_path = None
    if output_dir and boxes:
        annotated = draw_annotations(image_rgb, boxes, names, confidences)
        annotated_bgr = cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR)
        os.makedirs(output_dir, exist_ok=True)
        annotated_path = os.path.join(output_dir, "annotated.jpg")
        cv2.imwrite(annotated_path, annotated_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])

    processing_time = int((time.time() - start_time) * 1000)

    total_faces = len(faces)
    total_recognized = len(recognized_students)
    total_unknown = len(unknown_faces)
    recognition_rate = (total_recognized / total_faces * 100) if total_faces > 0 else 0

    logger.info("=" * 60)
    logger.info("  RECOGNITION RESULTS")
    logger.info("=" * 60)
    logger.info(f"  Threshold:          {threshold}")
    logger.info(f"  Enrolled students:  {len(enrolled_student_ids)}")
    logger.info(f"  Students w/ encod:  {len(student_encodings)}")
    logger.info(f"  Faces detected:     {total_faces}")
    logger.info(f"  Faces recognized:   {total_recognized}")
    logger.info(f"  Unknown faces:      {total_unknown}")
    logger.info(f"  Skipped (quality):  {skipped_quality}")
    logger.info(f"  Recognition rate:   {recognition_rate:.1f}%")
    logger.info("-" * 60)

    dists = []
    confs = []
    if recognized_students:
        dists = [s["distance"] for s in recognized_students]
        confs = [s["confidence"] for s in recognized_students]
        for s in recognized_students:
            logger.info(
                f"    {s['name']:25s}  dist={s['distance']:.4f}  "
                f"conf={s['confidence']:.1f}%  method={s.get('matchMethod', 'n/a')}"
            )
        logger.info(f"  Avg distance:       {np.mean(dists):.4f}")
        logger.info(f"  Avg confidence:     {np.mean(confs):.1f}%")

    logger.info(f"  Processing time:    {processing_time}ms")
    logger.info("=" * 60)

    return {
        "facesDetected": total_faces,
        "facesRecognized": total_recognized,
        "recognizedStudents": recognized_students,
        "unknownFaces": unknown_faces,
        "annotatedImagePath": annotated_path,
        "processingTimeMs": processing_time,
        "metrics": {
            "threshold": threshold,
            "distanceMetric": "euclidean_projected" if projection_head.is_loaded else "euclidean_raw",
            "projectionHead": projection_head.is_loaded,
            "svmAvailable": face_classifier.is_trained,
            "imageWidth": int(image_rgb.shape[1]),
            "imageHeight": int(image_rgb.shape[0]),
            "enrolledStudents": len(enrolled_student_ids),
            "studentsWithEncodings": len(student_encodings),
            "facesDetected": total_faces,
            "facesRecognized": total_recognized,
            "unknownFaces": total_unknown,
            "skippedQuality": skipped_quality,
            "recognitionRate": round(recognition_rate, 1),
            "avgDistance": round(float(np.mean(dists)), 4) if dists else None,
            "avgConfidence": round(float(np.mean(confs)), 1) if confs else None,
            "processingTimeMs": processing_time,
        },
    }


# ═══════════════════════════════════════════════════════════════════
#  HUNGARIAN DEDUP — optimal face↔student assignment (Tier 1.4)
# ═══════════════════════════════════════════════════════════════════

def _hungarian_dedup(
    recognized_students: List[Optional[Dict]],
    rec_embeddings: List,
    rec_box_indices: List[int],
    student_encodings: Dict,
    threshold: float,
    enrolled_ids: Optional[List[str]],
    names: List[str],
    confidences: List[float],
):
    """Solve one-to-one face↔student assignment optimally.

    Given N already-tentatively-matched faces, build the N × S cost matrix
    of face→student projected-L2 distances, run the Hungarian algorithm
    (``scipy.optimize.linear_sum_assignment``), and rebuild each face's
    recognition entry using the optimal student choice. Any assignment
    whose best distance exceeds ``threshold`` is demoted to Unknown.

    Returns (recognized_students_out, extra_unknowns).
    """
    from scipy.optimize import linear_sum_assignment

    face_indices = [i for i, r in enumerate(recognized_students) if r is not None]
    if not face_indices:
        return recognized_students, []

    sids = list(student_encodings.keys())
    if not sids:
        return recognized_students, []

    N = len(face_indices)
    S = len(sids)

    # Build cost matrix. Use a large sentinel for cells that are "impossible"
    # (e.g. student has zero encodings).
    BIG = 1e6
    cost = np.full((N, S), BIG, dtype=np.float32)
    for row, face_i in enumerate(face_indices):
        proj_emb = rec_embeddings[face_i][0]
        raw_emb = rec_embeddings[face_i][1]
        for col, sid in enumerate(sids):
            encs = student_encodings[sid].get("encodings")
            if encs is None or len(encs) == 0:
                continue
            # Dimension-safe comparison
            if encs.shape[1] == proj_emb.shape[0]:
                target_emb = proj_emb
            elif encs.shape[1] == raw_emb.shape[0]:
                target_emb = raw_emb
            elif student_encodings[sid].get("raw_encodings") is not None and student_encodings[sid]["raw_encodings"].shape[1] == raw_emb.shape[0]:
                encs = student_encodings[sid]["raw_encodings"]
                target_emb = raw_emb
            else:
                continue
            cost[row, col] = float(np.min(np.linalg.norm(encs - target_emb, axis=1)))

    # If N > S (more faces than students) the non-square case still works;
    # scipy assigns min(N, S) pairs.
    row_ind, col_ind = linear_sum_assignment(cost)
    assignment = dict(zip(row_ind, col_ind))

    extra_unknowns: List[Dict] = []
    for row, face_i in enumerate(face_indices):
        box_idx = rec_box_indices[face_i]
        proj_emb, raw_emb = rec_embeddings[face_i]
        original = recognized_students[face_i]
        col = assignment.get(row)
        if col is None:
            # Face was not assigned any student (N > S) → mark Unknown
            extra_unknowns.append({
                "faceLocation": original["faceLocation"],
                "confidence": original["confidence"],
            })
            names[box_idx] = "Unknown"
            confidences[box_idx] = 0
            recognized_students[face_i] = None
            continue

        assigned_sid = sids[col]
        assigned_dist = float(cost[row, col])
        if assigned_dist > threshold:
            extra_unknowns.append({
                "faceLocation": original["faceLocation"],
                "confidence": original["confidence"],
            })
            names[box_idx] = "Unknown"
            confidences[box_idx] = 0
            recognized_students[face_i] = None
            continue

        # Re-score using the normal confidence pipeline so SVM, margin penalty,
        # and min-confidence rules still apply — just restricted to the
        # Hungarian-chosen student.
        filtered = {assigned_sid: student_encodings[assigned_sid]}
        match = _match_face(
            proj_emb, raw_emb, filtered, threshold, enrolled_ids,
            is_rematch=(assigned_sid != original["studentId"]),
        )
        if match is None:
            extra_unknowns.append({
                "faceLocation": original["faceLocation"],
                "confidence": original["confidence"],
            })
            names[box_idx] = "Unknown"
            confidences[box_idx] = 0
            recognized_students[face_i] = None
            continue

        method = match.get("matchMethod", "l2")
        if assigned_sid != original["studentId"]:
            method = method + "_hungarian"
        recognized_students[face_i] = {
            "studentId": match["studentId"],
            "registrationNumber": match.get("registrationNumber", ""),
            "name": match.get("name", ""),
            "confidence": float(match["confidence"]),
            "distance": float(match["distance"]),
            "matchMethod": method,
            "faceLocation": original["faceLocation"],
        }
        names[box_idx] = match.get("name", match["studentId"][:8])
        confidences[box_idx] = float(match["confidence"])

    return recognized_students, extra_unknowns


# ═══════════════════════════════════════════════════════════════════
#  MATCHING — min L2 (Euclidean) distance
# ═══════════════════════════════════════════════════════════════════

def _match_face(
    projected_embedding: np.ndarray,
    raw_embedding: np.ndarray,
    student_encodings: Dict[str, Dict],
    threshold: float,
    enrolled_ids: Optional[List[str]] = None,
    is_rematch: bool = False,
) -> Optional[Dict]:
    """
    Match using MIN L2 (Euclidean) distance on projected embeddings.
    SVM confirmation uses raw 512-d embeddings (trained on raw space).
    is_rematch=True relaxes margin penalties (used during dedup reassignment).
    """
    if not student_encodings:
        return None

    # Tier 2.2: blend min-distance and centroid-distance. Default OFF until
    # the projection head is retrained with hard-negative mining (Tier 2.1) —
    # the current head ranks better with pure min-distance than blended.
    # Enable CENTROID_MATCHING=1 after retraining to get the outlier-robust
    # ranking this is designed to provide.
    use_centroid = os.getenv("CENTROID_MATCHING", "0") == "1"
    centroid_weight = float(os.getenv("CENTROID_WEIGHT", "0.35"))

    all_candidates = []
    for student_id, data in student_encodings.items():
        encodings = data.get("encodings")
        if encodings is None or len(encodings) == 0:
            continue

        # Dimension-safe comparison
        if encodings.shape[1] == projected_embedding.shape[0]:
            target_emb = projected_embedding
        elif encodings.shape[1] == raw_embedding.shape[0]:
            target_emb = raw_embedding
        elif data.get("raw_encodings") is not None and data["raw_encodings"].shape[1] == raw_embedding.shape[0]:
            encodings = data["raw_encodings"]
            target_emb = raw_embedding
        elif data.get("projected_encodings") is not None and data["projected_encodings"].shape[1] == projected_embedding.shape[0]:
            encodings = data["projected_encodings"]
            target_emb = projected_embedding
        else:
            continue

        distances = np.linalg.norm(encodings - target_emb, axis=1)
        min_dist = float(np.min(distances))

        # Centroid score: use projected_centroid if available, otherwise
        # compute one on the fly (cheap on N ~= 40 encodings).
        score = min_dist
        if use_centroid:
            proj_centroid = data.get("projected_centroid") if target_emb is projected_embedding else data.get("centroid")
            if proj_centroid is None or proj_centroid.shape != target_emb.shape:
                proj_centroid = np.mean(encodings, axis=0)
                n = float(np.linalg.norm(proj_centroid))
                if n > 0:
                    proj_centroid = proj_centroid / n
            centroid_dist = float(np.linalg.norm(target_emb - proj_centroid))
            score = (1.0 - centroid_weight) * min_dist + centroid_weight * centroid_dist

        all_candidates.append({
            "student_id": student_id,
            "distance": min_dist,         # raw min-dist used for threshold check
            "score": score,                # blended score used for ranking
            "data": data,
        })

    if not all_candidates:
        return None

    # Rank by blended score when centroid matching is enabled, else raw distance
    all_candidates.sort(key=lambda x: x.get("score", x["distance"]))
    best = all_candidates[0]

    # Margin: gap to second-best (in whichever metric we ranked by)
    margin = float("inf")
    if len(all_candidates) > 1:
        sec = all_candidates[1]
        margin = sec.get("score", sec["distance"]) - best.get("score", best["distance"])

    # Tier 1.6: adaptive per-student threshold. Falls back to the global
    # `threshold` when no stats.json exists for this student.
    use_adaptive = os.getenv("ADAPTIVE_THRESHOLD", "1") == "1"
    if use_adaptive:
        effective_threshold = encoding_store.get_student_threshold(
            best["student_id"], threshold,
        )
    else:
        effective_threshold = threshold

    if best["distance"] > effective_threshold:
        return None

    # ── Confidence ──
    raw_confidence = max(0, (1 - best["distance"] / effective_threshold)) * 100

    # Margin-based confidence scaling (soft penalty, no hard rejection)
    if margin < 0.03:
        raw_confidence *= 0.4   # very ambiguous
    elif margin < 0.06:
        raw_confidence *= 0.6
    elif margin < 0.10:
        raw_confidence *= 0.75
    elif margin < 0.15:
        raw_confidence *= 0.85

    # SVM confirmation bonus (uses projected embedding — SVM trained on same space)
    method = "l2_proj"
    svm_result = face_classifier.predict(projected_embedding, enrolled_ids)
    if svm_result and svm_result["studentId"] == best["student_id"]:
        svm_prob = svm_result["probability"]
        if svm_prob >= 0.30:
            raw_confidence = 0.70 * raw_confidence + 0.30 * (svm_prob * 100)
            method = "l2_proj+svm"

    # Minimum confidence
    min_conf = 8 if is_rematch else 5
    if raw_confidence < min_conf:
        return None

    return {
        "studentId": best["student_id"],
        "registrationNumber": best["data"].get("registrationNumber", ""),
        "name": best["data"].get("name", ""),
        "distance": best["distance"],
        "confidence": round(min(99, raw_confidence), 1),
        "matchMethod": method,
    }


# ═══════════════════════════════════════════════════════════════════
#  ENCODING GENERATION
# ═══════════════════════════════════════════════════════════════════

def generate_encodings_for_images(
    image_paths: List[str],
    augment: bool = False,
    n_variants: int = 8,
) -> List[np.ndarray]:
    """
    Generate face encodings from image paths using FaceNet.
    Raw MTCNN crop → FaceNet embedding.

    When ``augment`` is True, generates ``n_variants`` MILD augmented
    copies of each face crop (flip / small rotation / brightness /
    gamma) and embeds them all.
    """
    from app.services.augmentation import augment_face

    embeddings = []

    for image_path in image_paths:
        try:
            buf = np.fromfile(image_path, dtype=np.uint8)
            img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
            if img is None:
                logger.warning(f"Could not read image: {image_path}")
                continue

            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            faces = detect_faces(img_rgb)

            if not faces:
                logger.warning(f"No face detected in: {image_path}")
                continue

            best_face = max(faces, key=lambda f: f["confidence"])
            preprocessed, _ = preprocess_face(
                img_rgb,
                best_face["box"],
                best_face.get("left_eye"),
                best_face.get("right_eye"),
            )

            is_acceptable, quality_info = assess_face_quality(
                preprocessed,
                left_eye=best_face.get("left_eye"),
                right_eye=best_face.get("right_eye"),
                face_box=best_face["box"],
            )
            if not is_acceptable:
                logger.warning(f"Low quality face in {image_path}: {quality_info}, skipping")
                continue

            embedding = get_embedding(preprocessed)
            embeddings.append(embedding)

            if augment:
                for variant in augment_face(preprocessed, n_variants=n_variants):
                    try:
                        embeddings.append(get_embedding(variant))
                    except Exception as e:
                        logger.warning(f"augment embedding failed: {e}")

        except Exception as e:
            logger.error(f"Error generating encoding for {image_path}: {e}")

    return embeddings
