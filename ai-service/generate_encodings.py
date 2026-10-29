"""
Generate face encodings for all students in the database.
Run this from the ai-service directory:
    python generate_encodings.py           # skip existing
    python generate_encodings.py --force   # regenerate all
"""

import os
import sys
import sqlite3
import argparse
import logging

# Ensure the ai-service root is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.model_loader import model_loader
from app.services.recognition_service import generate_encodings_for_images
from app.services.encoding_store import encoding_store
from app.services.classifier import face_classifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Path to the SQLite database
DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "backend",
    "prisma",
    "dev.db",
)


def main():
    parser = argparse.ArgumentParser(description="Generate face encodings for students")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete existing encodings and regenerate all from scratch",
    )
    args = parser.parse_args()

    if not os.path.exists(DB_PATH):
        logger.error(f"Database not found at {DB_PATH}")
        sys.exit(1)

    logger.info("Loading AI models (MTCNN + RetinaFace + ArcFace + Facenet512)...")
    model_loader.load_models()
    logger.info("Models loaded successfully.")

    # Connect to SQLite database
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Get all active students
    students = conn.execute(
        """
        SELECT id, registration_number, first_name, last_name
        FROM students
        WHERE is_active = 1 AND deleted_at IS NULL
        """
    ).fetchall()

    logger.info(f"Found {len(students)} active students")

    if args.force:
        logger.info("--force flag: clearing all existing encodings...")
        for student in students:
            encoding_store.delete_encodings(student["id"])
        logger.info("All existing encodings cleared.")

    total_encodings = 0
    students_with_encodings = 0
    students_failed = 0
    all_encodings_by_student = {}

    for i, student in enumerate(students):
        student_id = student["id"]
        reg_no = student["registration_number"]
        name = f"{student['first_name']} {student['last_name']}"

        # Check if encodings already exist (when not forcing)
        if not args.force:
            existing = encoding_store.get_encodings(student_id)
            if existing and len(existing.get("encodings", [])) > 0:
                logger.info(
                    f"[{i+1}/{len(students)}] {name} ({reg_no}) - "
                    f"already has {len(existing['encodings'])} encodings, skipping"
                )
                students_with_encodings += 1
                total_encodings += len(existing["encodings"])
                # Still collect for SVM training
                enc_data = encoding_store.get_encodings(student_id)
                if enc_data and enc_data.get("encodings_np") is not None:
                    all_encodings_by_student[student_id] = enc_data["encodings_np"]
                continue

        # Get face images for this student
        images = conn.execute(
            """
            SELECT image_path FROM student_face_images
            WHERE student_id = ? AND deleted_at IS NULL
            """,
            (student_id,),
        ).fetchall()

        if not images:
            logger.warning(f"[{i+1}/{len(students)}] {name} ({reg_no}) - no face images")
            continue

        # Filter to existing files
        valid_paths = []
        for img in images:
            p = img["image_path"]
            if os.path.exists(p):
                valid_paths.append(p)

        if not valid_paths:
            logger.warning(
                f"[{i+1}/{len(students)}] {name} ({reg_no}) - "
                f"none of {len(images)} image paths exist on disk"
            )
            continue

        logger.info(
            f"[{i+1}/{len(students)}] Processing {name} ({reg_no}) "
            f"- {len(valid_paths)} images..."
        )

        try:
            encodings = generate_encodings_for_images(valid_paths, augment=True, n_variants=8)

            if encodings:
                metadata = {
                    "registrationNumber": reg_no,
                    "name": name,
                }
                encoding_store.save_encodings(student_id, encodings, metadata)
                logger.info(f"  -> {len(encodings)} encodings saved")

                # Remove outlier encodings (bad augmentations, misdetections)
                kept, removed = encoding_store.remove_outlier_encodings(student_id, max_std_devs=1.5)
                if removed > 0:
                    logger.info(f"  -> Outlier removal: kept {kept}, removed {removed}")

                total_encodings += kept
                students_with_encodings += 1

                # Compute per-student stats + centroid for adaptive thresholds
                stats = encoding_store.compute_student_stats(student_id)
                if stats:
                    logger.info(
                        f"  -> Stats: mean_intra={stats['mean_intra_dist']:.4f}, "
                        f"max_intra={stats['max_intra_dist']:.4f}, "
                        f"centroid_spread={stats.get('centroid_spread', 0):.4f}, "
                        f"num_encodings={stats['num_encodings']}"
                    )

                # Collect for SVM training (use cleaned encodings)
                import numpy as np
                clean_data = encoding_store.get_encodings(student_id)
                if clean_data and clean_data.get("encodings_np") is not None:
                    all_encodings_by_student[student_id] = clean_data["encodings_np"]
            else:
                logger.warning(f"  -> No encodings generated (face detection failed)")
                students_failed += 1
        except Exception as e:
            logger.error(f"  -> Error: {e}")
            students_failed += 1

    conn.close()

    # Train SVM classifier if we have enough students
    logger.info("")
    logger.info("-" * 55)
    if len(all_encodings_by_student) >= 2:
        logger.info(f"Training SVM classifier on {len(all_encodings_by_student)} students...")
        svm_result = face_classifier.train(all_encodings_by_student)
        if svm_result.get("success"):
            logger.info(
                f"  SVM trained: {svm_result['classes']} classes, "
                f"{svm_result['samples']} samples"
            )
        else:
            logger.warning(f"  SVM training failed: {svm_result.get('reason', 'unknown')}")
    else:
        logger.warning(
            f"Only {len(all_encodings_by_student)} students with encodings — "
            f"need at least 2 to train SVM"
        )

    logger.info("")
    logger.info("=" * 55)
    logger.info("  Encoding generation complete!")
    logger.info("=" * 55)
    logger.info(f"  Students with encodings: {students_with_encodings}/{len(students)}")
    logger.info(f"  Students failed:         {students_failed}")
    logger.info(f"  Total encodings:         {total_encodings}")
    logger.info(f"  SVM trained:             {face_classifier.is_trained}")
    logger.info("=" * 55)


if __name__ == "__main__":
    main()
