# SmartAttend

> **AI-powered face-recognition attendance platform** — walk into a room, get marked present.
> A single group photo is detected, embedded, matched against enrolled students, and written to
> an auditable attendance record behind a role-based API.

<p>
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/TensorFlow-FF6F00?logo=tensorflow&logoColor=white" alt="TensorFlow" />
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Express-000000?logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black" alt="React" />
</p>

---

## The Problem

Roll-call burns 5–10 minutes of every lecture and produces a record nobody can audit. Sign-in
sheets get passed down the row. Card-only systems get handed to a friend. The requirement was a
system where **marking attendance is passive for the student and tamper-evident for the
institution** — no queue at the door, no proxy attendance, and a trail that survives a dispute.

---

## Results

| Metric | Result |
|---|---|
| Recognition accuracy | **94.6%** on a 119-student dataset |
| Per-student latency | **< 1s** |
| Group photo (10+ faces) | **~1.7s** end-to-end |
| Spoof resistance | Liveness detection defeats photo-based attacks across pose, lighting, and occlusion |
| Verification | RFID dual-factor alongside face match |

Built as a project at **R.V. College of Engineering (RVCE)**, Bengaluru.

---

## How It Works

```
┌─────────────┐   group photo    ┌──────────────────────────────────────────┐
│  Classroom  │ ───────────────► │            AI SERVICE (FastAPI)          │
│   capture   │                  │                                          │
└─────────────┘                  │  1. Detect      MTCNN + RetinaFace       │
       │                         │  2. Quality     blur / pose / size gate  │
       │ RFID scan               │  3. Embed       FaceNet → 512-d          │
       ▼                         │  4. Project     learned head → 128-d     │
┌─────────────┐                  │  5. Match       min L2 distance, τ=1.1   │
│  Dual-factor│                  │  6. Confirm     SVM classifier bonus     │
│ verification│                  │  7. Dedup       one identity per face    │
└─────────────┘                  └────────────────────┬─────────────────────┘
                                                      │ recognized IDs
                                                      ▼
                        ┌──────────────────────────────────────────────┐
                        │           BACKEND API (Express + TS)         │
                        │  JWT auth · RBAC · rate limiting · Helmet    │
                        │  Audit middleware on every mutation          │
                        └────────────────────┬─────────────────────────┘
                                             │ Prisma
                                             ▼
                        ┌──────────────────────────────────────────────┐
                        │      PostgreSQL — 21 modelled entities       │
                        │  Students · Sessions · Records · AuditLog    │
                        └──────────────────────────────────────────────┘
                                             ▲
                        ┌────────────────────┴─────────────────────────┐
                        │      FRONTEND (React 19 + Vite + Tailwind)   │
                        │  Teacher dashboard · live capture · exports  │
                        └──────────────────────────────────────────────┘
```

### Why a Projection Head

Raw FaceNet embeddings are 512-d and tuned for general face verification, not for separating
119 specific students. A learned projection head compresses them to **128-d in a space trained on
the actual enrolled cohort**, which tightens intra-student clustering and pushes the decision
threshold into a more forgiving range. The SVM runs as a *confirmation bonus* rather than the
primary decision — distance matching stays authoritative, so a mis-trained classifier degrades
accuracy instead of breaking recognition outright.

Enrollment uses **identity-preserving augmentation** (albumentations) to generate mild variants
per student, so a cohort with only a handful of photos each still produces a usable encoding set.

---

## Repository Layout

```
ai-service/          FastAPI recognition service
  app/models/          face detection, embedding, quality assessment
  app/services/        recognition, classifier, projection head, tracking,
                       encoding store, augmentation, camera
  app/api/routes/      recognition · encodings · camera · feedback · health
  train_projection_head.py   retrain the 512→128 projection
  retrain_svm.py             refit the confirmation classifier
  tests/eval_recognition.py  accuracy evaluation harness

backend/             Express + TypeScript API
  src/modules/         auth · students · attendance · courses · audit · reports
  src/middleware/       auth · RBAC · audit · upload · error handling
  prisma/schema.prisma 21 models covering the full academic domain

frontend/            React 19 + Vite + Tailwind teacher dashboard
```

---

## Running It

**Requirements:** Python 3.10+, Node 18+, PostgreSQL 14+

```bash
# 1 — AI service
cd ai-service
pip install -r requirements.txt
python run.py                     # serves on :8000

# 2 — Backend
cd backend
cp .env.example .env              # set DATABASE_URL, JWT_SECRET, AI_SERVICE_URL
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev                       # serves on :3000

# 3 — Frontend
cd frontend
npm install
npm run dev                       # serves on :5173
```

**Enrolling students:** upload face images per student, then generate encodings:

```bash
cd ai-service
python generate_encodings.py      # builds the encoding store
python train_projection_head.py   # optional: retrain the 512→128 head
python retrain_svm.py             # optional: refit the confirmation SVM
```

Tuning: `FACENET_THRESHOLD` (default `1.1`) sets the L2 match cutoff. Lower it to reduce false
accepts, raise it to reduce false rejects. `train_projection_head.py` prints a suggested value
after each retrain.

Full deployment notes — including service supervision and reverse-proxy configuration — are in
[`DEPLOYMENT.md`](DEPLOYMENT.md).

---

## Engineering Notes

- **The audit trail is not optional.** Every mutation passes through audit middleware and lands in
  `AuditLog`. Attendance is a record students contest, so "who changed this, when, from where" is a
  first-class requirement rather than a logging afterthought.
- **Recognition failure is a product decision, not just a metric.** Unrecognized faces are returned
  explicitly as `unknownFaces` rather than silently dropped, so a teacher can resolve them by hand
  instead of discovering a missing record weeks later.
- **Feedback loop.** The `feedback` route captures corrections, which feed the enrichment and
  retraining scripts — recognition quality improves with use rather than decaying.

---

## Tech Stack

**AI service** — Python · FastAPI · TensorFlow · MTCNN · RetinaFace · FaceNet · scikit-learn · OpenCV · albumentations
**Backend** — TypeScript · Express · Prisma · PostgreSQL · JWT · bcrypt · Helmet · Winston · ExcelJS
**Frontend** — React 19 · Vite · Tailwind CSS 4 · React Router · Axios
**Hardware** — RFID reader for dual-factor verification

---

## Team

| Name | USN | Department |
|------|-----|------------|
| **Adarsh G** | RVCE26BCS808 | Computer Science & Engineering |
| **Karthik H** | RVCE26BCS813 | Computer Science & Engineering |
| **Brijesh Gowda N** | RVCE26BAI416 | Artificial Intelligence |
| **Jonathan S Anand** | RVCE26BAI406 | Artificial Intelligence |

**R.V. College of Engineering (RVCE)**, Bengaluru

[GitHub Repository](https://github.com/Adarxhg-07/Ai_based_Attendence)
