"""Camera endpoints.

- GET  /api/v1/camera/health     — is the RTSP stream reachable?
- GET  /api/v1/camera/stream     — multipart MJPEG for frontend preview
- GET  /api/v1/camera/snapshot   — single JPEG frame
- POST /api/v1/camera/recognize  — grab a frame and run full recognition
"""
import os
import json
import base64
import logging
import asyncio
from functools import partial
from typing import Optional, Dict, List

import cv2
import numpy as np
from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import StreamingResponse, Response

from app.services.camera_service import (
    get_camera,
    start_live_detection,
    stop_live_detection,
    live_detection_status,
)
from app.services.model_loader import model_loader
from app.services.recognition_service import recognize_faces_in_image

logger = logging.getLogger(__name__)
router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


@router.get("/camera/health")
def camera_health():
    cam = get_camera()
    if cam is None:
        return {"available": False, "reason": "no_config"}
    frame = cam.grab_snapshot(timeout=6.0)
    if frame is None:
        return {"available": False, "reason": "no_frame"}
    h, w = frame.shape[:2]
    return {"available": True, "width": int(w), "height": int(h)}


@router.get("/camera/stream")
def camera_stream(overlay: int = 1):
    cam = get_camera()
    if cam is None:
        raise HTTPException(status_code=503, detail="Camera not configured")
    return StreamingResponse(
        cam.mjpeg_stream(fps=8, quality=70, draw_overlay=bool(overlay)),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.post("/camera/live-detection/start")
def camera_live_detection_start(
    student_ids: str = Form("[]"),
    threshold: float = Form(1.1),
):
    if not model_loader.is_loaded:
        raise HTTPException(status_code=503, detail="Models still loading")
    try:
        ids = json.loads(student_ids)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid student_ids format")
    return start_live_detection(ids, threshold=threshold)


@router.post("/camera/live-detection/stop")
def camera_live_detection_stop():
    return stop_live_detection()


@router.get("/camera/live-detection/status")
def camera_live_detection_status():
    return live_detection_status()


@router.post("/camera/flash/on")
def camera_flash_on():
    """Turn on the virtual flash (CLAHE brightness boost applied to all frames)."""
    cam = get_camera()
    if cam is None:
        raise HTTPException(status_code=503, detail="Camera not configured")
    cam.set_flash(True)
    return {"flashOn": True, "mode": "virtual_clahe"}


@router.post("/camera/flash/off")
def camera_flash_off():
    cam = get_camera()
    if cam is None:
        raise HTTPException(status_code=503, detail="Camera not configured")
    cam.set_flash(False)
    return {"flashOn": False}


@router.get("/camera/flash/status")
def camera_flash_status():
    cam = get_camera()
    if cam is None:
        return {"available": False}
    return {"flashOn": cam.is_flash_on(), "mode": "virtual_clahe"}


@router.get("/camera/snapshot")
def camera_snapshot():
    cam = get_camera()
    if cam is None:
        raise HTTPException(status_code=503, detail="Camera not configured")
    frame = cam.grab_snapshot(timeout=8.0)
    if frame is None:
        raise HTTPException(status_code=504, detail="No frame available from camera")
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise HTTPException(status_code=500, detail="Frame encode failed")
    return Response(content=buf.tobytes(), media_type="image/jpeg")


@router.post("/camera/recognize")
async def camera_recognize(
    student_ids: str = Form("[]"),
    threshold: float = Form(1.1),
    frames: int = Form(1),
    frame_interval_sec: float = Form(1.0),
    vote_min_fraction: float = Form(0.5),
):
    """Grab one or more frames from the camera and recognize against the enrolled
    student list.

    When ``frames`` > 1 (multi-frame voting, Tier 1.5):
      * Captures ``frames`` snapshots spaced ``frame_interval_sec`` apart.
      * Runs full recognition on each.
      * A student is considered "voted in" if they appear in at least
        ``vote_min_fraction`` of frames (default half).
      * Returns the last frame's annotated image and per-student appearance
        counts in ``voteAppearances``. Face counts in the response reflect
        the voted students, not any single frame.
    """
    if not model_loader.is_loaded:
        raise HTTPException(status_code=503, detail="Models are still loading")

    cam = get_camera()
    if cam is None:
        raise HTTPException(status_code=503, detail="Camera not configured")

    try:
        enrolled_ids = json.loads(student_ids)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid student_ids format")

    frames = max(1, min(10, int(frames)))
    output_dir = os.path.join(BASE_DIR, "output", "annotated")
    loop = asyncio.get_event_loop()

    async def _capture_and_recognize():
        frame = cam.grab_snapshot(timeout=10.0)
        if frame is None:
            return None
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        MAX_DIM = 2048
        h, w = img_rgb.shape[:2]
        if max(h, w) > MAX_DIM:
            scale = MAX_DIM / max(h, w)
            img_rgb = cv2.resize(
                img_rgb, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA,
            )
        return await loop.run_in_executor(
            None,
            partial(
                recognize_faces_in_image,
                img_rgb,
                enrolled_student_ids=enrolled_ids,
                threshold=threshold,
                output_dir=output_dir,
            ),
        )

    if frames == 1:
        result = await _capture_and_recognize()
        if result is None:
            raise HTTPException(status_code=504, detail="No frame available from camera")
    else:
        # Burst capture + vote
        per_frame_results = []
        for i in range(frames):
            r = await _capture_and_recognize()
            if r is not None:
                per_frame_results.append(r)
            if i < frames - 1:
                await asyncio.sleep(frame_interval_sec)

        if not per_frame_results:
            raise HTTPException(status_code=504, detail="No frames available from camera")

        # Tally student appearances across frames
        total = len(per_frame_results)
        min_votes = max(1, int(np.ceil(total * vote_min_fraction)))
        appearances: Dict[str, List[Dict]] = {}
        for r in per_frame_results:
            seen_this_frame = set()
            for s in r.get("recognizedStudents", []):
                sid = s["studentId"]
                if sid in seen_this_frame:
                    continue  # dedup within a single frame
                seen_this_frame.add(sid)
                appearances.setdefault(sid, []).append(s)

        # Keep only students that appeared in >= min_votes frames; pick the
        # single best (smallest distance) sighting as their canonical entry.
        voted_students = []
        vote_counts = {}
        for sid, sightings in appearances.items():
            vote_counts[sid] = len(sightings)
            if len(sightings) >= min_votes:
                best = min(sightings, key=lambda x: x["distance"])
                voted_students.append(best)

        # Return last frame's annotated image + merged metrics
        last = per_frame_results[-1]
        result = dict(last)
        result["recognizedStudents"] = voted_students
        result["facesRecognized"] = len(voted_students)
        result["voteConfig"] = {
            "frames": frames,
            "minFraction": vote_min_fraction,
            "minVotes": min_votes,
        }
        result["voteAppearances"] = {
            sid: {
                "count": vote_counts[sid],
                "of": total,
                "voted": vote_counts[sid] >= min_votes,
            }
            for sid in vote_counts
        }
        if result.get("metrics"):
            result["metrics"]["facesRecognized"] = len(voted_students)

    if result["facesDetected"] == 0:
        result["note"] = "no_faces_detected"

    annotated_path = result.get("annotatedImagePath")
    if annotated_path and os.path.exists(annotated_path):
        with open(annotated_path, "rb") as f:
            result["annotatedImageBase64"] = base64.b64encode(f.read()).decode("utf-8")

    return result
