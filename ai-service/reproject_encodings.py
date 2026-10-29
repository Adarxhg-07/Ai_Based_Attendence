"""
Re-project all stored encodings through the trained projection head.

After training the projection head, run this to:
  1. Project all 512-d encodings → 128-d
  2. Save as projected_encodings.npy alongside originals
  3. Recompute centroids and stats
  4. Retrain SVM on projected encodings

Usage:
    python reproject_encodings.py
"""

import os
import sys
import json
import logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np

from app.services.encoding_store import encoding_store, ENCODINGS_DIR
from app.services.projection_head import projection_head
from app.services.classifier import face_classifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    # Load projection head
    projection_head.load()
    if not projection_head.is_loaded:
        logger.error("No trained projection head found. Run train_projection_head.py first.")
        sys.exit(1)

    logger.info(f"Projection head loaded: output_dim={projection_head.output_dim}")

    all_ids = encoding_store.get_all_student_ids()
    logger.info(f"Found {len(all_ids)} students with encodings")

    all_projected = {}
    total = 0

    for sid in all_ids:
        data = encoding_store.get_encodings(sid)
        if data is None or data.get("encodings_np") is None:
            continue

        raw_encodings = data["encodings_np"]
        projected = projection_head.project_batch(raw_encodings)

        # Save projected encodings
        student_dir = os.path.join(ENCODINGS_DIR, sid)
        proj_path = os.path.join(student_dir, "projected_encodings.npy")
        np.save(proj_path, projected)

        # Compute centroid on projected space
        centroid = np.mean(projected, axis=0)
        c_norm = np.linalg.norm(centroid)
        if c_norm > 0:
            centroid = centroid / c_norm
        np.save(os.path.join(student_dir, "projected_centroid.npy"), centroid)

        # Compute stats on projected space
        if len(projected) >= 2:
            norms = np.linalg.norm(projected, axis=1, keepdims=True)
            norms = np.where(norms > 0, norms, 1)
            normed = projected / norms

            sims = np.dot(normed, normed.T)
            dists = 1 - sims
            upper = dists[np.triu_indices_from(dists, k=1)]

            centroid_dists = np.linalg.norm(projected - centroid, axis=1)

            stats = {
                "mean_intra_dist": float(np.mean(upper)) if len(upper) > 0 else 0,
                "max_intra_dist": float(np.max(upper)) if len(upper) > 0 else 0,
                "centroid_spread": float(np.mean(centroid_dists)),
                "num_encodings": int(len(projected)),
                "embedding_dim": int(projected.shape[1]),
            }
            with open(os.path.join(student_dir, "projected_stats.json"), "w") as f:
                json.dump(stats, f)

        all_projected[sid] = projected
        total += len(projected)

    logger.info(f"Projected {total} encodings for {len(all_projected)} students")

    # Retrain SVM on projected encodings
    logger.info("Retraining SVM on projected encodings...")
    svm_result = face_classifier.train(all_projected)
    if svm_result.get("success"):
        logger.info(
            f"SVM retrained: {svm_result['classes']} classes, "
            f"{svm_result['samples']} samples"
        )
    else:
        logger.warning(f"SVM training failed: {svm_result.get('reason')}")

    logger.info("Done!")


if __name__ == "__main__":
    main()
