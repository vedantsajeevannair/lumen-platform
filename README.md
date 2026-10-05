# LUMEN — Intelligent Civic Infrastructure Platform

Detect road damage from a citizen's photo, dispatch the right engineer, and verify
the repair — an AI-assisted civic operations platform in a clean three-tier layout.

**Live:** <https://140-238-246-75.sslip.io> · **Android APK:**
<https://140-238-246-75.sslip.io/lumen.apk>

The deployment runs on a single Oracle Cloud Always Free instance in Mumbai
(2 OCPU / 12 GB, Ampere ARM) behind nginx with a Let's Encrypt certificate,
under systemd. Sign in to the operations console with any of the seeded demo
accounts shown on the login page — `supervisor@lumen.gov`, password
`lumen123`. Uninstall any older build before installing the APK: the signing
key changed, so Android will not upgrade in place.

```
lumen-platform/
├── frontend/     Vite + React SPA (React Router, Tailwind)      → :5173
├── backend/      Express + Prisma REST API (JWT auth)           → :4000
│   └── ai-service/   FastAPI computer-vision service (YOLO/OpenCV) → :8100
└── database/     Prisma schema, seed, and SQLite database file
```

## Run everything

One command (starts all three tiers):

```bash
./start.sh          # opens http://localhost:5173
```

…or start each tier in its own terminal:

```bash
# 1) AI service
cd backend/ai-service && pip install -r requirements.txt && uvicorn main:app --port 8100

# 2) backend
cd backend && npm install && npm run db:generate && npm run start

# 3) frontend
cd frontend && npm install && npm run dev
```

First-time database setup (creates + seeds `database/lumen.db`):

```bash
cd backend && npm run db:push && npm run db:seed
```

Open **http://localhost:5173** and sign in (password `lumen123`):

| Email | Role |
|---|---|
| admin@lumen.gov | Administrator |
| supervisor@lumen.gov | Supervisor |
| engineer@lumen.gov | Field Engineer |

## Trained models are not in this repository

The four checkpoints the detector runs on are excluded by `.gitignore`
(`**/*.pt`), because they are 5–20 MB binaries that do not belong in git
history. A fresh clone gets every line of code — including `model.py` and the
training scripts — but **the AI service will start without detecting
anything** until the weights are in place.

```
backend/ai-service/weights/civic_best.pt     Garbage Pile       detect
backend/ai-service/models/pothole_best.pt    Pothole            detect
backend/ai-service/models/manhole_best.pt    Open Manhole       detect
backend/ai-service/models/manhole_seg.pt     Open Manhole       segment
```

Two more files are needed and likewise excluded: `mobile_sam.pt`
(MobileSAM, the fallback outline tracer) and
`backend/ai-service/weights/places365.pth.tar` with its
`categories_places365.txt` (the scene gate that rejects photographs which are
not of a street or public place). Neither was trained here; both are
published models.

The deployed instance already has all of them, so
`https://140-238-246-75.sslip.io` detects normally. To run locally, copy the
files from the deployment or retrain with the scripts in
`backend/ai-service/` — `train_multi.py` builds the multi-class detector and
`build_manhole_seg.py` the segmentation model. `GET /health` on the AI
service reports `model_mode: TRAINED` once real weights load, and falls back
to the stock `yolo11n.pt` otherwise.

The training datasets (`backend/ai-service/data/`, ~1.1 GB) and the uploaded
complaint photographs (`backend/uploads/`, ~291 MB) are excluded for the same
reason.

## Civic damage taxonomy

Three civic categories, six damage classes. The detected class decides the
severity weighting **and the department the complaint is routed to**.

| Category | Classes | Department | SLA |
|---|---|---|---|
| Roads | Pothole, Alligator Crack | Roads & Infrastructure | 48 h |
| Waste | Garbage Pile, Overflowing Bin | Sanitation | 24 h |
| Water | Open Manhole, Closed Manhole | Water Supply | 24 h |

Three of those six have a trained detector behind them today — **Pothole**,
**Open Manhole** and **Garbage Pile**. Alligator Crack, Overflowing Bin and
Closed Manhole are declared in the routing schema but nothing is reported
under them yet.

Severity weights are safety-driven: an open manhole outranks a pothole, which
outranks a garbage pile. Single source of truth:
`backend/ai-service/taxonomy.py` and `backend/src/lib/taxonomy.ts`.
`GET /health` on the AI service returns the live taxonomy, so the table above
can always be checked against the running system.

## The AI features

1. **YOLO11 damage detection and classification** — computer vision localises
   and classifies civic damage, and **auto-routes the complaint to the owning
   department**. Four checkpoints: YOLO11s detectors for Pothole and Open
   Manhole, a YOLO11s-seg model that outlines manholes, and a YOLO11n detector
   for Garbage Pile. MobileSAM traces outlines the segmentation model cannot,
   and a Places365 scene classifier rejects photographs that are not of a
   street or public place.
2. **Explainable duplicate detection** — image embeddings, GPS radius, AI
   category and description overlap become a stored composite duplicate score.
3. **Smart complaint prioritisation** — combines AI severity and confidence
   with department safety rules, nearby hospitals/schools/highways, nearby
   report pressure and complaint age into an explainable 0–100 priority score.
4. **Supervisor sign-off on closure** — an engineer marks work complete and
   the complaint enters `PENDING_REVIEW` until a supervisor approves it. The
   AI service exposes `/compare` for cosine similarity between two embeddings;
   it is used for duplicate detection, not yet for before/after closure.
5. **Optimised assignment** — Hungarian algorithm (O(n³)) minimises total
   dispatch cost.

## How the tiers talk

- The **frontend** calls the **backend** REST API at `/api/*` (same-origin via the Vite
  dev proxy; the auth cookie flows automatically).
- The **backend** owns the database (Prisma) and orchestrates the **AI service** over HTTP
  for detection, embeddings and repair verification.
- The **AI service** reports a `model_mode` — `TRAINED` when any of the project's
  own checkpoints are present, `FALLBACK` for stock COCO weights, or
  `HEURISTIC` for classical OpenCV. The deployment reports `TRAINED`; a clone
  without the weight files will not. The UI badges it so a demo detection is
  never mistaken for a trained model.

## Datasets

Real, published datasets — nothing synthetic. `fetch_datasets.py` downloads them
into `backend/ai-service/data/sources/`:

```bash
cd backend/ai-service
python fetch_datasets.py --list          # sources, sizes, licences
python fetch_datasets.py --get-open      # RDD2022 + TACO (no account needed)
python fetch_datasets.py --get-roboflow  # needs a free ROBOFLOW_API_KEY
```

| Source | Category | Licence | Access |
|---|---|---|---|
| [RDD2022](https://arxiv.org/abs/2209.08538) (13.3 GB) | Roads | CC BY 4.0 | open, direct |
| [TACO](https://github.com/pedropro/TACO) (~1,500 imgs) | Waste | MIT | open, direct |
| Roboflow: potholes / manhole covers / refuse | Roads, Water, Waste | varies | free account → API key |

Roboflow hosts the best small sets for the manhole and refuse classes but its
download API needs a key: sign up at <https://roboflow.com>, then
`export ROBOFLOW_API_KEY=…`.

## Training the detectors

Map each source's class names onto the taxonomy in `SOURCE_MAP`
(`train_multi.py`), then:

```bash
cd backend/ai-service
python train_multi.py --merge     # unify all datasets into one label space
python train_multi.py --train     # fine-tune YOLO on the merged label space
python train_multi.py --report    # per-class mAP for the project report
```

Four checkpoints are in use rather than one. A single multi-class model was
the original plan — a citizen's photo is not pre-labelled, so one detector
across every class is what makes automatic routing possible — but the
manhole and pothole classes measured better as dedicated models with their
own confidence thresholds, which are not portable between them. The thresholds
and the reasoning are recorded in `model.py` beside each weight path.

`build_manhole_seg.py` trains the segmentation model that outlines manholes.

## Architecture note

This is a conventional three-tier separation: a presentation tier (Vite SPA), an
application tier (Express REST API with role-based access control and the optimisation
algorithm), and a data tier (Prisma + SQLite), plus a dedicated computer-vision
microservice. Auth is a JWT in an httpOnly cookie; every state-changing action is written
to an immutable audit log.
