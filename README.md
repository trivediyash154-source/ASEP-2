# VAAHAN AI — Automated Vehicle Enforcement Platform

> Enterprise AI traffic enforcement system. Real-time ANPR · automated challans · live surveillance dashboard.

[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white&style=flat-square)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white&style=flat-square)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white&style=flat-square)](https://nextjs.org)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-7B2FBE?style=flat-square)](https://ultralytics.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white&style=flat-square)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white&style=flat-square)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white&style=flat-square)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)

---

## What It Does

VAAHAN AI is a production-grade smart city enforcement platform that:

| Step | Technology | Description |
|------|-----------|-------------|
| 1 | OpenCV | Captures live video from RTSP/CCTV cameras |
| 2 | YOLOv8 | Detects vehicles (car/motorcycle/truck/bus) |
| 3 | Custom model / Haar | Crops license plate region |
| 4 | EasyOCR + PaddleOCR | Reads plate text with confidence scoring |
| 5 | PostgreSQL + pg_trgm | Validates plate against vehicle registry |
| 6 | `expiry_checker.py` | Checks registration, insurance, PUC expiry |
| 7 | Celery + ReportLab | Issues challan + generates PDF evidence |
| 8 | Twilio / SMTP | Sends SMS + email to vehicle owner |
| 9 | Evidence Store | Saves annotated JPEG frame + plate crop |
| 10 | WebSocket + Redis | Broadcasts real-time events to dashboard |

---

## Quick Start (First Time)

### Prerequisites
- [Docker Desktop](https://docker.com) installed and **running**
- 4 GB RAM minimum (8 GB recommended)
- macOS / Linux / WSL2 on Windows

### One-command start
```bash
git clone https://github.com/your-username/vaahan-ai
cd vaahan-ai
./start.sh
```

The script automatically:
- Creates `.env` with secure random keys
- Builds all Docker images
- Starts all 7 services
- Waits for health checks to pass
- Seeds the database with test data
- Prints the login credentials

**Open: http://localhost**

---

## Every Time You Open VS Code

```bash
# In VS Code terminal (Ctrl + `)
cd "/path/to/asep project2"

# Start everything (takes ~10 seconds if already built)
docker compose up -d

# Check it's running
./start.sh --status
```

---

## Service URLs

| URL | Service | Notes |
|-----|---------|-------|
| **http://localhost** | Main platform | Use this — goes through Nginx |
| http://localhost:3000 | Frontend direct | Development access |
| http://localhost:8000/docs | FastAPI Swagger | Full API documentation |
| http://localhost:8000/health | Health check | JSON status of all services |
| http://localhost:5555 | Celery Flower | Task queue monitor |

---

## Default Login

```
Email:    admin@enforcement.gov
Password: Admin@1234
```

Other test accounts (created by `seed_db.py`):
```
operator1@enforcement.gov  /  Operator@1234  (Operator role)
viewer@enforcement.gov     /  Viewer@1234    (Viewer role — read only)
```

---

## Stop / Restart

```bash
# Stop all services (keeps data)
./start.sh --stop
# or: docker compose down

# Stop and DELETE all data (fresh start)
./start.sh --fresh

# Check what's running
./start.sh --status
```

---

## Project Structure

```
vaahan-ai/
├── start.sh                     ← ONE-COMMAND STARTUP
├── docker-compose.yml           ← All 7 services
├── .env.example                 ← Template (auto-copied by start.sh)
│
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   ├── detector.py      ← YOLOv8 vehicle + plate detection
│   │   │   ├── ocr.py           ← EasyOCR / PaddleOCR with fallback
│   │   │   ├── preprocessor.py  ← CLAHE, deskew, binarize
│   │   │   ├── pipeline.py      ← Per-camera asyncio pipeline (10-stage)
│   │   │   └── evidence_store.py← JPEG evidence save to disk
│   │   ├── api/v1/routers/      ← FastAPI endpoints
│   │   │   ├── auth.py          ← Login, refresh, /me
│   │   │   ├── cameras.py       ← Camera CRUD + stream start/stop
│   │   │   ├── detections.py    ← Detection history
│   │   │   ├── challans.py      ← Issue, pay, PDF download
│   │   │   ├── analytics.py     ← Dashboard KPIs, timeline
│   │   │   └── websocket.py     ← WS endpoints + Redis relay
│   │   ├── core/
│   │   │   ├── config.py        ← All env vars (typed, validated)
│   │   │   ├── security.py      ← JWT + bcrypt
│   │   │   ├── constants.py     ← Enums, fine amounts, thresholds
│   │   │   └── logging.py       ← structlog JSON logging
│   │   ├── models/              ← SQLAlchemy ORM (UUID PKs)
│   │   ├── repositories/        ← Data access layer
│   │   ├── services/
│   │   │   ├── auth_service.py  ← Login, tokens, account lockout
│   │   │   ├── challan_service.py← Issue + ReportLab PDF
│   │   │   └── expiry_checker.py← Registration/insurance/PUC
│   │   └── workers/tasks/       ← Celery async tasks
│   └── scripts/
│       ├── seed_db.py           ← Create test data
│       ├── validate_pipeline.py ← 22-check test suite
│       ├── test_pipeline.py     ← Static image pipeline test
│       ├── debug_ocr.py         ← OCR confidence debugger
│       └── debug_detection.py   ← YOLO detection debugger
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx                  ← Landing page
│       │   ├── (auth)/login/page.tsx     ← Login
│       │   └── (dashboard)/
│       │       ├── dashboard/            ← Overview
│       │       ├── cameras/              ← Live camera grid
│       │       ├── detections/           ← Detection log
│       │       ├── challans/             ← Challan management
│       │       ├── evidence/             ← Evidence viewer
│       │       ├── analytics/            ← Charts + trends
│       │       └── system/               ← System health
│       ├── components/                   ← Feature-based components
│       └── lib/                          ← API client, hooks, stores
│
└── nginx/                                ← Reverse proxy config
```

---

## How to Test Everything

### 1. Run the full validation suite
```bash
# From inside the backend container
docker exec enforcement-backend python scripts/validate_pipeline.py
```
Runs 22 automated checks: imports, DB, tables, seed data, YOLO, OCR, evidence, challan PDF, JWT.

### 2. Test OCR on a plate image
```bash
docker exec enforcement-backend python scripts/debug_ocr.py /path/to/plate.jpg --show-steps
```
Shows: all candidate reads, confidence scores, preprocessing stages.

### 3. Test YOLO detection on an image
```bash
docker exec enforcement-backend python scripts/debug_detection.py /path/to/car.jpg
```
Shows: detected vehicles, bounding boxes, plate crops, OCR results.

### 4. Test full pipeline on a static image (without live camera)
```bash
docker exec enforcement-backend python scripts/test_pipeline.py /path/to/frame.jpg
# Skip OCR and test with a known plate:
docker exec enforcement-backend python scripts/test_pipeline.py --plate MH14CD5678
```

### 5. Unit tests
```bash
docker exec enforcement-backend pytest tests/ -v --cov=app
```

---

## How to Use the Platform

### Step 1: Log in
Open http://localhost → `admin@enforcement.gov` / `Admin@1234`

### Step 2: View the Dashboard
The overview shows live KPIs, detection timeline (last 24h), live WebSocket feed, and system health.

### Step 3: Start a Camera
1. Go to **Camera Network**
2. Click **Add Camera** — enter a name, camera ID, and stream URL
3. Click **Start Stream** — the AI pipeline starts automatically

> **For testing without a real camera:** use a video file path or your webcam:
> - Webcam: `rtsp://0` or index `0`
> - Video file: `/path/to/video.mp4`
> - IP camera: `rtsp://username:password@192.168.1.100:554/stream`

### Step 4: Watch Live Detections
- Dashboard → Live Feed shows events in real-time
- Each detection shows plate, confidence, violation status
- Violations auto-generate challans in the background

### Step 5: Check Evidence
Go to **Evidence** → click any thumbnail → full panel with:
- Annotated frame with bounding boxes
- Plate crop with OCR overlay
- Confidence scores, processing time
- Violation details

### Step 6: Manage Challans
Go to **Challans** → see auto-issued challans → download PDF

---

## API Quick Reference

### Authentication
```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@enforcement.gov","password":"Admin@1234"}'

# Use the returned access_token in subsequent requests:
# -H "Authorization: Bearer <token>"
```

### Core Endpoints
```
GET    /api/v1/cameras                   List cameras
POST   /api/v1/cameras                   Register camera
POST   /api/v1/cameras/{id}/start        Start AI stream
POST   /api/v1/cameras/{id}/stop         Stop stream

GET    /api/v1/detections                Detection history (paginated)
GET    /api/v1/detections/stats          24h statistics

POST   /api/v1/challans                  Issue challan manually
GET    /api/v1/challans/{id}/pdf         Download PDF

GET    /api/v1/analytics/dashboard       KPI summary
GET    /api/v1/analytics/timeline        Hourly detection counts
GET    /api/v1/analytics/system          CPU/memory/GPU metrics
```

### WebSocket Channels
```
ws://localhost:8000/ws/detections?token=<jwt>   All detections
ws://localhost:8000/ws/camera/{id}?token=<jwt>  Per-camera feed
ws://localhost:8000/ws/alerts?token=<jwt>        Violations + challans
ws://localhost:8000/ws/metrics?token=<jwt>       System metrics (5s)
```

Full interactive docs: **http://localhost:8000/docs**

---

## Configuration

Edit `.env` after running `./start.sh` for the first time:

```env
# GPU acceleration (requires NVIDIA GPU + CUDA)
GPU_ENABLED=false          # → true for GPU

# OCR engine
OCR_ENGINE=easyocr         # → paddleocr | both

# Frame processing speed
FRAME_SKIP=2               # Process every Nth frame (lower = slower, more accurate)
YOLO_CONFIDENCE_THRESHOLD=0.50

# SMS notifications (optional)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_PHONE_NUMBER=+91xxxxxxxxxx

# Email notifications (optional — use Gmail App Password)
SMTP_USER=your@gmail.com
SMTP_PASSWORD=your-app-password

# Evidence storage
EVIDENCE_RETENTION_DAYS=90   # Auto-delete evidence after N days
```

After changing `.env`:
```bash
docker compose down && docker compose up -d
```

---

## Troubleshooting

### ❌ `docker compose up` fails immediately
```bash
# Check Docker is running
docker info

# Check ports aren't in use
lsof -i :80 -i :8000 -i :5432 -i :6379
```

### ❌ Backend keeps restarting
```bash
# View logs
docker compose logs backend --tail 50

# Common cause: bad .env values
# Solution: delete .env and let start.sh recreate it
rm .env && ./start.sh
```

### ❌ "No module named ultralytics" or "No module named easyocr"
```bash
# Rebuild the backend image (forces pip install)
docker compose build --no-cache backend
docker compose up -d backend
```

### ❌ YOLOv8 model download fails
```bash
# The container needs internet access on first run
# Check connectivity:
docker exec enforcement-backend curl -I https://github.com

# Or manually pre-download:
docker exec enforcement-backend python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

### ❌ OCR reads blank / wrong plates
```bash
# Debug with the OCR tool
docker exec enforcement-backend python scripts/debug_ocr.py /your/plate.jpg --show-steps

# Common causes:
# - Image too dark → adjust CCTV exposure
# - Plate too far → camera must resolve plate characters clearly
# - Wrong angle → plate should be ≤30° from camera
```

### ❌ Dashboard shows no live data
```bash
# 1. Check backend is healthy
curl http://localhost:8000/health

# 2. Verify WebSocket works
# Open browser console: new WebSocket('ws://localhost:8000/ws/metrics?token=<jwt>')

# 3. Check a camera is actually streaming
./start.sh --status
docker compose logs celery-worker --tail 20
```

### ❌ Challan PDF is empty / fails
```bash
# Check reportlab is installed
docker exec enforcement-backend python3 -c "import reportlab; print('OK')"

# If not: rebuild
docker compose build --no-cache backend
```

### ❌ Frontend shows "Verifying session..." forever
```bash
# Clear browser localStorage
# Open DevTools → Application → Local Storage → clear all
# Or open http://localhost/login directly
```

---

## Performance

| Metric | CPU (no GPU) | GPU (CUDA) |
|--------|-------------|-----------|
| Vehicle detection | ~80ms | ~20ms |
| Plate OCR | ~60ms | ~15ms |
| Full pipeline | ~150–200ms | ~40–60ms |
| WS broadcast latency | <5ms | <5ms |
| Concurrent cameras | 5–10 | 30–50 |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   BROWSER (Next.js 14)                  │
│  Dashboard · Cameras · Challans · Evidence · Analytics  │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS + WSS (Nginx)
┌───────────────────▼─────────────────────────────────────┐
│                    FASTAPI BACKEND                       │
│  /api/v1/*  ─── JWT Auth ─── Rate Limit (Redis)        │
│  WebSocket ──── Redis pub/sub relay ────────────────    │
└──────┬─────────────────────────────┬────────────────────┘
       │                             │
┌──────▼──────────┐         ┌───────▼──────────────────┐
│  AI PIPELINE    │         │    CELERY WORKERS         │
│  (asyncio task  │         │  ┌─ process_violation     │
│   per camera)   │         │  ├─ send_sms (Twilio)     │
│  RTSP → YOLO   │──────▶  │  ├─ send_email (SMTP)     │
│  → OCR → DB   │  Celery  │  └─ cleanup_evidence      │
│  → Evidence   │  Queue   └───────────────────────────┘
│  → Persist    │
└──────┬──────────┘
       │
┌──────▼──────────────────────────────────────────────┐
│   POSTGRESQL 16        │        REDIS 7              │
│   users vehicles       │   rate-limit sliding window │
│   cameras detections   │   ws:broadcasts pub/sub     │
│   challans audit_logs  │   celery broker + results   │
└────────────────────────────────────────────────────-─┘
```

---

## License

MIT — see [LICENSE](LICENSE)

---

*Built with real AI models, real databases, and real pipelines. No mocks, no placeholders.*
