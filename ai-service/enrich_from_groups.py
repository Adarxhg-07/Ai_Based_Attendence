"""
Enrich student encodings using group/classroom photos.

Strategy:
  1. Detect all faces in group photos
  2. Match each face to existing selfie encodings (tight threshold = 0.35)
  3. Only accept matches with good margin (gap to 2nd best > 0.08)
  4. Add confirmed group-photo embeddings to each student's store
  5. Recompute centroids and stats, retrain SVM

This bridges the domain gap between selfie portraits and classroom photos.
"""

import os
import sys
import glob
import logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import cv2

from app.services.model_loader import model_loader
from app.models.face_detector import (
    detect_faces,
    preprocess_face,
    get_embedding,
    assess_face_quality,
)
from app.services.encoding_store import encoding_store
from app.services.classifier import face_classifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Tight L2 threshold for high-confidence matches only (well below recognition threshold of 1.0)
ENRICH_THRESHOLD = 0.75
# Minimum L2 margin to 2nd best match
MIN_MARGIN = 0.10


def main():
    logger.info("Loading models...")
    model_loader.load_models()
    logger.info("Models loaded.")

    # Collect group photos from both folders
    group_photos = []
    for folder in [
        os.path.join(os.path.dirname(__file__), "test_data", "photos"),
        os.path.join(os.path.dirname(__file__), "test_data", "extra"),
    ]:
        if os.path.exists(folder):
            for ext in ["*.jpeg", "*.jpg", "*.png", "*.JPEG", "*.JPG"]:
                group_photos.extend(glob.glob(os.path.join(folder, ext)))

    logger.info(f"Found {len(group_photos)} group photos")

    # Load all existing student encodings
    all_student_ids = encoding_store.get_all_student_ids()
    student_encodings = encoding_store.get_encodings_for_students(all_student_ids)
    logger.info(f"Loaded encodings for {len(student_encodings)} students")

    # Store raw encodings (L2 distance, not cosine)
    enc_store = {}
    for sid, data in student_encodings.items():
        encs = data["encodings"]
        if encs is None or len(encs) == 0:
            continue
        enc_store[sid] = {
            "encodings": encs,
            "name": data.get("name", sid[:8]),
            "registrationNumber": data.get("registrationNumber", ""),
        }

    # Process each group photo
    new_encodings = {}  # sid -> list of new embeddings
    total_faces = 0
    total_matched = 0
    total_rejected_quality = 0
    total_rejected_threshold = 0
    total_rejected_margin = 0

    for photo_path in group_photos:
        photo_name = os.path.basename(photo_path)
        logger.info(f"\nProcessing: {photo_name}")

        buf = np.fromfile(photo_path, dtype=np.uint8)
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
        if img is None:
            logger.warning(f"  Could not read: {photo_path}")
            continue

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = detect_faces(img_rgb)
        logger.info(f"  Detected {len(faces)} faces")
        total_faces += len(faces)

        for face in faces:
            box = face["box"]
            left_eye = face.get("left_eye")
            right_eye = face.get("right_eye")

            try:
                preprocessed, new_box = preprocess_face(
                    img_rgb, box, left_eye, right_eye
                )

                ok, qinfo = assess_face_quality(
                    preprocessed,
                    left_eye=left_eye,
                    right_eye=right_eye,
                    face_box=box,
                )
                if not ok:
                    total_rejected_quality += 1
                    continue

                embedding = get_embedding(preprocessed)

                # Find best match using L2 (Euclidean) distance
                candidates = []
                for sid, store_data in enc_store.items():
                    dists = np.linalg.norm(store_data["encodings"] - embedding, axis=1)
                    min_d = float(np.min(dists))
                    candidates.append((sid, min_d, store_data["name"]))

                candidates.sort(key=lambda x: x[1])
                if not candidates:
                    continue

                best_sid, best_dist, best_name = candidates[0]
                margin = (
                    candidates[1][1] - best_dist if len(candidates) > 1 else float("inf")
                )

                if best_dist > ENRICH_THRESHOLD:
                    total_rejected_threshold += 1
                    continue

                if margin < MIN_MARGIN:
                    total_rejected_margin += 1
                    continue

                # Confirmed match — add this embedding
                if best_sid not in new_encodings:
                    new_encodings[best_sid] = []
                new_encodings[best_sid].append(embedding)
                total_matched += 1
                logger.info(
                    f"  MATCH: {best_name:25s} dist={best_dist:.4f} margin={margin:.4f}"
                )

            except Exception as e:
                logger.warning(f"  Error processing face: {e}")

    # Save new encodings
    logger.info("\n" + "=" * 60)
    logger.info("ENRICHMENT SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total faces detected:      {total_faces}")
    logger.info(f"Matched (added):           {total_matched}")
    logger.info(f"Rejected (quality):        {total_rejected_quality}")
    logger.info(f"Rejected (threshold):      {total_rejected_threshold}")
    logger.info(f"Rejected (margin):         {total_rejected_margin}")
    logger.info(f"Students enriched:         {len(new_encodings)}")

    for sid, embeddings in new_encodings.items():
        name = enc_store.get(sid, {}).get("name", sid[:8])
        metadata = {
            "registrationNumber": enc_store.get(sid, {}).get(
                "registrationNumber", ""
            ),
            "name": name,
        }
        encoding_store.save_encodings(sid, embeddings, metadata)
        # Recompute stats
        encoding_store.remove_outlier_encodings(sid, max_std_devs=2.0)
        encoding_store.compute_student_stats(sid)
        logger.info(f"  Saved {len(embeddings)} group embeddings for {name}")

    # Retrain SVM
    logger.info("\nRetraining SVM...")
    all_encs = {}
    for sid in encoding_store.get_all_student_ids():
        data = encoding_store.get_encodings(sid)
        if data and data.get("encodings_np") is not None:
            all_encs[sid] = data["encodings_np"]

    if len(all_encs) >= 2:
        result = face_classifier.train(all_encs)
        if result.get("success"):
            logger.info(
                f"SVM retrained: {result['classes']} classes, {result['samples']} samples"
            )

    logger.info("Done!")


if __name__ == "__main__":
    main()
