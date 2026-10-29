"""AdaFace / ArcFace alternative backbone (Tier 3.1).

Scaffolding for an optional drop-in replacement for the FaceNet backbone.
Modern face backbones (AdaFace 2022, ElasticFace 2022, CurricularFace) have
meaningfully better cross-domain behaviour than FaceNet — the selfie-vs-
classroom gap we care about.

This module is DEFERRED: it ships the adapter but requires a one-time
manual model download. To enable:

    1. Install InsightFace:
           pip install insightface onnxruntime

    2. Download a model (e.g. buffalo_l which uses an ArcFace backbone):
           python -c "import insightface; insightface.app.FaceAnalysis(name='buffalo_l').prepare(ctx_id=-1)"
       (this caches to ~/.insightface)

    3. Set env var:
           USE_ADAFACE=1

    4. Regenerate encodings + retrain projection head + SVM. The stored
       encodings are FaceNet 512-d; AdaFace outputs 512-d but in a different
       embedding space, so the two are NOT interchangeable.

Until activated, ``get_adaface_embeddings()`` raises so callers fall back
to FaceNet.
"""
import os
import logging
from typing import List, Optional

import numpy as np

logger = logging.getLogger(__name__)

_adaface_app = None


def _load_adaface():
    """Lazy-load InsightFace. Returns the FaceAnalysis instance or None."""
    global _adaface_app
    if _adaface_app is not None:
        return _adaface_app
    try:
        from insightface.app import FaceAnalysis
    except ImportError:
        logger.debug("insightface not installed — AdaFace backbone unavailable")
        return None

    model_name = os.getenv("ADAFACE_MODEL", "buffalo_l")
    try:
        app = FaceAnalysis(
            name=model_name,
            allowed_modules=["recognition"],
            providers=["CPUExecutionProvider"],
        )
        app.prepare(ctx_id=-1, det_size=(640, 640))
        _adaface_app = app
        logger.info(f"AdaFace/ArcFace backbone '{model_name}' loaded")
        return app
    except Exception as e:
        logger.warning(f"Failed to load AdaFace backbone '{model_name}': {e}")
        return None


def is_adaface_enabled() -> bool:
    return os.getenv("USE_ADAFACE", "0") == "1"


def get_adaface_embeddings(
    face_images: List[np.ndarray],
) -> Optional[np.ndarray]:
    """Return ArcFace-style 512-d embeddings for a batch of face crops.

    Returns None if AdaFace is not available/enabled so callers can
    transparently fall back to FaceNet.
    """
    if not is_adaface_enabled():
        return None
    app = _load_adaface()
    if app is None:
        return None

    # InsightFace's recognition module operates on detected faces. Since we
    # already have aligned crops, we need its lower-level ``rec_model``.
    try:
        rec_model = app.models["recognition"]
    except (KeyError, TypeError):
        logger.debug("InsightFace recognition model not ready")
        return None

    # rec_model.get_feat accepts one face at a time (RGB, any size).
    out = []
    for crop in face_images:
        try:
            emb = rec_model.get_feat(crop)
            # Flatten + L2-normalize for consistency with FaceNet output
            emb = emb.flatten()
            n = float(np.linalg.norm(emb))
            if n > 0:
                emb = emb / n
            out.append(emb)
        except Exception as e:
            logger.debug(f"AdaFace embed failed: {e}")
            out.append(np.zeros(512, dtype=np.float32))
    return np.stack(out) if out else np.zeros((0, 512), dtype=np.float32)
