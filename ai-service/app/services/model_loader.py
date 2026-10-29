"""
Singleton model loader for ML models.
Loads MTCNN + RetinaFace (detection) and FaceNet (recognition).

FaceNet (keras_facenet) with raw MTCNN crops — proven to work well
on this dataset with both selfies and group photos.
"""

import os
import logging

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

# Tier 3.2: GPU acceleration. Default is CPU. To enable GPU:
#   1. Install the CUDA build of TensorFlow (`pip install tensorflow[and-cuda]`)
#      or, if this box uses conda, `conda install tensorflow-gpu`.
#   2. Confirm NVIDIA drivers + CUDA runtime are installed:
#        nvidia-smi should report your card.
#   3. Set USE_GPU=1 in the AI service's .env.
#   4. Expect ~3-5× speedup on FaceNet + ~10× on the projection head.
#
# This code path simply *allows* GPU use when available. Setting
# USE_GPU=0 (default) leaves the standard TF env vars in place so TF
# picks CPU. Setting USE_GPU=1 clears the hide-GPU override and enables
# TF memory-growth so CUDA OOMs don't kill the process at startup.
_USE_GPU = os.getenv("USE_GPU", "0") == "1"
if _USE_GPU:
    # Make sure GPU isn't hidden by an earlier env setting
    if os.environ.get("CUDA_VISIBLE_DEVICES") == "-1":
        del os.environ["CUDA_VISIBLE_DEVICES"]
    try:
        import tensorflow as tf
        gpus = tf.config.list_physical_devices("GPU")
        for g in gpus:
            try:
                tf.config.experimental.set_memory_growth(g, True)
            except Exception:
                pass
        if gpus:
            logging.getLogger(__name__).info(
                f"GPU acceleration enabled ({len(gpus)} device(s)): "
                + ", ".join(g.name for g in gpus)
            )
        else:
            logging.getLogger(__name__).warning(
                "USE_GPU=1 set but no CUDA GPU visible to TensorFlow "
                "— running on CPU. Check nvidia-smi and TF build."
            )
    except Exception as e:
        logging.getLogger(__name__).warning(f"GPU init failed, using CPU: {e}")
else:
    # Force CPU to keep startup fast and avoid surprising TF behavior
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")

logger = logging.getLogger(__name__)


class ModelLoader:
    """Manages loading and lifecycle of ML models."""

    def __init__(self):
        self.face_detector = None       # MTCNN — primary detector
        self.retinaface = None          # RetinaFace module — secondary detector
        self.facenet = None             # FaceNet — recognition (512-d)
        self.is_loaded = False
        self.has_retinaface = False

    def load_models(self):
        """Load all detection and recognition models."""
        import warnings
        warnings.filterwarnings("ignore")

        # ── Primary detector: MTCNN ──
        from mtcnn import MTCNN
        logger.info("Loading MTCNN Face Detection...")
        self.face_detector = MTCNN()

        # ── Secondary detector: RetinaFace ──
        try:
            from retinaface import RetinaFace as RF
            self.retinaface = RF
            self.has_retinaface = True
            logger.info("RetinaFace detector loaded (secondary).")
        except Exception as e:
            logger.warning(f"RetinaFace not available, MTCNN only: {e}")
            self.has_retinaface = False

        # ── Recognition: FaceNet (keras_facenet) ──
        logger.info("Loading FaceNet recognition model...")
        from keras_facenet import FaceNet
        self.facenet = FaceNet()
        logger.info("FaceNet loaded (512-d embeddings).")

        # ── Projection head (domain adaptation) ──
        from app.services.projection_head import projection_head
        projection_head.load()

        self.is_loaded = True
        logger.info(
            f"All models loaded: MTCNN"
            f"{' + RetinaFace' if self.has_retinaface else ''}"
            f" + FaceNet"
            f"{' + ProjectionHead' if projection_head.is_loaded else ''}"
        )

    def cleanup(self):
        """Release resources."""
        self.face_detector = None
        self.retinaface = None
        self.facenet = None
        self.is_loaded = False
        self.has_retinaface = False


model_loader = ModelLoader()
