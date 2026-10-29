"""IP-camera integration service.

Handles RTSP connection lifecycle for an IMOU camera (Dahua-compatible).

Two layers:

1. ``CameraClient`` — RTSP reader. Keeps a VideoCapture open with a background
   thread that continuously pulls frames (otherwise RTSP buffers and frames
   fall minutes behind). Applies optional rotation (180° if camera is mounted
   upside-down). Exposes ``latest_frame()``, ``grab_snapshot()``, and
   ``mjpeg_stream()``.

2. ``LiveDetectionWorker`` — optional background worker that runs the full
   recognition pipeline at low fps against the latest frame and caches the
   results. When the MJPEG stream is generating output, overlays those cached
   bounding boxes on each served frame. Toggled on/off by API so it only
   consumes CPU during an active attendance session.
"""
import os
import time
import json
import threading
import logging
from typing import Optional, Generator, List, Dict

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def get_rtsp_url() -> Optional[str]:
    """Assemble RTSP URL from env vars, URL-escaping the password."""
    full = os.getenv("CAMERA_RTSP_URL")
    if full:
        return full
    ip = os.getenv("CAMERA_IP")
    user = os.getenv("CAMERA_USERNAME", "admin")
    pwd = os.getenv("CAMERA_PASSWORD")
    path = os.getenv("CAMERA_RTSP_PATH", "cam/realmonitor?channel=1&subtype=0")
    port = os.getenv("CAMERA_RTSP_PORT", "554")
    if not (ip and pwd):
        return None
    from urllib.parse import quote
    return f"rtsp://{quote(user)}:{quote(pwd)}@{ip}:{port}/{path}"


def _rotate_code_from_env() -> Optional[int]:
    """Return cv2 rotate constant for the configured rotation (or None)."""
    val = os.getenv("CAMERA_ROTATE", "0").strip()
    if val in ("0", "", "none", "None"):
        return None
    if val == "90":
        return cv2.ROTATE_90_CLOCKWISE
    if val == "180":
        return cv2.ROTATE_180
    if val in ("270", "-90"):
        return cv2.ROTATE_90_COUNTERCLOCKWISE
    return None


class CameraClient:
    def __init__(self, rtsp_url: str):
        self.rtsp_url = rtsp_url
        self.rotate_code = _rotate_code_from_env()
        self._cap: Optional[cv2.VideoCapture] = None
        self._lock = threading.Lock()
        self._latest_frame: Optional[np.ndarray] = None
        self._latest_ts: float = 0.0
        self._stop = threading.Event()
        self._reader: Optional[threading.Thread] = None
        self._last_open_attempt: float = 0.0
        self._open_cooldown: float = 3.0

        # Live-detection overlay state — populated by LiveDetectionWorker
        self._overlay_lock = threading.Lock()
        self._overlay_boxes: List[Dict] = []
        self._overlay_ts: float = 0.0

        # Virtual flash state — toggled by the attendance session.
        # When on, we apply CLAHE (contrast-limited adaptive histogram
        # equalization) to the Y channel of each frame so the preview and
        # recognition pipeline both see a brightened image in low light.
        # This is a software-only "flash" (IMOU locks the physical LED
        # behind their cloud API).
        #
        # IMPORTANT: cv2.CLAHE objects are NOT thread-safe. Because the
        # MJPEG stream (8 fps), the live detection worker (1 Hz), and the
        # per-minute snapshot grabs all call _apply_flash() concurrently,
        # we build a fresh CLAHE per call (cheap) instead of sharing one.
        # A single shared CLAHE caused the stream to hang after ~1 second.
        self._flash_on = False
        # Cache the gamma LUT — building the 256-entry array each call would
        # waste CPU (~thousands of times per second across all consumers).
        gamma = 0.85
        self._gamma_lut = np.array(
            [((i / 255.0) ** gamma) * 255 for i in range(256)], dtype=np.uint8,
        )

    # ── RTSP reader ──────────────────────────────────────────────────────

    def _open(self) -> bool:
        now = time.time()
        if now - self._last_open_attempt < self._open_cooldown:
            return False
        self._last_open_attempt = now
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
        logger.info("Opening RTSP stream...")
        cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000)
        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened():
            logger.warning("Failed to open RTSP stream")
            cap.release()
            return False
        self._cap = cap
        return True

    def _reader_loop(self):
        while not self._stop.is_set():
            if self._cap is None or not self._cap.isOpened():
                if not self._open():
                    time.sleep(1.0)
                    continue
            ok, frame = self._cap.read()
            if not ok or frame is None:
                try:
                    self._cap.release()
                except Exception:
                    pass
                self._cap = None
                time.sleep(0.5)
                continue
            # Rotate once at source so every consumer sees upright frames
            if self.rotate_code is not None:
                frame = cv2.rotate(frame, self.rotate_code)
            with self._lock:
                self._latest_frame = frame
                self._latest_ts = time.time()

    def start(self) -> bool:
        if self._reader is not None and self._reader.is_alive():
            return True
        self._stop.clear()
        self._reader = threading.Thread(target=self._reader_loop, daemon=True)
        self._reader.start()
        for _ in range(50):
            if self._latest_frame is not None:
                return True
            time.sleep(0.1)
        return self._latest_frame is not None

    def stop(self):
        self._stop.set()
        if self._reader is not None:
            self._reader.join(timeout=2.0)
            self._reader = None
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
        with self._lock:
            self._latest_frame = None
            self._latest_ts = 0.0

    def set_flash(self, on: bool):
        """Toggle the software virtual flash (CLAHE brightness boost)."""
        self._flash_on = bool(on)
        logger.info(f"Virtual flash: {'ON' if self._flash_on else 'OFF'}")

    def is_flash_on(self) -> bool:
        return self._flash_on

    def _apply_flash(self, frame: np.ndarray) -> np.ndarray:
        """If the virtual flash is on, brighten the frame.

        Uses CLAHE on the Y channel of YUV, then a cached gamma LUT.
        This preserves color but lifts shadows and boosts local contrast
        without blowing out highlights — better than a flat +brightness add.

        Thread safety: CLAHE is created per call because cv2.CLAHE objects
        share mutable state that isn't safe across threads. The preview
        stream, detection worker, and snapshot poll all call this
        concurrently; a shared CLAHE hangs the stream.
        """
        if not self._flash_on:
            return frame
        try:
            yuv = cv2.cvtColor(frame, cv2.COLOR_BGR2YUV)
            # Fresh CLAHE per call → thread-safe. Creation cost is negligible
            # compared to the CLAHE apply() on a 2MP frame.
            clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
            yuv[:, :, 0] = clahe.apply(yuv[:, :, 0])
            boosted = cv2.cvtColor(yuv, cv2.COLOR_YUV2BGR)
            # Gamma LUT (cached in __init__) — pulls mid-tones up toward white
            boosted = cv2.LUT(boosted, self._gamma_lut)
            # Slight linear lift
            boosted = cv2.convertScaleAbs(boosted, alpha=1.08, beta=8)
            return boosted
        except Exception as e:
            logger.debug(f"flash boost failed: {e}")
            return frame

    def latest_frame(self, max_age_sec: float = 5.0) -> Optional[np.ndarray]:
        if self._reader is None or not self._reader.is_alive():
            self.start()
        with self._lock:
            if self._latest_frame is None:
                return None
            if time.time() - self._latest_ts > max_age_sec:
                return None
            frame = self._latest_frame.copy()
        return self._apply_flash(frame)

    def grab_snapshot(self, timeout: float = 10.0) -> Optional[np.ndarray]:
        deadline = time.time() + timeout
        if self._reader is None or not self._reader.is_alive():
            self.start()
        while time.time() < deadline:
            with self._lock:
                if self._latest_frame is not None and (time.time() - self._latest_ts) < 5.0:
                    frame = self._latest_frame.copy()
                    return self._apply_flash(frame)
            time.sleep(0.2)
        return None

    # ── Live detection overlay ──────────────────────────────────────────

    def set_overlay_boxes(self, boxes: List[Dict]):
        """Called by LiveDetectionWorker after each recognition pass."""
        with self._overlay_lock:
            self._overlay_boxes = boxes or []
            self._overlay_ts = time.time()

    def clear_overlay(self):
        with self._overlay_lock:
            self._overlay_boxes = []
            self._overlay_ts = 0.0

    def _draw_overlay(self, frame: np.ndarray, max_age_sec: float = 3.0) -> np.ndarray:
        """Draw the cached detection boxes onto ``frame`` in-place and return it.

        Boxes fade (become transparent-ish via thinner lines) as they age so the
        viewer can tell that the detection is stale if the worker has stopped.
        """
        with self._overlay_lock:
            if not self._overlay_boxes or (time.time() - self._overlay_ts) > max_age_sec:
                return frame
            boxes = list(self._overlay_boxes)
            age = time.time() - self._overlay_ts

        h, w = frame.shape[:2]
        scale = max(w, h) / 1920.0
        thickness = max(2, int(3 * scale))
        font_scale = max(0.5, 0.8 * scale)
        font_thickness = max(1, int(2 * scale))
        pad = max(3, int(6 * scale))

        # Decay thickness as boxes age (age 0 = full, age 3 = minimum)
        age_factor = max(0.3, 1.0 - age / 3.0)
        thickness = max(1, int(thickness * age_factor))

        for b in boxes:
            x1, y1, x2, y2 = int(b["x1"]), int(b["y1"]), int(b["x2"]), int(b["y2"])
            label = b.get("name", "") or "Unknown"
            conf = b.get("confidence")
            known = b.get("known", True)
            color = (0, 200, 0) if known else (0, 0, 200)  # BGR: green/red

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

            if label:
                label_text = label if conf is None else f"{label} ({conf:.0f}%)"
                (tw, th), _ = cv2.getTextSize(
                    label_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness
                )
                bg_y1 = max(0, y1 - th - 2 * pad)
                cv2.rectangle(frame, (x1, bg_y1), (x1 + tw + 2 * pad, y1), color, -1)
                cv2.putText(
                    frame, label_text, (x1 + pad, y1 - pad),
                    cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255),
                    font_thickness, cv2.LINE_AA,
                )
        return frame

    # ── MJPEG stream ─────────────────────────────────────────────────────

    def mjpeg_stream(
        self, fps: int = 8, quality: int = 70, draw_overlay: bool = True
    ) -> Generator[bytes, None, None]:
        """Yield multipart MJPEG chunks with optional live-detection overlay."""
        self.start()
        interval = 1.0 / max(1, fps)
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        last = 0.0
        while True:
            now = time.time()
            if now - last < interval:
                time.sleep(interval - (now - last))
            last = time.time()
            frame = self.latest_frame(max_age_sec=5.0)
            if frame is None:
                time.sleep(0.5)
                continue
            if draw_overlay:
                frame = self._draw_overlay(frame)
            ok, buf = cv2.imencode(".jpg", frame, encode_params)
            if not ok:
                continue
            jpeg = buf.tobytes()
            yield (
                b"--frame\r\nContent-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n" +
                jpeg + b"\r\n"
            )


# =============================================================================
# Live detection worker
# =============================================================================

class LiveDetectionWorker:
    """Runs the full recognition pipeline against the latest camera frame at
    low fps, updating ``camera.set_overlay_boxes(...)`` after each pass. This
    is deliberately lighter than the snapshot worker in the backend — its only
    purpose is to give the teacher a live visual confirmation that faces are
    being recognized; the *attendance tally* still uses the slower per-minute
    snapshot pipeline.
    """

    def __init__(
        self,
        camera: "CameraClient",
        enrolled_student_ids: List[str],
        threshold: float = 1.1,
        fps: float = 1.0,
    ):
        self.camera = camera
        self.enrolled_student_ids = enrolled_student_ids
        self.threshold = threshold
        self.fps = max(0.2, min(3.0, fps))
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._last_ok_ts: float = 0.0
        self._last_faces: int = 0

    def start(self):
        if self._thread is not None and self._thread.is_alive():
            return False
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return True

    def stop(self):
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
        self.camera.clear_overlay()

    def is_running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def status(self) -> Dict:
        return {
            "running": self.is_running(),
            "fps": self.fps,
            "lastRunAt": self._last_ok_ts,
            "lastFacesDetected": self._last_faces,
            "enrolledCount": len(self.enrolled_student_ids),
        }

    def _loop(self):
        # Imported inside the function to avoid a circular import at module
        # load time (recognition_service transitively imports camera_service).
        from app.models.face_detector import (
            detect_faces, preprocess_face, get_embedding, assess_face_quality,
        )
        from app.services.projection_head import projection_head
        from app.services.encoding_store import encoding_store
        from app.services.classifier import face_classifier

        interval = 1.0 / self.fps
        MAX_DIM = 1600  # faster than 2048 for the live overlay

        while not self._stop.is_set():
            t0 = time.time()
            frame = self.camera.latest_frame(max_age_sec=5.0)
            if frame is None:
                time.sleep(0.5)
                continue

            # BGR → RGB, resize for speed
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            h, w = rgb.shape[:2]
            if max(h, w) > MAX_DIM:
                scale = MAX_DIM / max(h, w)
                rgb = cv2.resize(
                    rgb, (int(w * scale), int(h * scale)),
                    interpolation=cv2.INTER_AREA,
                )
                inv = 1.0 / scale
            else:
                inv = 1.0

            try:
                faces = detect_faces(rgb)
            except Exception as e:
                logger.warning(f"live detect_faces failed: {e}")
                time.sleep(interval)
                continue

            # Get stored encodings once per pass
            student_encodings = encoding_store.get_encodings_for_students(
                self.enrolled_student_ids or encoding_store.get_all_student_ids()
            )

            overlay_boxes: List[Dict] = []
            for face in faces:
                box = face["box"]
                try:
                    crop, new_box = preprocess_face(
                        rgb, box,
                        face.get("left_eye"),
                        face.get("right_eye"),
                    )
                    ok, _ = assess_face_quality(
                        crop,
                        left_eye=face.get("left_eye"),
                        right_eye=face.get("right_eye"),
                        face_box=box,
                    )
                    if not ok:
                        # Unknown / low quality: still show a box (red)
                        x1, y1, x2, y2 = new_box
                        overlay_boxes.append({
                            "x1": int(x1 * inv), "y1": int(y1 * inv),
                            "x2": int(x2 * inv), "y2": int(y2 * inv),
                            "name": "Unknown",
                            "confidence": None,
                            "known": False,
                        })
                        continue

                    raw = get_embedding(crop)
                    proj = (
                        projection_head.project(raw)
                        if projection_head.is_loaded else raw
                    )

                    best_dist = float("inf")
                    best_second = float("inf")
                    best_data = None
                    for sid, data in student_encodings.items():
                        encs = data["encodings"]
                        if encs is None or len(encs) == 0:
                            continue
                        d = float(np.min(np.linalg.norm(encs - proj, axis=1)))
                        if d < best_dist:
                            best_second = best_dist
                            best_dist = d
                            best_data = (sid, data)
                        elif d < best_second:
                            best_second = d

                    x1, y1, x2, y2 = new_box
                    x1, y1 = int(x1 * inv), int(y1 * inv)
                    x2, y2 = int(x2 * inv), int(y2 * inv)

                    if best_dist <= self.threshold and best_data is not None:
                        margin = best_second - best_dist
                        conf = max(0.0, (1.0 - best_dist / self.threshold)) * 100
                        if margin < 0.03:
                            conf *= 0.4
                        elif margin < 0.06:
                            conf *= 0.6
                        elif margin < 0.10:
                            conf *= 0.75
                        if conf < 5:
                            overlay_boxes.append({
                                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                                "name": "Unknown", "confidence": None,
                                "known": False,
                            })
                        else:
                            name = best_data[1].get("name") or best_data[0][:8]
                            overlay_boxes.append({
                                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                                "name": name,
                                "confidence": float(min(99, conf)),
                                "known": True,
                                "studentId": best_data[0],
                            })
                    else:
                        overlay_boxes.append({
                            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                            "name": "Unknown", "confidence": None, "known": False,
                        })
                except Exception as e:
                    logger.debug(f"live face pass error: {e}")

            # Tier 3.3: feed boxes through the IOU tracker so labels are
            # vote-stabilized across frames. A face that flickers between
            # two students from frame to frame settles on whichever has
            # been the majority over the last few frames.
            try:
                if os.getenv("FACE_TRACKING", "1") == "1":
                    from app.services.face_tracker import get_tracker
                    tracker = get_tracker()
                    detections = []
                    for b in overlay_boxes:
                        rec = None
                        if b.get("known") and b.get("studentId"):
                            rec = {
                                "studentId": b.get("studentId"),
                                "name": b.get("name"),
                                "confidence": b.get("confidence"),
                            }
                        detections.append((b, rec))
                    assigned = tracker.update(detections)
                    stabilized: List[Dict] = []
                    for tid, box, voted in assigned:
                        out = dict(box)
                        out["trackId"] = tid
                        if voted is not None:
                            out["name"] = voted.get("name") or out.get("name") or "Unknown"
                            out["confidence"] = voted.get("confidence")
                            out["known"] = True
                            out["studentId"] = voted["studentId"]
                            out["trackVotes"] = f"{voted['voteCount']}/{voted['totalVotes']}"
                        stabilized.append(out)
                    overlay_boxes = stabilized
            except Exception as e:
                logger.debug(f"tracker pass failed: {e}")

            self.camera.set_overlay_boxes(overlay_boxes)
            self._last_ok_ts = time.time()
            self._last_faces = len(overlay_boxes)

            elapsed = time.time() - t0
            if elapsed < interval:
                time.sleep(interval - elapsed)


# =============================================================================
# Module-level singletons
# =============================================================================

_camera: Optional[CameraClient] = None
_live_detector: Optional[LiveDetectionWorker] = None
_live_detector_lock = threading.Lock()


def get_camera() -> Optional[CameraClient]:
    global _camera
    if _camera is not None:
        return _camera
    url = get_rtsp_url()
    if not url:
        logger.warning("CAMERA_IP / CAMERA_PASSWORD not set — camera disabled")
        return None
    _camera = CameraClient(url)
    return _camera


def start_live_detection(enrolled_student_ids: List[str], threshold: float = 1.1) -> Dict:
    """Start (or restart with a new student list) the live-detection worker."""
    global _live_detector
    cam = get_camera()
    if cam is None:
        return {"running": False, "reason": "no_camera"}

    fps = float(os.getenv("CAMERA_LIVE_DETECTION_FPS", "1.0"))

    with _live_detector_lock:
        if _live_detector is not None:
            _live_detector.stop()
        _live_detector = LiveDetectionWorker(
            cam, enrolled_student_ids, threshold=threshold, fps=fps,
        )
        _live_detector.start()
    # Reset the IOU tracker so a new session doesn't inherit stale tracks
    try:
        from app.services.face_tracker import reset_tracker
        reset_tracker()
    except Exception:
        pass
    return _live_detector.status()


def stop_live_detection() -> Dict:
    global _live_detector
    with _live_detector_lock:
        if _live_detector is None:
            return {"running": False}
        _live_detector.stop()
        status = _live_detector.status()
        _live_detector = None
    try:
        from app.services.face_tracker import reset_tracker
        reset_tracker()
    except Exception:
        pass
    return status


def live_detection_status() -> Dict:
    with _live_detector_lock:
        if _live_detector is None:
            return {"running": False}
        return _live_detector.status()
