"""
Retrain SVM classifier on ALL students in the encoding store.
Also cleans outlier encodings and recomputes centroids + stats.

Run from the ai-service directory:
    python retrain_svm.py
    python retrain_svm.py --clean   # also remove outlier encodings
"""

import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from app.services.encoding_store import encoding_store
from app.services.classifier import face_classifier


def main():
    parser = argparse.ArgumentParser(description="Retrain SVM and optionally clean encodings")
    parser.add_argument("--clean", action="store_true", help="Remove outlier encodings before training")
    args = parser.parse_args()

    all_ids = encoding_store.get_all_student_ids()
    print(f"Found {len(all_ids)} students in encoding store")

    # Optional: clean outlier encodings
    if args.clean:
        total_removed = 0
        for sid in all_ids:
            kept, removed = encoding_store.remove_outlier_encodings(sid)
            total_removed += removed
        print(f"Outlier removal: {total_removed} total outliers removed")

    # Recompute centroids and stats for all students
    print("Computing centroids and stats...")
    for sid in all_ids:
        encoding_store.compute_student_stats(sid)

    # Load projected encodings for SVM training (matches recognition pipeline)
    all_encodings = {}
    skipped = 0
    for sid in all_ids:
        data = encoding_store.get_encodings(sid)
        if data:
            # Prefer projected embeddings (same space used for L2 matching)
            encs = data.get("projected_np")
            if encs is None:
                encs = data.get("encodings_np")
            if encs is not None and len(encs) > 0:
                all_encodings[sid] = encs
                continue
        skipped += 1

    print(f"Loaded encodings for {len(all_encodings)} students ({skipped} skipped)")

    if len(all_encodings) < 2:
        print("ERROR: Need at least 2 students with encodings to train SVM")
        return

    print("Training SVM...")
    result = face_classifier.train(all_encodings)
    if result.get("success"):
        print(f"SVM trained successfully: {result['classes']} classes, {result['samples']} samples")
    else:
        print(f"SVM training failed: {result.get('reason')}")


if __name__ == "__main__":
    main()
