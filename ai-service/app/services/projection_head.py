"""
Projection head for domain-adapted face embeddings.

Transforms 512-d FaceNet embeddings → 128-d projected embeddings
that are more discriminative for classroom face recognition.

Falls back to raw 512-d embeddings if no trained model exists.
"""

import os
import logging
from typing import Optional

import numpy as np

try:
    import tensorflow as tf
    from tensorflow import keras

    @keras.utils.register_keras_serializable()
    class L2Normalize(keras.layers.Layer):
        """L2 normalization layer (must match training definition for deserialization)."""
        def call(self, inputs):
            return tf.math.l2_normalize(inputs, axis=1)
    HAS_TF = True
except ImportError:
    tf = None
    keras = None
    HAS_TF = False

logger = logging.getLogger(__name__)

MODEL_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "models",
)
MODEL_PATH = os.path.join(MODEL_DIR, "projection_head.keras")


class ProjectionHead:
    def __init__(self):
        self.model = None
        self.is_loaded = False
        self.output_dim = 128

    def load(self):
        """Load the trained projection head model if it exists."""
        if not HAS_TF or not os.path.exists(MODEL_PATH):
            logger.info("No projection head model found — using raw FaceNet embeddings")
            return

        try:
            self.model = keras.models.load_model(MODEL_PATH)
            self.is_loaded = True
            self.output_dim = self.model.output_shape[-1]
            logger.info(
                f"Projection head loaded: 512-d → {self.output_dim}-d "
                f"({MODEL_PATH})"
            )
        except Exception as e:
            logger.warning(f"Failed to load projection head: {e}")

    def project(self, embedding: np.ndarray) -> np.ndarray:
        """
        Project a 512-d FaceNet embedding to the learned space.
        Returns the original embedding if no model is loaded.
        """
        if not self.is_loaded:
            return embedding

        if embedding.ndim == 1:
            projected = self.model.predict(embedding[np.newaxis], verbose=0)[0]
        else:
            projected = self.model.predict(embedding, verbose=0)

        return projected

    def project_batch(self, embeddings: np.ndarray) -> np.ndarray:
        """Project a batch of embeddings."""
        if not self.is_loaded:
            return embeddings

        return self.model.predict(embeddings, verbose=0)


projection_head = ProjectionHead()
