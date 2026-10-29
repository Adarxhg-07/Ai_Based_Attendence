"""Teacher-correction feedback endpoint (Tier 2.5).

When a teacher overrides a recognized face in the attendance-review UI,
the backend forwards the correction here. We append a JSONL record so a
scheduled retraining job can later consume these as hard-negative triplet
signals (face crop X was labeled as Y but should have been Z).
"""
import os
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict

from fastapi import APIRouter, Body, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
FEEDBACK_DIR = os.path.join(BASE_DIR, "feedback")
FEEDBACK_LOG = os.path.join(FEEDBACK_DIR, "training_corrections.jsonl")


@router.post("/feedback/corrections")
def record_corrections(payload: Dict = Body(...)):
    """Record one or more teacher corrections.

    Request body:
      {
        "sessionId": "<string>",
        "corrections": [
          {
            "wrongStudentId": "<string | null>",   // what AI originally said (null = Unknown)
            "correctStudentId": "<string | null>", // what teacher set it to (null = still unknown)
            "confidence": 12.3,                    // AI's reported confidence
            "distance": 0.95,                      // AI's reported distance
            "faceLocation": {"x1": 0, "y1": 0, "x2": 0, "y2": 0},
            "imagePath": "<optional absolute path to the source image>"
          },
          ...
        ]
      }
    """
    corrections = payload.get("corrections") or []
    if not isinstance(corrections, list):
        raise HTTPException(status_code=400, detail="'corrections' must be a list")

    os.makedirs(FEEDBACK_DIR, exist_ok=True)
    now = datetime.utcnow().isoformat() + "Z"
    session_id = payload.get("sessionId", "unknown")
    written = 0
    with open(FEEDBACK_LOG, "a", encoding="utf-8") as f:
        for c in corrections:
            record = {
                "timestamp": now,
                "sessionId": session_id,
                "wrongStudentId": c.get("wrongStudentId"),
                "correctStudentId": c.get("correctStudentId"),
                "confidence": c.get("confidence"),
                "distance": c.get("distance"),
                "faceLocation": c.get("faceLocation"),
                "imagePath": c.get("imagePath"),
            }
            f.write(json.dumps(record) + "\n")
            written += 1

    logger.info(f"Recorded {written} correction(s) for session {session_id}")
    return {"recorded": written, "logPath": FEEDBACK_LOG}


@router.get("/feedback/corrections/summary")
def correction_summary():
    """Tally counts of corrections seen so far (for monitoring/retraining cadence)."""
    if not os.path.exists(FEEDBACK_LOG):
        return {"total": 0, "byWrongStudent": {}, "byCorrectStudent": {}}
    total = 0
    by_wrong: Dict[str, int] = {}
    by_correct: Dict[str, int] = {}
    with open(FEEDBACK_LOG, "r", encoding="utf-8") as f:
        for line in f:
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                continue
            total += 1
            w = r.get("wrongStudentId") or "__unknown__"
            c = r.get("correctStudentId") or "__unknown__"
            by_wrong[w] = by_wrong.get(w, 0) + 1
            by_correct[c] = by_correct.get(c, 0) + 1
    return {
        "total": total,
        "byWrongStudent": by_wrong,
        "byCorrectStudent": by_correct,
        "logPath": FEEDBACK_LOG,
    }
