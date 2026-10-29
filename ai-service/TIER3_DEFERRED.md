# Tier 3 — Deferred Items

The recognition-pipeline improvement plan calls for three additional research-level items beyond what's been implemented in this session. Each requires resources that aren't appropriate to download/run inside an automated coding session, so they're documented here for future implementation.

## 3.4 Knowledge distillation → MobileFaceNet

**Goal:** train a 5–10× smaller "student" network that mimics the FaceNet + projection-head pipeline. Same accuracy at a fraction of the cost — useful for running on a Raspberry Pi mounted at the camera itself.

**Effort:** 2–3 weeks.

**Recipe:**
1. Implement a teacher–student wrapper:
   - Teacher = current FaceNet + projection head (frozen)
   - Student = MobileFaceNet architecture (~1.2M params, vs ~22M for FaceNet)
2. Train the student on **all** stored encodings using a combination of:
   - L2 distillation loss `||student(x) − teacher(x)||²`
   - Triplet loss with semi-hard mining (Tier 2.1)
3. Validate against the same eval script: `python tests/eval_recognition.py`
4. Replace `keras_facenet` in `model_loader.py` with the trained MobileFaceNet weights once accuracy holds.

**Dependencies:** ~1–2 GB of training data on disk, ~6 hours on a single GPU (CPU training would take ~3 days). For the FYP, only worth doing if deploying to embedded hardware.

---

## 3.5 Synthetic enrichment via StyleGAN face editing

**Goal:** for each enrolled student, synthesize 50–100 additional training images with controlled variations (pose, lighting, age, expression). Expand the 4,134-encoding dataset to 40,000+ to reduce overfitting in the projection head.

**Effort:** 2–4 weeks.

**Recipe:**
1. Install [stylegan3](https://github.com/NVlabs/stylegan3) and the FFHQ-pretrained model (~1 GB).
2. For each student, run **GAN inversion** on their existing selfies to obtain a latent `w` vector.
3. Apply pre-trained **direction edits** ([InterFaceGAN](https://github.com/genforce/interfacegan), [StyleSpace](https://github.com/betterze/StyleSpace), or [LARGE](https://github.com/zhh-yh/LARGE)) to produce variants:
   - Pose: ±20° yaw, ±10° pitch
   - Lighting: side-lit, back-lit, low-light
   - Age: ±5 years
   - Expression: neutral, smile, neutral with glasses
4. Run the new images through `generate_encodings.py` to produce embeddings; the projection head trains on the bigger dataset.

**Dependencies:** GPU recommended (StyleGAN inference is ~3 s/image on CPU, ~50 ms on GPU). Roughly 50 GB disk for cached weights + intermediate outputs.

**Risk:** if not done carefully, GAN-generated faces drift from the actual student's identity (latent edits aren't perfect). Mitigation: cosine-distance check against the original selfie embedding before accepting any synthesized image; reject if similarity drops below 0.9.

---

## 3.6 Masked-face / partial-occlusion robustness

**Goal:** correctly recognize a student when the lower half of their face is covered (mask, hand, food). Less urgent post-COVID but still occasionally needed.

**Effort:** 1–2 weeks.

**Recipe:**
1. **Detection:** add a lower-face-occlusion classifier as a quality flag. Either:
   - A small CNN trained on the [MaskedFace-Net](https://github.com/cabani/MaskedFace-Net) dataset, or
   - Heuristic: skin-tone-vs-non-skin pixel ratio in the lower face region.
2. **Recognition:** train a parallel "upper-face only" projection head on synthesized masked versions of the existing enrollment data (use [MaskTheFace](https://github.com/aqeelanwar/MaskTheFace) to add masks programmatically).
3. **Routing:** in `recognition_service._match_face`, when the occlusion classifier flags lower-face mask, switch to the upper-face projection head; otherwise use the existing one.

**Dependencies:** none unusual — MaskTheFace is `pip install` and runs on CPU.

**Risk:** the upper-face head will have lower discrimination than the full-face head (less information). Realistic ceiling is ~75% recognition for masked faces vs ~95% unmasked.

---

## Summary

| Item | Status | When to revisit |
|------|--------|-----------------|
| 3.4 Knowledge distillation | Documented | Only if deploying to a Pi / embedded camera |
| 3.5 Synthetic enrichment | Documented | If recognition rate plateaus and more enrollment data is unavailable |
| 3.6 Masked-face robustness | Documented | If users report mask/occlusion problems in production |

For now (single-laptop deployment, ~113 enrolled students, indoor classroom photography), the existing Tier 1 + Tier 2 scaffolding is sufficient. The 94.7% recognition rate is well above the 85% target and the per-photo latency of ~2 s leaves plenty of headroom for normal-resolution group photos.
