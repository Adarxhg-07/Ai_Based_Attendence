"""IOU-based multi-frame face tracker (Tier 3.3).

A simple but effective stand-in for DeepSORT for the live-recognition
overlay use case. We don't need re-identification here — we already do
recognition per frame. The tracker just answers: "is this box in frame N
the same face as that box in frame N-1?"

When the answer is yes, we accumulate recognition votes across frames
for that track. A face that flickered between two students across 5
frames gets resolved by majority vote on the track, not by trusting any
single frame.

The simpler-than-DeepSORT approach is justified by:
  * Faces in our classroom feed move slowly between snapshots (1-second gap)
  * IOU > 0.4 is a near-perfect identity signal at that frame rate
  * No need for a Re-ID embedding, no Kalman filter, no Hungarian — just
    pairwise IOU matching.

Tracks decay: if a track isn't matched for ``max_lost_frames`` consecutive
frames, it's pruned.
"""
from __future__ import annotations

import time
from collections import Counter, deque
from typing import Dict, List, Optional, Tuple


def _iou(a: Dict, b: Dict) -> float:
    ix1 = max(a["x1"], b["x1"])
    iy1 = max(a["y1"], b["y1"])
    ix2 = min(a["x2"], b["x2"])
    iy2 = min(a["y2"], b["y2"])
    iw = max(0, ix2 - ix1)
    ih = max(0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0, a["x2"] - a["x1"]) * max(0, a["y2"] - a["y1"])
    area_b = max(0, b["x2"] - b["x1"]) * max(0, b["y2"] - b["y1"])
    union = area_a + area_b - inter
    return (inter / union) if union > 0 else 0.0


class _Track:
    __slots__ = ("id", "box", "votes", "last_seen", "history")

    def __init__(self, track_id: int, box: Dict, recognition: Optional[Dict]):
        self.id = track_id
        self.box = box
        self.votes: Counter = Counter()
        self.last_seen = time.time()
        self.history: deque = deque(maxlen=20)
        if recognition is not None:
            self._record(recognition)

    def _record(self, recognition: Optional[Dict]):
        sid = (recognition or {}).get("studentId") or "__unknown__"
        self.votes[sid] += 1
        self.history.append({
            "ts": time.time(),
            "studentId": sid,
            "name": (recognition or {}).get("name"),
            "confidence": (recognition or {}).get("confidence"),
        })

    def update(self, box: Dict, recognition: Optional[Dict]):
        self.box = box
        self.last_seen = time.time()
        self._record(recognition)

    @property
    def voted(self) -> Optional[Dict]:
        """Most-voted student (excluding unknown unless it's the only vote)."""
        if not self.votes:
            return None
        # Prefer a known student over Unknown when both have votes
        known = {k: v for k, v in self.votes.items() if k != "__unknown__"}
        pool = known if known else self.votes
        sid, count = max(pool.items(), key=lambda kv: kv[1])
        if sid == "__unknown__":
            return None
        # Pull the most recent name/confidence for this student from history
        latest = next(
            (h for h in reversed(self.history) if h["studentId"] == sid),
            None,
        )
        return {
            "studentId": sid,
            "name": latest.get("name") if latest else None,
            "confidence": latest.get("confidence") if latest else None,
            "voteCount": count,
            "totalVotes": sum(self.votes.values()),
        }


class FaceTracker:
    """Maintains face tracks across consecutive frames."""

    def __init__(
        self,
        iou_threshold: float = 0.4,
        max_lost_frames: int = 3,
    ):
        self.iou_threshold = iou_threshold
        self.max_lost_frames = max_lost_frames
        self._tracks: Dict[int, _Track] = {}
        self._next_id = 1
        self._frames_since_seen: Dict[int, int] = {}

    def reset(self):
        self._tracks.clear()
        self._frames_since_seen.clear()
        self._next_id = 1

    def update(
        self,
        detections: List[Tuple[Dict, Optional[Dict]]],
    ) -> List[Tuple[int, Dict, Optional[Dict]]]:
        """Match `detections` (list of (box, recognition)) to existing tracks.

        Returns (track_id, box, voted_recognition) for each detection. The
        voted recognition aggregates the last few frames of evidence for
        that track, smoothing out per-frame errors.
        """
        used_track_ids = set()
        assignments: List[Tuple[int, Dict, Optional[Dict]]] = []

        # Greedy IOU matching (sufficient for sparse classroom faces).
        for box, recognition in detections:
            best_id = None
            best_iou = self.iou_threshold
            for tid, track in self._tracks.items():
                if tid in used_track_ids:
                    continue
                iou = _iou(box, track.box)
                if iou >= best_iou:
                    best_iou = iou
                    best_id = tid
            if best_id is None:
                # Spawn a new track
                best_id = self._next_id
                self._next_id += 1
                self._tracks[best_id] = _Track(best_id, box, recognition)
            else:
                self._tracks[best_id].update(box, recognition)
            used_track_ids.add(best_id)
            assignments.append((best_id, box, self._tracks[best_id].voted))

        # Age out tracks that weren't seen this frame
        for tid in list(self._tracks.keys()):
            if tid not in used_track_ids:
                self._frames_since_seen[tid] = self._frames_since_seen.get(tid, 0) + 1
                if self._frames_since_seen[tid] > self.max_lost_frames:
                    del self._tracks[tid]
                    self._frames_since_seen.pop(tid, None)
            else:
                self._frames_since_seen[tid] = 0

        return assignments

    def state(self) -> Dict:
        return {
            "trackCount": len(self._tracks),
            "tracks": [
                {"id": t.id, "box": t.box, "voted": t.voted}
                for t in self._tracks.values()
            ],
        }


# Module-level singleton for the live-detection worker
_tracker: Optional[FaceTracker] = None


def get_tracker() -> FaceTracker:
    global _tracker
    if _tracker is None:
        _tracker = FaceTracker()
    return _tracker


def reset_tracker():
    if _tracker is not None:
        _tracker.reset()
