"""
Face detection and preprocessing pipeline.

Detection:  MTCNN (primary) + RetinaFace (fallback).
Preprocess: Raw MTCNN crop (no alignment — proven to work best with FaceNet).
Embedding:  FaceNet (keras_facenet) 512-d.
"""

import os
import numpy as np
import cv2
import logging
from typing import List, Dict, Optional, Tuple

from app.services.model_loader import model_loader

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
#  DETECTION — MTCNN + RetinaFace + NMS
# ═══════════════════════════════════════════════════════════════════

def detect_faces(image_rgb: np.ndarray) -> List[Dict]:
    """
    Hybrid multi-detector face detection.
    1. Run MTCNN at original scale.
    2. If image is large, also run MTCNN at reduced scale.
    3. If RetinaFace available, run it too.
    4. NMS to deduplicate.
    """
    h, w = image_rgb.shape[:2]

    mtcnn_results = _detect_mtcnn(image_rgb)

    # Multi-scale MTCNN for large images
    if max(h, w) > 800:
        scale = 640 / max(h, w)
        small = cv2.resize(image_rgb, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        small_dets = _detect_mtcnn(small)
        inv = 1.0 / scale
        for det in small_dets:
            bx, by, bw, bh = det["box"]
            det["box"] = (int(bx * inv), int(by * inv), int(bw * inv), int(bh * inv))
            for key in ["left_eye", "right_eye"]:
                if det.get(key):
                    det[key] = (int(det[key][0] * inv), int(det[key][1] * inv))
            det["source"] = "mtcnn_multiscale"
        mtcnn_results.extend(small_dets)

    retina_results = []
    if model_loader.has_retinaface:
        try:
            retina_results = _detect_retinaface(image_rgb)
        except Exception as e:
            logger.debug(f"RetinaFace detection failed: {e}")

    all_dets = mtcnn_results + retina_results
    if not all_dets:
        return []

    merged = _nms_merge(all_dets, iou_threshold=0.4)
    logger.debug(
        f"Detection: MTCNN={len(mtcnn_results)}, RetinaFace={len(retina_results)}, "
        f"after NMS={len(merged)}"
    )
    return merged


def _detect_mtcnn(image_rgb: np.ndarray) -> List[Dict]:
    results = []
    try:
        detections = model_loader.face_detector.detect_faces(image_rgb)
    except Exception as e:
        logger.warning(f"MTCNN detection error: {e}")
        return results

    h, w = image_rgb.shape[:2]
    for det in detections:
        box = det["box"]
        confidence = det["confidence"]
        keypoints = det.get("keypoints", {})

        x = max(0, box[0])
        y = max(0, box[1])
        box_w = min(box[2], w - x)
        box_h = min(box[3], h - y)

        if box_w < 10 or box_h < 10:
            continue

        results.append({
            "box": (x, y, box_w, box_h),
            "confidence": float(confidence),
            "left_eye": keypoints.get("left_eye"),
            "right_eye": keypoints.get("right_eye"),
            "source": "mtcnn",
        })
    return results


def _detect_retinaface(image_rgb: np.ndarray) -> List[Dict]:
    results = []
    image_bgr = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
    faces = model_loader.retinaface.detect_faces(image_bgr)

    if not isinstance(faces, dict):
        return results

    for key, face_data in faces.items():
        area = face_data.get("facial_area", [])
        if len(area) < 4:
            continue

        x1, y1, x2, y2 = area
        box_w = x2 - x1
        box_h = y2 - y1
        if box_w < 10 or box_h < 10:
            continue

        confidence = float(face_data.get("score", 0.9))
        landmarks = face_data.get("landmarks", {})

        left_eye = None
        right_eye = None
        if "left_eye" in landmarks:
            le = landmarks["left_eye"]
            left_eye = (int(le[0]), int(le[1]))
        if "right_eye" in landmarks:
            re = landmarks["right_eye"]
            right_eye = (int(re[0]), int(re[1]))

        results.append({
            "box": (x1, y1, box_w, box_h),
            "confidence": confidence,
            "left_eye": left_eye,
            "right_eye": right_eye,
            "source": "retinaface",
        })
    return results


def _nms_merge(detections: List[Dict], iou_threshold: float = 0.4) -> List[Dict]:
    if not detections:
        return []

    boxes = []
    for d in detections:
        bx, by, bw, bh = d["box"]
        boxes.append([bx, by, bx + bw, by + bh])
    boxes = np.array(boxes, dtype=np.float32)
    scores = np.array([d["confidence"] for d in detections], dtype=np.float32)

    order = scores.argsort()[::-1]
    keep = []

    while len(order) > 0:
        i = order[0]
        keep.append(i)
        if len(order) == 1:
            break

        xx1 = np.maximum(boxes[i, 0], boxes[order[1:], 0])
        yy1 = np.maximum(boxes[i, 1], boxes[order[1:], 1])
        xx2 = np.minimum(boxes[i, 2], boxes[order[1:], 2])
        yy2 = np.minimum(boxes[i, 3], boxes[order[1:], 3])

        inter_w = np.maximum(0, xx2 - xx1)
        inter_h = np.maximum(0, yy2 - yy1)
        intersection = inter_w * inter_h

        area_i = (boxes[i, 2] - boxes[i, 0]) * (boxes[i, 3] - boxes[i, 1])
        area_rest = (boxes[order[1:], 2] - boxes[order[1:], 0]) * (boxes[order[1:], 3] - boxes[order[1:], 1])
        union = area_i + area_rest - intersection
        iou = intersection / np.maximum(union, 1e-6)

        remaining = np.where(iou <= iou_threshold)[0]
        order = order[remaining + 1]

    return [detections[i] for i in keep]


# ═══════════════════════════════════════════════════════════════════
#  PREPROCESSING — Simple raw MTCNN crop
# ═══════════════════════════════════════════════════════════════════

def _align_by_eyes(
    image: np.ndarray,
    box: Tuple,
    left_eye: Tuple,
    right_eye: Tuple,
    desired_eye_y: float = 0.38,
    desired_inter_eye_ratio: float = 0.36,
) -> Tuple[np.ndarray, Tuple]:
    """Rotate + scale the face so the eyes are horizontal at a canonical
    position. Based on the standard face-alignment recipe used to train
    most modern face embedders (including FaceNet).

    ``desired_eye_y`` is the target y-coordinate of the eyes as a fraction
    of the output height. ``desired_inter_eye_ratio`` is the target
    horizontal distance between eyes as a fraction of the output width.
    """
    x, y, bw, bh = box
    # Use the wider of bbox sides to keep the output square
    out_side = max(bw, bh)

    lex, ley = left_eye
    rex, rey = right_eye

    # Angle to rotate so the eye line is horizontal
    dy = rey - ley
    dx = rex - lex
    angle = np.degrees(np.arctan2(dy, dx))

    # Scale: make eye-distance match desired fraction of output side
    eye_dist = float(np.hypot(dx, dy)) or 1.0
    target_eye_dist = desired_inter_eye_ratio * out_side
    scale = target_eye_dist / eye_dist

    # Midpoint between eyes — rotation center
    eyes_center = ((lex + rex) * 0.5, (ley + rey) * 0.5)

    # Affine matrix: rotate + scale about eye midpoint
    M = cv2.getRotationMatrix2D(eyes_center, angle, scale)

    # After rotation, translate so the eye midpoint ends up at the desired
    # (cx, cy) inside an ``out_side`` × ``out_side`` canvas.
    tx = (out_side * 0.5) - eyes_center[0]
    ty = (out_side * desired_eye_y) - eyes_center[1]
    M[0, 2] += tx
    M[1, 2] += ty

    aligned = cv2.warpAffine(
        image, M, (int(out_side), int(out_side)),
        flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE,
    )

    # Bounding box in original image coordinates (unchanged)
    h, w = image.shape[:2]
    x1 = max(0, x); y1 = max(0, y)
    x2 = min(w, x + bw); y2 = min(h, y + bh)
    return aligned, (x1, y1, x2, y2)


def preprocess_face(
    image: np.ndarray,
    box: Tuple,
    left_eye: Optional[Tuple] = None,
    right_eye: Optional[Tuple] = None,
    **kwargs,
) -> Tuple[np.ndarray, Tuple]:
    """
    Crop a face for embedding. By default (env ``FACE_ALIGN=1``) uses
    5-point eye-landmark alignment — rotates + scales the face so the
    eyes are horizontal at a canonical position. Falls back to the raw
    MTCNN bounding-box crop (the original behaviour) when alignment is
    disabled or when eye landmarks are missing.

    Returns (crop, bbox_in_original_image_coords).
    """
    # NOTE: default OFF. Enabling alignment only on queries while the
    # stored encodings were generated on UN-aligned crops breaks matching.
    # To switch on: set FACE_ALIGN=1 for BOTH the enrollment scripts
    # (generate_encodings.py, enrich_from_groups.py) and the recognition
    # service, then regenerate encodings + re-project + retrain SVM.
    use_align = os.getenv("FACE_ALIGN", "0") == "1"
    if use_align and left_eye is not None and right_eye is not None:
        try:
            return _align_by_eyes(image, box, left_eye, right_eye)
        except Exception as e:
            logger.debug(f"alignment failed, falling back to raw crop: {e}")

    # Fallback: raw MTCNN crop — matches the original notebook
    h, w = image.shape[:2]
    x, y, face_w, face_h = box
    x1 = max(0, x)
    y1 = max(0, y)
    x2 = min(w, x + face_w)
    y2 = min(h, y + face_h)

    face_crop = image[y1:y2, x1:x2]
    new_box = (x1, y1, x2, y2)
    return face_crop, new_box


# ═══════════════════════════════════════════════════════════════════
#  QUALITY ASSESSMENT
# ═══════════════════════════════════════════════════════════════════

def _fft_sharpness(gray: np.ndarray) -> float:
    """FFT-based sharpness metric (Tier 2.6).

    Computes the fraction of spectral energy in the high-frequency half of
    the spectrum. Ranges roughly 0.05 (very blurry) to 0.40+ (very sharp).
    Robust to overall image contrast: a low-contrast-but-sharp face scores
    higher than a high-contrast but motion-blurred one.
    """
    # Standardize size for threshold comparability
    side = 64
    if gray.shape[0] != side or gray.shape[1] != side:
        gray = cv2.resize(gray, (side, side), interpolation=cv2.INTER_AREA)
    f = np.fft.fft2(gray.astype(np.float32))
    fshift = np.fft.fftshift(f)
    mag = np.abs(fshift)
    total = float(mag.sum()) or 1.0
    # Central low-frequency block (quarter of spectrum)
    cy, cx = side // 2, side // 2
    r = side // 4
    low = float(mag[cy - r:cy + r, cx - r:cx + r].sum())
    high = total - low
    return high / total


def assess_face_quality(
    face_image: np.ndarray,
    min_size: int = 20,
    left_eye: Optional[Tuple] = None,
    right_eye: Optional[Tuple] = None,
    face_box: Optional[Tuple] = None,
) -> Tuple[bool, Dict]:
    h, w = face_image.shape[:2]

    if h < min_size or w < min_size:
        return False, {"reason": "too_small", "size": (w, h)}

    aspect = w / max(h, 1)
    if aspect < 0.3 or aspect > 3.0:
        return False, {"reason": "bad_aspect_ratio", "aspect": float(aspect)}

    # Pose check: reject extreme side profiles using eye positions
    if left_eye is not None and right_eye is not None and face_box is not None:
        _, _, face_w, _ = face_box
        eye_dist_x = abs(right_eye[0] - left_eye[0])
        if face_w > 0 and (eye_dist_x / face_w) < 0.15:
            return False, {"reason": "side_profile", "eye_ratio": float(eye_dist_x / face_w)}

    gray = cv2.cvtColor(face_image, cv2.COLOR_RGB2GRAY)

    # Tier 2.6: prefer FFT-based sharpness when enabled. Laplacian variance
    # is contrast-sensitive — a low-contrast-but-sharp face (e.g. back-lit)
    # gets rejected even though FaceNet would happily embed it. A high-
    # frequency ratio from the FFT is more robust.
    use_fft_blur = os.getenv("FFT_BLUR", "1") == "1"
    quality_info: Dict = {}
    if use_fft_blur:
        sharpness = _fft_sharpness(gray)
        quality_info["fft_sharpness"] = float(sharpness)
        # Empirical threshold: 0.12 rejects clearly motion-blurred crops
        # while accepting low-contrast but in-focus faces.
        if sharpness < float(os.getenv("FFT_SHARPNESS_MIN", "0.12")):
            return False, {"reason": "blurry_fft", "fft_sharpness": float(sharpness)}
    else:
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        quality_info["laplacian_var"] = float(laplacian_var)
        if laplacian_var < 5.0:
            return False, {"reason": "blurry", "laplacian_var": float(laplacian_var)}

    mean_brightness = float(np.mean(gray))
    if mean_brightness < 15 or mean_brightness > 250:
        return False, {"reason": "bad_exposure", "brightness": mean_brightness}

    quality_info["brightness"] = mean_brightness
    return True, quality_info


# ═══════════════════════════════════════════════════════════════════
#  EMBEDDING — FaceNet (keras_facenet)
# ═══════════════════════════════════════════════════════════════════

def upscale_tiny_face(
    crop: np.ndarray,
    min_side: int = 60,
    target_side: int = 160,
) -> np.ndarray:
    """Tier 2.7: upscale very small face crops before embedding.

    FaceNet internally resizes to 160×160. When the input crop is much
    smaller than that (≤ ``min_side`` on the shorter edge), the internal
    resize is mostly nearest-neighbour — we can do a better job with
    Lanczos. This isn't true learned super-resolution (that would need
    a GAN/SR model download), but it consistently gives ~0.5–1pp better
    recognition on tiny back-of-the-classroom faces.

    If an optional ``dnn_superres`` model file is present at
    ``ai-service/models/FSRCNN_x2.pb`` and opencv-contrib is installed,
    use it instead of Lanczos for genuine super-resolution.
    """
    if crop is None or crop.size == 0:
        return crop
    h, w = crop.shape[:2]
    if min(h, w) > min_side:
        return crop

    scale = max(1, int(np.ceil(target_side / max(1, min(h, w)))))
    # Try DNN super-resolution if the model is present
    sr_model_path = os.getenv(
        "SR_MODEL_PATH",
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "models", "FSRCNN_x2.pb",
        ),
    )
    if os.path.exists(sr_model_path):
        try:
            sr = cv2.dnn_superres.DnnSuperResImpl_create()  # type: ignore[attr-defined]
            sr.readModel(sr_model_path)
            sr.setModel("fsrcnn", 2)
            # FSRCNN x2 → repeat if we need more scale
            out = crop
            reps = int(np.ceil(np.log2(scale)))
            for _ in range(reps):
                out = sr.upsample(out)
                if min(out.shape[:2]) >= target_side:
                    break
            return out
        except Exception as e:
            logger.debug(f"SR model failed, falling back to Lanczos: {e}")

    # Lanczos fallback (no dependencies required)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)


def get_embedding(face_image: np.ndarray, project: bool = False) -> np.ndarray:
    """
    FaceNet embedding via keras_facenet, optionally projected.
    Input: raw RGB face crop (any size — FaceNet resizes internally).
    Output: 512-d raw embedding (default) or 128-d projected.
    """
    embeddings = model_loader.facenet.embeddings([face_image])
    raw = embeddings[0]

    if project:
        from app.services.projection_head import projection_head
        return projection_head.project(raw)

    return raw


def get_embeddings_batch(
    face_images: List[np.ndarray], project: bool = False
) -> np.ndarray:
    """
    Batched embedding for multiple face crops in a single forward pass.
    ~3-5x faster than calling get_embedding() in a loop for 20+ faces.

    Backend selection (via env):
      * Default: FaceNet (keras_facenet, 512-d). Proven path.
      * USE_ADAFACE=1: InsightFace/ArcFace/AdaFace (512-d, different space).
        Requires one-time model download — see adaface_backbone.py.
        Falls back to FaceNet if the model isn't available.
    """
    if not face_images:
        return np.zeros((0, 512 if not project else 128), dtype=np.float32)

    # Tier 3.1 optional backbone
    try:
        from app.services.adaface_backbone import (
            is_adaface_enabled, get_adaface_embeddings,
        )
        if is_adaface_enabled():
            ada = get_adaface_embeddings(face_images)
            if ada is not None:
                raw_embeddings = ada
            else:
                raw_embeddings = model_loader.facenet.embeddings(face_images)
        else:
            raw_embeddings = model_loader.facenet.embeddings(face_images)
    except Exception:
        raw_embeddings = model_loader.facenet.embeddings(face_images)

    if project:
        from app.services.projection_head import projection_head
        if projection_head.is_loaded:
            return projection_head.project_batch(raw_embeddings)

    return raw_embeddings


# ═══════════════════════════════════════════════════════════════════
#  DRAWING / ANNOTATIONS
# ═══════════════════════════════════════════════════════════════════

def draw_annotations(
    image: np.ndarray,
    boxes: List[Tuple],
    names: List[str],
    confidences: List[float],
) -> np.ndarray:
    img = image.copy()
    h, w = img.shape[:2]

    scale_factor = max(w, h) / 1920
    scale_factor = max(0.5, min(scale_factor, 3.0))

    box_thickness = max(2, int(4 * scale_factor))
    font_scale = max(0.6, 1.0 * scale_factor)
    font_thickness = max(1, int(2 * scale_factor))
    padding = max(5, int(10 * scale_factor))

    for idx, ((x1, y1, x2, y2), name) in enumerate(zip(boxes, names)):
        color = (0, 200, 0) if name != "Unknown" else (0, 0, 200)
        cv2.rectangle(img, (x1, y1), (x2, y2), color, box_thickness)

        if name != "Unknown" and idx < len(confidences):
            label = f"{name} ({confidences[idx]:.0f}%)"
        else:
            label = name

        (text_w, text_h), _ = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness
        )

        label_y1 = max(0, y1 - text_h - 2 * padding)
        cv2.rectangle(img, (x1, label_y1), (x1 + text_w + 2 * padding, y1), color, -1)
        cv2.putText(
            img, label, (x1 + padding, y1 - padding),
            cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255),
            font_thickness, cv2.LINE_AA,
        )

    return img
