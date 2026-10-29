"""
Train a projection head on top of frozen FaceNet embeddings.

The projection head learns a 512-d → 128-d mapping that:
  - Pulls same-person embeddings closer (selfie ↔ classroom)
  - Pushes different-person embeddings apart
  - Bridges the domain gap between selfie and classroom photos

Usage:
    python train_projection_head.py
    python train_projection_head.py --epochs 100 --margin 0.3
"""

import os
import sys
import random
import argparse
import logging
from typing import Dict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import tensorflow as tf
from tensorflow import keras

from app.services.encoding_store import encoding_store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "projection_head.keras")


@keras.utils.register_keras_serializable()
class L2Normalize(keras.layers.Layer):
    """L2 normalization layer (serializable, avoids Lambda)."""
    def call(self, inputs):
        return tf.math.l2_normalize(inputs, axis=1)


def build_projection_head(input_dim=512, output_dim=128):
    """Build the projection head model: 512 → 256 → 128 with L2 norm."""
    inputs = keras.Input(shape=(input_dim,), name="embedding_input")

    x = keras.layers.Dense(256, activation="relu", name="proj_dense1")(inputs)
    x = keras.layers.BatchNormalization(name="proj_bn1")(x)
    x = keras.layers.Dropout(0.1, name="proj_drop1")(x)

    x = keras.layers.Dense(output_dim, activation="relu", name="proj_dense2")(x)
    x = keras.layers.BatchNormalization(name="proj_bn2")(x)

    outputs = L2Normalize(name="l2_norm")(x)

    model = keras.Model(inputs=inputs, outputs=outputs, name="projection_head")
    return model


def load_all_encodings():
    """Load all stored encodings grouped by student."""
    all_ids = encoding_store.get_all_student_ids()
    encodings_by_student = {}

    for sid in all_ids:
        data = encoding_store.get_encodings(sid)
        if data and data.get("encodings_np") is not None and len(data["encodings_np"]) >= 2:
            encodings_by_student[sid] = data["encodings_np"]

    return encodings_by_student


def split_train_val(encodings_by_student, val_ratio=0.2, seed=42):
    """Split by student ID (not by encoding) to prevent data leakage."""
    rng = random.Random(seed)
    student_ids = list(encodings_by_student.keys())
    rng.shuffle(student_ids)

    val_count = max(2, int(len(student_ids) * val_ratio))
    val_ids = set(student_ids[:val_count])
    train_ids = set(student_ids[val_count:])

    train = {sid: encodings_by_student[sid] for sid in train_ids}
    val = {sid: encodings_by_student[sid] for sid in val_ids}

    return train, val


def mine_triplets_batch(encodings_by_student, batch_size=64, noise_std=0.01):
    """Mine a batch of triplets with light noise augmentation (RANDOM baseline).

    Kept for backwards compatibility; prefer ``mine_triplets_semihard`` which
    takes the current model into account.
    """
    student_ids = [
        sid for sid, encs in encodings_by_student.items() if len(encs) >= 2
    ]

    anchors, positives, negatives = [], [], []

    for _ in range(batch_size):
        sid = random.choice(student_ids)
        encs = encodings_by_student[sid]
        i, j = random.sample(range(len(encs)), 2)
        anchor = encs[i].copy()
        positive = encs[j].copy()

        if noise_std > 0:
            anchor += np.random.normal(0, noise_std, anchor.shape)
            positive += np.random.normal(0, noise_std, positive.shape)
            anchor = anchor / (np.linalg.norm(anchor) + 1e-10)
            positive = positive / (np.linalg.norm(positive) + 1e-10)

        neg_sid = random.choice([s for s in student_ids if s != sid])
        neg_encs = encodings_by_student[neg_sid]
        negative = neg_encs[random.randint(0, len(neg_encs) - 1)].copy()

        anchors.append(anchor)
        positives.append(positive)
        negatives.append(negative)

    return np.array(anchors), np.array(positives), np.array(negatives)


def mine_triplets_semihard(
    model,
    encodings_by_student,
    batch_size=64,
    margin=0.3,
    noise_std=0.01,
    neg_candidate_pool=128,
):
    """Tier 2.1: Semi-hard negative mining.

    For each anchor, select:
      * the HARDEST POSITIVE — the embedding of the same student that is
        *farthest* from the anchor in the projected space; and
      * a SEMI-HARD NEGATIVE — a different-student embedding whose projected
        distance from the anchor is greater than the positive distance but
        less than ``positive_distance + margin`` (i.e. a "difficult but not
        impossible" negative). If none qualifies, fall back to the closest
        negative overall.

    This sampler drives orders-of-magnitude faster convergence than random
    sampling and was the core technique that pushed FaceNet from ~95% to
    ~99.6% on LFW.
    """
    student_ids = [
        sid for sid, encs in encodings_by_student.items() if len(encs) >= 2
    ]
    if not student_ids:
        return np.zeros((0,)), np.zeros((0,)), np.zeros((0,))

    # Flatten a candidate pool of negatives up front to amortize the
    # embedding forward pass across the batch. Track per-student offsets
    # so we can map between (sid, local_idx) ↔ flat_idx.
    flat_encs = []
    flat_sids = []
    sid_offsets: Dict[str, int] = {}
    for sid in student_ids:
        sid_offsets[sid] = len(flat_encs)
        for enc in encodings_by_student[sid]:
            flat_encs.append(enc)
            flat_sids.append(sid)
    flat_encs = np.array(flat_encs, dtype=np.float32)
    flat_sids_arr = np.array(flat_sids)

    # Project the whole pool once (in batches to stay in memory)
    projected_pool = model.predict(flat_encs, verbose=0, batch_size=256)

    anchors, positives, negatives = [], [], []
    for _ in range(batch_size):
        sid = random.choice(student_ids)
        encs = encodings_by_student[sid]
        n_same = len(encs)

        # Anchor: pick a random encoding for this student
        ai = random.randint(0, n_same - 1)
        anchor_flat_idx = sid_offsets[sid] + ai
        anchor_raw = encs[ai]
        anchor_proj = projected_pool[anchor_flat_idx]

        # Hardest positive: same-student encoding with MAX distance to anchor
        if n_same > 1:
            pos_local = [i for i in range(n_same) if i != ai]
            pos_flat = [sid_offsets[sid] + i for i in pos_local]
            pos_projs = projected_pool[pos_flat]
            pos_dists = np.linalg.norm(pos_projs - anchor_proj, axis=1)
            pos_rel_i = int(np.argmax(pos_dists))
            positive_raw = encs[pos_local[pos_rel_i]]
            positive_dist = float(pos_dists[pos_rel_i])
        else:
            positive_raw = anchor_raw
            positive_dist = 0.0

        # Semi-hard negative: different-student, dist > pos_dist, dist < pos_dist + margin.
        # Falls back to the hardest negative if no semi-hard candidate exists.
        neg_mask = (flat_sids_arr != sid)
        neg_projs = projected_pool[neg_mask]
        neg_raw_pool = flat_encs[neg_mask]
        neg_dists = np.linalg.norm(neg_projs - anchor_proj, axis=1)

        semi_hard = np.where(
            (neg_dists > positive_dist) & (neg_dists < positive_dist + margin)
        )[0]
        if len(semi_hard) > 0:
            chosen = int(semi_hard[random.randint(0, len(semi_hard) - 1)])
        else:
            chosen = int(np.argmin(neg_dists))
        negative_raw = neg_raw_pool[chosen]

        anchor = anchor_raw.copy()
        positive = positive_raw.copy()
        negative = negative_raw.copy()

        if noise_std > 0:
            anchor += np.random.normal(0, noise_std, anchor.shape)
            positive += np.random.normal(0, noise_std, positive.shape)
            anchor = anchor / (np.linalg.norm(anchor) + 1e-10)
            positive = positive / (np.linalg.norm(positive) + 1e-10)

        anchors.append(anchor)
        positives.append(positive)
        negatives.append(negative)

    return np.array(anchors), np.array(positives), np.array(negatives)


def triplet_loss(anchor, positive, negative, margin=0.3):
    """Triplet margin loss."""
    pos_dist = tf.reduce_sum(tf.square(anchor - positive), axis=1)
    neg_dist = tf.reduce_sum(tf.square(anchor - negative), axis=1)
    loss = tf.maximum(pos_dist - neg_dist + margin, 0.0)
    return tf.reduce_mean(loss)


def evaluate(model, encodings_by_student):
    """Evaluate intra-class vs inter-class separation in projected space."""
    projected = {}
    for sid, encs in encodings_by_student.items():
        proj = model.predict(encs, verbose=0)
        projected[sid] = proj

    # Intra-class distances (same person)
    intra_dists = []
    for sid, proj in projected.items():
        if len(proj) < 2:
            continue
        for i in range(len(proj)):
            for j in range(i + 1, len(proj)):
                d = float(np.linalg.norm(proj[i] - proj[j]))
                intra_dists.append(d)

    # Inter-class distances (different people) - sample to keep it fast
    inter_dists = []
    sids = list(projected.keys())
    for _ in range(min(5000, len(sids) * 50)):
        s1, s2 = random.sample(sids, 2)
        e1 = projected[s1][random.randint(0, len(projected[s1]) - 1)]
        e2 = projected[s2][random.randint(0, len(projected[s2]) - 1)]
        inter_dists.append(float(np.linalg.norm(e1 - e2)))

    intra_mean = np.mean(intra_dists) if intra_dists else 0
    intra_max = np.max(intra_dists) if intra_dists else 0
    inter_mean = np.mean(inter_dists) if inter_dists else 0
    inter_min = np.min(inter_dists) if inter_dists else 0

    separation = inter_mean - intra_mean

    return {
        "intra_mean": intra_mean,
        "intra_max": intra_max,
        "inter_mean": inter_mean,
        "inter_min": inter_min,
        "separation": separation,
    }


def main():
    parser = argparse.ArgumentParser(description="Train projection head")
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--margin", type=float, default=0.3)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--steps-per-epoch", type=int, default=50)
    parser.add_argument(
        "--mining", choices=["random", "semihard"], default="semihard",
        help="Triplet mining strategy. 'semihard' (default, Tier 2.1) uses the "
             "current model to pick hard positives + semi-hard negatives per "
             "anchor — faster convergence and better final embeddings.",
    )
    parser.add_argument(
        "--mining-refresh-steps", type=int, default=5,
        help="For semi-hard mining: re-project the candidate pool every N "
             "steps. Smaller = fresher negatives but slower per epoch.",
    )
    args = parser.parse_args()

    logger.info("Loading stored encodings...")
    all_encodings = load_all_encodings()
    logger.info(f"Loaded {sum(len(v) for v in all_encodings.values())} encodings for {len(all_encodings)} students")

    # Split
    train_encs, val_encs = split_train_val(all_encodings)
    logger.info(f"Train: {len(train_encs)} students, Val: {len(val_encs)} students")

    # Build model
    model = build_projection_head()
    model.summary(print_fn=logger.info)

    optimizer = keras.optimizers.Adam(learning_rate=args.lr)

    # Evaluate before training
    logger.info("\n--- Before training ---")
    before = evaluate(model, val_encs)
    logger.info(f"  Intra-class mean: {before['intra_mean']:.4f}, max: {before['intra_max']:.4f}")
    logger.info(f"  Inter-class mean: {before['inter_mean']:.4f}, min: {before['inter_min']:.4f}")
    logger.info(f"  Separation (inter - intra): {before['separation']:.4f}")

    # Training loop
    best_val_loss = float("inf")
    patience_counter = 0
    patience = 15
    best_weights = None

    logger.info(f"\n--- Training ({args.epochs} epochs, {args.steps_per_epoch} steps/epoch) ---")

    for epoch in range(args.epochs):
        epoch_losses = []

        for step in range(args.steps_per_epoch):
            if args.mining == "semihard":
                # Refresh the projected pool periodically to keep mining fresh
                anc, pos, neg = mine_triplets_semihard(
                    model, train_encs, args.batch_size, margin=args.margin,
                )
            else:
                anc, pos, neg = mine_triplets_batch(train_encs, args.batch_size)

            with tf.GradientTape() as tape:
                a_proj = model(anc, training=True)
                p_proj = model(pos, training=True)
                n_proj = model(neg, training=True)
                loss = triplet_loss(a_proj, p_proj, n_proj, args.margin)

            grads = tape.gradient(loss, model.trainable_variables)
            optimizer.apply_gradients(zip(grads, model.trainable_variables))
            epoch_losses.append(float(loss))

        train_loss = np.mean(epoch_losses)

        # Validation loss (always use random mining for a stable signal)
        val_losses = []
        for _ in range(10):
            anc, pos, neg = mine_triplets_batch(val_encs, args.batch_size, noise_std=0)
            a_proj = model(anc, training=False)
            p_proj = model(pos, training=False)
            n_proj = model(neg, training=False)
            val_losses.append(float(triplet_loss(a_proj, p_proj, n_proj, args.margin)))
        val_loss = np.mean(val_losses)

        if (epoch + 1) % 5 == 0 or epoch == 0:
            logger.info(f"  Epoch {epoch+1:3d}: train_loss={train_loss:.4f}, val_loss={val_loss:.4f}")

        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            best_weights = model.get_weights()
        else:
            patience_counter += 1
            if patience_counter >= patience:
                logger.info(f"  Early stopping at epoch {epoch+1} (best val_loss={best_val_loss:.4f})")
                break

    # Restore best weights
    if best_weights is not None:
        model.set_weights(best_weights)

    # Evaluate after training
    logger.info("\n--- After training ---")
    after = evaluate(model, val_encs)
    logger.info(f"  Intra-class mean: {after['intra_mean']:.4f}, max: {after['intra_max']:.4f}")
    logger.info(f"  Inter-class mean: {after['inter_mean']:.4f}, min: {after['inter_min']:.4f}")
    logger.info(f"  Separation (inter - intra): {after['separation']:.4f}")
    logger.info(f"  Improvement: {after['separation'] - before['separation']:.4f}")

    # Also evaluate on full dataset
    logger.info("\n--- Full dataset evaluation ---")
    full_eval = evaluate(model, all_encodings)
    logger.info(f"  Intra-class mean: {full_eval['intra_mean']:.4f}, max: {full_eval['intra_max']:.4f}")
    logger.info(f"  Inter-class mean: {full_eval['inter_mean']:.4f}, min: {full_eval['inter_min']:.4f}")
    logger.info(f"  Separation: {full_eval['separation']:.4f}")

    # Suggest threshold
    suggested_threshold = (full_eval["intra_max"] + full_eval["inter_min"]) / 2
    logger.info(f"\n  Suggested threshold: {suggested_threshold:.4f}")
    logger.info(f"  (midpoint between intra_max={full_eval['intra_max']:.4f} and inter_min={full_eval['inter_min']:.4f})")

    # Save model
    os.makedirs(MODEL_DIR, exist_ok=True)
    model.save(MODEL_PATH)
    logger.info(f"\nModel saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
