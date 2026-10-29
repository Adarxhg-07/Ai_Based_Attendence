"""Mild face augmentation for robust enrollment.

History / lesson learned: The aggressive pipeline tried in V2
(Downscale 0.3-0.7 + MotionBlur + GaussNoise + ImageCompression +
RandomShadow + CoarseDropout) destroyed face identity and produced
embeddings that all collapsed into a "blurry face" region of vector
space, causing mass false positives across students.

This module sticks to identity-preserving variations only — the kind
of differences the same person would naturally show across photos.
"""
from __future__ import annotations

import logging
from typing import List

import numpy as np

logger = logging.getLogger(__name__)

try:
    import albumentations as A
    _AVAILABLE = True
    _IMPORT_ERROR = None
except Exception as e:  # pragma: no cover
    A = None
    _AVAILABLE = False
    _IMPORT_ERROR = e


_pipeline = None


def _build_pipeline():
    if not _AVAILABLE:
        raise RuntimeError(f"albumentations not available: {_IMPORT_ERROR}")
    return A.Compose(
        [
            A.HorizontalFlip(p=0.5),
            A.Rotate(limit=8, p=0.5, border_mode=0),
            A.RandomBrightnessContrast(
                brightness_limit=0.15, contrast_limit=0.15, p=0.6
            ),
            A.HueSaturationValue(
                hue_shift_limit=5,
                sat_shift_limit=10,
                val_shift_limit=8,
                p=0.3,
            ),
            A.RandomGamma(gamma_limit=(90, 110), p=0.3),
        ]
    )


def is_available() -> bool:
    return _AVAILABLE


def augment_face(image: np.ndarray, n_variants: int = 8) -> List[np.ndarray]:
    """Return ``n_variants`` mildly augmented copies of an RGB uint8 face image.

    Falls back to a single horizontal-flip variant if albumentations isn't
    installed, so the caller never crashes.
    """
    if image is None or image.size == 0:
        return []

    if not _AVAILABLE:
        # Tiny fallback so the script still runs without albumentations.
        import cv2
        return [cv2.flip(image, 1)]

    global _pipeline
    if _pipeline is None:
        _pipeline = _build_pipeline()

    out: List[np.ndarray] = []
    for _ in range(int(n_variants)):
        try:
            out.append(_pipeline(image=image)["image"])
        except Exception as e:
            logger.warning("augment_face variant failed: %s", e)
    return out
