"""Automated recognition evaluation against a ground-truth test set.

Usage
-----
    # Seed a pseudo-ground-truth from the current high-confidence matches
    python tests/eval_recognition.py --seed

    # Run evaluation against the current ground-truth file
    python tests/eval_recognition.py

    # Specify a different ground-truth file
    python tests/eval_recognition.py --gt tests/ground_truth.json

    # Specify a different test photo folder
    python tests/eval_recognition.py --photos "./test_data/photos"

Ground-truth format (tests/ground_truth.json):
    {
      "IMG_6991.JPG.jpeg": [
        {"x1": 123, "y1": 45, "x2": 189, "y2": 111, "studentId": "abc-123"},
        ...
      ],
      ...
    }

Metrics reported
----------------
For each photo and overall:
  * precision  = correctly recognized / total recognized
  * recall     = correctly recognized / total ground-truth faces
  * accuracy   = correctly recognized / faces detected
  * F1         = harmonic mean of precision & recall
  * avg time   = mean processing time per photo (ms)

Counting rules
--------------
A recognized face is CORRECT if its box IoU >= 0.3 with a ground-truth box
and the recognized studentId matches.
"""
import os
import sys
import json
import glob
import argparse
import time
from typing import Dict, List, Tuple, Optional

import numpy as np
import cv2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.model_loader import model_loader
from app.services.encoding_store import encoding_store
from app.services.recognition_service import recognize_faces_in_image

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_GT = os.path.join(HERE, "ground_truth.json")
DEFAULT_PHOTO_DIRS = [
    os.path.join(HERE, "..", "test_data", "photos"),
    os.path.join(HERE, "..", "test_data", "extra"),
]
IOU_MATCH_THRESHOLD = 0.3


def box_iou(a: Dict, b: Dict) -> float:
    ax1, ay1, ax2, ay2 = a["x1"], a["y1"], a["x2"], a["y2"]
    bx1, by1, bx2, by2 = b["x1"], b["y1"], b["x2"], b["y2"]
    ix1 = max(ax1, bx1); iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2); iy2 = min(ay2, by2)
    iw = max(0, ix2 - ix1); ih = max(0, iy2 - iy1)
    intersection = iw * ih
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def find_test_photos(photo_dirs: List[str]) -> List[str]:
    out = []
    seen = set()
    for d in photo_dirs:
        if not os.path.isdir(d):
            continue
        for ext in ("*.jpeg", "*.jpg", "*.png", "*.JPG", "*.JPEG", "*.PNG"):
            for p in glob.glob(os.path.join(d, ext)):
                name = os.path.basename(p)
                if name not in seen:
                    seen.add(name)
                    out.append(p)
    return sorted(out)


def run_one(photo_path: str, enrolled_ids: List[str]) -> Dict:
    buf = np.fromfile(photo_path, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if img is None:
        return {"error": "decode_failed"}
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    # Match the live API pipeline's resize cap
    MAX_DIM = 2048
    h, w = img_rgb.shape[:2]
    if max(h, w) > MAX_DIM:
        scale = MAX_DIM / max(h, w)
        img_rgb = cv2.resize(img_rgb, (int(w * scale), int(h * scale)),
                             interpolation=cv2.INTER_AREA)
    t0 = time.time()
    result = recognize_faces_in_image(img_rgb, enrolled_ids, threshold=1.1)
    result["wallTimeMs"] = int((time.time() - t0) * 1000)
    return result


def seed_ground_truth(photos: List[str], enrolled_ids: List[str],
                      out_path: str, min_confidence: float = 30.0):
    """Seed a pseudo-ground-truth by running the current pipeline on every
    photo and keeping every recognized student with confidence >= threshold.

    This is a bootstrap, not a real ground truth. For scientific evaluation
    a human should manually verify + correct the seeded file. But it gives
    an immediately-usable baseline to measure regressions against.
    """
    gt = {}
    for i, p in enumerate(photos):
        fname = os.path.basename(p)
        print(f"[{i+1}/{len(photos)}] Seeding from {fname}...")
        res = run_one(p, enrolled_ids)
        gt[fname] = []
        for s in res.get("recognizedStudents", []):
            if s["confidence"] >= min_confidence:
                box = s["faceLocation"]
                gt[fname].append({
                    "x1": int(box["x1"]), "y1": int(box["y1"]),
                    "x2": int(box["x2"]), "y2": int(box["y2"]),
                    "studentId": s["studentId"],
                    "studentName": s.get("name", ""),
                    "source": "seeded_autolabel",
                    "confidence": s["confidence"],
                })
    with open(out_path, "w") as f:
        json.dump(gt, f, indent=2)
    print(f"\nSeeded ground truth → {out_path}")
    print(f"Please review and manually correct entries. Source: seeded_autolabel")


def evaluate(photos: List[str], enrolled_ids: List[str], gt: Dict) -> Dict:
    per_photo = []
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_detected = 0
    total_time = 0

    for p in photos:
        fname = os.path.basename(p)
        if fname not in gt:
            continue
        res = run_one(p, enrolled_ids)
        gt_boxes = gt[fname]
        rec = res.get("recognizedStudents", [])

        matched_gt = set()
        tp = 0; fp = 0
        for pred in rec:
            pb = pred["faceLocation"]
            best_iou = 0.0; best_j = -1
            for j, gb in enumerate(gt_boxes):
                if j in matched_gt:
                    continue
                iou = box_iou(pb, gb)
                if iou > best_iou:
                    best_iou = iou; best_j = j
            if best_j >= 0 and best_iou >= IOU_MATCH_THRESHOLD:
                if gt_boxes[best_j]["studentId"] == pred["studentId"]:
                    tp += 1
                    matched_gt.add(best_j)
                else:
                    fp += 1  # wrong identity
            else:
                fp += 1  # spurious box

        fn = len(gt_boxes) - len(matched_gt)
        detected = res.get("facesDetected", 0)
        t = res.get("wallTimeMs", 0)

        per_photo.append({
            "photo": fname,
            "gt_count": len(gt_boxes),
            "detected": detected,
            "predicted": len(rec),
            "tp": tp, "fp": fp, "fn": fn,
            "time_ms": t,
        })
        total_tp += tp; total_fp += fp; total_fn += fn
        total_detected += detected; total_time += t

    precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) else 0.0
    recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {
        "perPhoto": per_photo,
        "totals": {
            "tp": total_tp, "fp": total_fp, "fn": total_fn,
            "detected": total_detected,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "avg_time_ms": total_time / max(1, len(per_photo)),
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--gt", default=DEFAULT_GT, help="Ground truth JSON path")
    parser.add_argument("--photos", nargs="*", default=DEFAULT_PHOTO_DIRS,
                        help="One or more photo folders")
    parser.add_argument("--seed", action="store_true",
                        help="Seed ground-truth from current pipeline's high-conf matches")
    parser.add_argument("--min-confidence", type=float, default=30.0,
                        help="Seed threshold (only matches with conf >= this are kept)")
    args = parser.parse_args()

    print("Loading models...")
    model_loader.load_models()
    enrolled_ids = encoding_store.get_all_student_ids()
    print(f"Enrolled: {len(enrolled_ids)} students")

    photos = find_test_photos(args.photos)
    print(f"Photos found: {len(photos)}")

    if args.seed:
        seed_ground_truth(photos, enrolled_ids, args.gt, args.min_confidence)
        return

    if not os.path.exists(args.gt):
        print(f"No ground-truth file at {args.gt}. Run with --seed first.")
        return

    with open(args.gt, "r") as f:
        gt = json.load(f)

    report = evaluate(photos, enrolled_ids, gt)

    print("\n{:45s} {:>3s} {:>3s} {:>3s} {:>3s} {:>3s} {:>8s}".format(
        "Photo", "GT", "Det", "TP", "FP", "FN", "Time"))
    print("-" * 80)
    for p in report["perPhoto"]:
        print("{photo:45s} {gt_count:3d} {detected:3d} {tp:3d} {fp:3d} {fn:3d} {time_ms:5d}ms".format(**p))

    t = report["totals"]
    print("-" * 80)
    print(f"Totals: TP={t['tp']}  FP={t['fp']}  FN={t['fn']}")
    print(f"Precision: {t['precision']:.3f}   Recall: {t['recall']:.3f}   F1: {t['f1']:.3f}")
    print(f"Avg time: {t['avg_time_ms']:.0f} ms/photo")


if __name__ == "__main__":
    main()
