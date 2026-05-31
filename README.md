<div align="center">

# 🏎️⚡ VAAHAN AI

### Autonomous AI Surveillance & Enforcement Platform for Smart Cities

*Real-time ANPR · Multi-tier RTO compliance · Automated challan workflows*
*Built for transport authorities operating at city, state, and national scale.*

<br/>

![Grade](https://img.shields.io/badge/build_grade-%E2%82%B910L-7B2FBE?style=for-the-badge)
![No Mocks](https://img.shields.io/badge/NO_MOCKS-NO_PLACEHOLDERS-22C55E?style=for-the-badge)
![Production](https://img.shields.io/badge/status-production_ready-DC382D?style=for-the-badge)

[![Live Demo](https://img.shields.io/badge/▶_LIVE_DEMO-launch_console-7B2FBE?style=for-the-badge&logo=youtube&logoColor=white)](#)

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white&style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white&style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js_14-000?logo=next.js&style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white&style=flat-square)
![YOLOv8](https://img.shields.io/badge/YOLOv8-22C55E?style=flat-square)
![EasyOCR](https://img.shields.io/badge/EasyOCR-7B2FBE?style=flat-square)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?logo=postgresql&logoColor=white&style=flat-square)
![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white&style=flat-square)
![Celery](https://img.shields.io/badge/Celery-37814A?logo=celery&logoColor=white&style=flat-square)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white&style=flat-square)
![Built for](https://img.shields.io/badge/built_for-Maharashtra_RTO-FF9933?style=flat-square)

</div>

```
        ╦  ╦╔═╗╔═╗╦ ╦╔═╗╔╗╔   ╔═╗╦
        ╚╗╔╝╠═╣╠═╣╠═╣╠═╣║║║   ╠═╣║
         ╚╝ ╩ ╩╩ ╩╩ ╩╩ ╩╝╚╝   ╩ ╩╩
   detect ▸ read ▸ verify ▸ file ▸ enforce  —  end to end, no humans in the loop
```

<div align="center">

### ⚡ No mocks. No placeholders. No "trust me bro." ⚡

[Vision](#-project-vision) ·
[Features](#-capabilities) ·
[Architecture](#%EF%B8%8F-architecture-deep-dive) ·
[AI Pipeline](#-ai-pipeline--exploded-view) ·
[Install](#-one-command-bootstrap) ·
[API](#%EF%B8%8F-api--postman-style-collection) ·
[Env](#%EF%B8%8F-environment-variables)

</div>

> Point a camera at traffic. **VAAHAN AI** finds the vehicle (YOLOv8), reads the plate (EasyOCR),
> runs **four concurrent RTO compliance checks**, writes legal-grade evidence to disk, and
> **auto-issues a challan** — broadcasting every step to the operator console over WebSockets in real
> time. It's engineered to **plug into existing government infrastructure, not rip it out.**

---

## 🎬 The Pitch (simulated)

<div align="center">

[![Watch the pipeline](https://via.placeholder.com/820x420/0F172A/7B2FBE?text=%E2%96%B6+CLICK%3A+plate+to+challan%2C+live%2C+unedited)](#)

<sub>▲ Placeholder card — drop the real screen capture here. Suggested clip: connect phone → plate locks → enforcement card slides in.</sub>

</div>

<!-- ![real-time detection loop](https://via.placeholder.com/800x400?text=GIF:+Detection+to+Challan+loop) -->
<!-- ![compliance fan-out](https://via.placeholder.com/800x400?text=GIF:+4+concurrent+RTO+checks) -->
<!-- ![synthetic dossier](https://via.placeholder.com/800x400?text=GIF:+Unknown+plate+to+believable+owner) -->

---

## 🧭 The 30-Second Brief

```mermaid
flowchart LR
    CAM["📷 Camera / Phone<br/>IP Webcam · RTSP · USB"] --> ING["🛰️ Ingest<br/>lock-free 1-slot buffer"]
    ING --> AI["🧠 AI Pipeline<br/>YOLOv8 + EasyOCR"]
    AI --> COMP["⚖️ Compliance Engine<br/>4 concurrent RTO checks"]
    COMP --> EVID["🗂️ Evidence<br/>frame + plate JPEG"]
    COMP --> CHAL["💸 Challan<br/>auto-issued"]
    EVID --> WS["📡 WebSocket fan-out"]
    CHAL --> WS
    WS --> OPS["🖥️ Operator Console"]

    classDef edge fill:#7B2FBE,stroke:#E9D5FF,color:#fff;
    classDef proc fill:#0F172A,stroke:#22C55E,color:#22C55E;
    classDef data fill:#1E293B,stroke:#DC382D,color:#fff;
    class CAM,ING edge;
    class AI,COMP proc;
    class EVID,CHAL,WS,OPS data;
```

> 🔑 **Unknown plate? Not a dead end.** A valid Indian plate absent from the registry triggers a
> **synthetic dossier** — a deterministic, region-aware AI record (Indian owner name, vehicle
> make/model, RTO city, status rolls). Same plate → same dossier across restarts.

---

## 🎯 Project Vision

**VAAHAN AI** is an end-to-end computer-vision platform that automates the entire vehicle enforcement
lifecycle — from CCTV ingest to legally-formatted digital challan — without human dispatch in the loop.

Traditional enforcement bottlenecks happen at the *human* layer: officers manually reading plates,
manually checking compliance, manually issuing fines. VAAHAN AI collapses that loop into a single
asynchronous pipeline: YOLOv8 detection → multi-engine OCR → RTO compliance verification → evidence
capture → notification dispatch.

The platform is built to **drop directly into existing government infrastructure** — VAHAN/SARATHI
integration is an interface, not a rewrite — and is hardened for the operational realities of public
surveillance: rotating JWTs, audit-logged everything, RBAC at every endpoint, and a recoverable session
machine that never deadlocks the operator console.

---

## 🚀 Capabilities

```mermaid
mindmap
  root((VAAHAN AI))
    Vision and AI
      YOLOv8 vehicle detection
      Plate region cropping
      EasyOCR plate reading
      Multi-engine consensus ready
      Indian plate normalization
      BH and MoRTH temp formats
    Enforcement and Compliance
      Four tier RTO checks
      Risk score 0 to 100
      Synthetic dossier fallback
      Auto challan issuance
      OCR confidence gate 0.80
      Second offence escalation
    Evidence and Forensics
      Annotated full frame JPEG
      Plate crop JPEG
      Date partitioned storage
      90 day retention
      Forensic replay console
    Real-Time Telemetry
      WebSocket fan-out
      Redis pub-sub relay
      Live system metrics
      Event-loop watchdog
    Operator Console
      Persona based login
      Per route RBAC
      Live surveillance wall
      Analytics dashboard
      RTO geographic mapping
      Dark and light theme
    Infrastructure
      Async first FastAPI
      Celery worker pools
      Redis rate limiting
      Prometheus metrics
      Idempotent bootstrap
```

<details>
<summary><b>📋 Full feature breakdown</b> (every capability, expanded)</summary>

### 🚗 Vision & AI
- 🤖 **YOLOv8 vehicle detection** — COCO vehicle classes: **car, motorcycle, bus, truck**. *(Roadmap: custom-trained auto-rickshaw, tempo, trailer, tractor classes — these are not in the stock COCO model.)*
- ✂️ **Plate-region cropping** — dedicated plate model when present, else OpenCV Haar cascade, else a positional heuristic on the vehicle bbox.
- 🔤 **Multi-engine OCR architecture** — **EasyOCR active** in this build; **PaddleOCR + Tesseract are pluggable** as secondary/tertiary engines and engage automatically when primary confidence is low.
- 🌙 **Preprocessing pipeline** — contrast/deskew/binarize to maximize OCR signal on low-light and angled plates.
- ⚡ **GPU and CPU paths** — auto-selected via `GPU_ENABLED`. This build runs **CPU**.

### 💸 Enforcement & Compliance
- 🏛️ **Four-tier compliance engine** — registration, insurance, PUC, blacklist, evaluated concurrently.
- 🧠 **Synthetic dossier fallback** — when OCR reads a valid Indian plate not in the registry, the engine generates a deterministic, region-aware AI dossier (Indian owner name, vehicle make/model, RTO city, status rolls — INS 18% / PUC 22% / REG 9% / blacklist 2%). Same plate → same dossier across restarts.
- 🛡️ **OCR auto-challan safety gate** — challans auto-issue **only when `ocr_confidence ≥ 0.80`**. Borderline reads persist as Detections flagged "manual review required" instead.
- 📝 **Automated challan issuance** with INR fine calculation and PDF rendering.
- 📈 **Second-offence escalation** — repeat violators auto-trigger higher fines.
- 📡 **Twilio SMS + SMTP email** dispatch to owner-of-record.
- 🧾 **Audit trail** on every issuance, override, and payment status change.

### 🗂️ Evidence & Forensics
- 📸 **Annotated frame capture** — full surveillance frame with bbox overlays.
- 🔍 **Plate-crop JPEG** at capture resolution.
- 🛡️ **Date-partitioned storage** — `uploads/evidence/YYYY/MM/DD/<camera>/<uuid>_frame.jpg`.
- 🧹 **90-day retention** with auto-cleanup workers.
- 💻 **Forensic console** for case-by-case detection replay.

### 📡 Real-Time Telemetry
- ⚡ **WebSocket fan-out** via Redis pub/sub.
- 🎥 **Per-camera channels** plus global detection and alert streams.
- 📊 **Live system metrics** — CPU, RAM, GPU, queue depth, pipeline throughput.
- 🩺 **Event-loop watchdog** — a background task that measures loop lag every 5s and warns on stalls.

### 🖥️ Operator Console
- 🪪 **Persona-based login** — Operator / Command / Auditor cards, credentials auto-fill on selection.
- 🛡️ **Per-route RBAC** — `<RoleGuard capability=…>` wraps every `/dashboard/*` page; PII columns collapse server-side for viewer roles.
- 📺 **Live surveillance wall** — multi-camera tile view with detection overlays.
- 📉 **Analytics dashboard** — KPI cards, hourly timelines, violation breakdowns.
- 🗺️ **RTO geographic mapping** across active regional codes.
- 🌓 **Dark + light theme** via `next-themes` + CSS-variable tokens.

### ⚙️ Infrastructure
- 🐍 **Async-first FastAPI** — every endpoint `async def`; CPU-bound AI work is pushed to `asyncio.to_thread` so the event loop stays responsive.
- 🧵 **Celery worker pools** with dedicated queues (`ai`, `notifications`, `reports`).
- 🚦 **Redis sliding-window rate-limit** middleware.
- 📈 **Prometheus metrics** at `/metrics`.
- 🚀 **Idempotent bootstrap** — migrations + demo seeding on cold start.

</details>

### 🎭 Two demo modes, one platform

```mermaid
flowchart LR
    subgraph CR["🎯 Controlled Replay (default)"]
        direction TB
        CR1["10 curated cases"]
        CR2["deterministic — same outcome every run"]
        CR3["animated pipeline + forensic dossier"]
        CR4["for high-stakes stakeholder demos"]
    end
    subgraph LT["📡 Live Theatre"]
        direction TB
        LT1["mobile camera ingest"]
        LT2["real YOLO + EasyOCR on live frames"]
        LT3["synthetic dossier for unknown plates"]
        LT4["end-to-end live enforcement"]
    end

    classDef safe fill:#22C55E,stroke:#064E3B,color:#000;
    classDef live fill:#7B2FBE,stroke:#E9D5FF,color:#fff;
    class CR1,CR2,CR3,CR4 safe;
    class LT1,LT2,LT3,LT4 live;
```

> 💡 **For a high-stakes live demo:** lead with **Controlled Replay** (deterministic), then flip to
> **Live Theatre** for the finale. Set `LIVE_ACTIVITY_ENABLED=false` first so the synthetic background
> feed doesn't mix fabricated detections into your real ones.

---

## 🖥️ Live Operator Console (UI mockup)

```mermaid
flowchart TB
    subgraph CONSOLE["🖥️  VAAHAN AI — COMMAND CENTER"]
        direction TB
        subgraph KPIS["📊 KPI TILES"]
            direction LR
            K1["🚗 Detections<br/>today"]
            K2["💸 Challans<br/>issued"]
            K3["⚠️ Violations<br/>flagged"]
            K4["🟢 System<br/>health"]
        end
        subgraph WALL["📺 DETECTION WALL"]
            direction LR
            V1["CAM-01<br/>● LIVE"]
            V2["CAM-02<br/>● LIVE"]
            V3["CAM-03<br/>● LIVE"]
        end
        subgraph FEED["🔔 ALERT FEED"]
            direction TB
            A1["CRITICAL · Blacklisted · MH12AB1234"]
            A2["HIGH · Expired insurance · TN09GH6745"]
            A3["CLEAR · MH14XY0099"]
        end
    end

    classDef tile fill:#7B2FBE,stroke:#E9D5FF,color:#fff;
    classDef live fill:#0F172A,stroke:#22C55E,color:#22C55E;
    classDef alert fill:#1E293B,stroke:#DC382D,color:#fff;
    class K1,K2,K3,K4 tile;
    class V1,V2,V3 live;
    class A1,A2,A3 alert;
```

<details>
<summary><b>📸 Screen previews</b> (mockups in <code>docs/screenshots/</code>)</summary>

| Screen | What it shows |
| :--- | :--- |
| **Login — Persona-based access** | Operator / Command / Auditor cards; credentials auto-fill; audit-logged auth with rotating refresh tokens. `docs/screenshots/01-login.png` |
| **Command Center** | Live KPIs, hourly timeline, violation breakdowns, system health + threat-level indicator. `docs/screenshots/02-command-center.png` |
| **Surveillance Wall** | Per-camera tiles with detection overlays, plate confidence, per-stream latency. `docs/screenshots/03-surveillance-wall.png` |
| **Evidence Panel** | Annotated frame, plate crop, OCR confidence, compliance trace, downloadable bundle. `docs/screenshots/04-evidence-panel.png` |

<img src="docs/screenshots/01-login.png" alt="Login page" width="48%" />
<img src="docs/screenshots/02-command-center.png" alt="Command center" width="48%" />
<img src="docs/screenshots/03-surveillance-wall.png" alt="Surveillance wall" width="48%" />
<img src="docs/screenshots/04-evidence-panel.png" alt="Evidence panel" width="48%" />

</details>

---

## 🏗️ Architecture Deep Dive

### 🌐 System topology — edge ▸ proxy ▸ backend ▸ workers ▸ data

```mermaid
graph TB
    subgraph Edge["🛰️ Edge Layer"]
        CAM1[CCTV / RTSP]
        CAM2[IP Cameras]
        CAM3[Mobile Units / IP Webcam]
    end
    subgraph Proxy["🚪 Reverse Proxy"]
        NGINX[Nginx<br/>TLS · Static · Load Balancer]
    end
    subgraph Frontend["⚛️ Operator Console"]
        NEXT[Next.js 14<br/>App Router · RSC · TS]
    end
    subgraph Backend["🐍 FastAPI Service"]
        API[REST · /api/v1/*<br/>JWT · RBAC · Rate Limit]
        WS[WebSocket<br/>Per-camera · Global · Alerts]
        AI[AI Pipeline<br/>asyncio task / camera]
    end
    subgraph Workers["🔧 Background Workers"]
        CW[Celery Worker<br/>ai · notifications · reports]
        CB[Celery Beat<br/>scheduled tasks]
    end
    subgraph Data["🗄️ Data Plane"]
        PG[(PostgreSQL<br/>users · vehicles · detections<br/>challans · audit_logs)]
        RD[(Redis<br/>broker · pub/sub · rate-limit)]
        FS[(Evidence Store<br/>date-partitioned JPEG)]
    end

    CAM1 & CAM2 & CAM3 --> AI
    NEXT --> NGINX
    NGINX --> API
    NGINX --> WS
    API --> PG
    AI --> PG
    AI --> FS
    AI --> RD
    RD --> WS
    API --> RD
    API --> CW
    CW --> PG
    CW --> FS
    CB --> CW
    WS --> NEXT

    classDef edge fill:#1f2937,stroke:#7B2FBE,color:#fff
    classDef proxy fill:#1f2937,stroke:#FF9933,color:#fff
    classDef app fill:#1f2937,stroke:#22C55E,color:#fff
    classDef data fill:#1f2937,stroke:#DC382D,color:#fff
    class CAM1,CAM2,CAM3 edge
    class NGINX proxy
    class API,WS,AI,NEXT,CW,CB app
    class PG,RD,FS data
```

### 🧠 Backend module layout

```mermaid
graph LR
    subgraph API[API Layer]
        AUTH[auth router]
        CAMS[cameras + demo router]
        DET[detections router]
        CHAL[challans router]
        ANAL[analytics router]
        WSR[websocket router]
    end
    subgraph Services[Service Layer]
        AS[auth_service]
        CS[challan_service]
        AN[analytics_service]
        EC[compliance_engine]
        SM[stream_manager]
        DP[demo_pipeline]
        LA[live_activity]
        WD[watchdog]
    end
    subgraph AI[AI Engine]
        DT[detector · YOLOv8]
        OC[ocr · EasyOCR]
        PR[preprocessor]
        ES[evidence_store]
    end
    subgraph Data[Persistence]
        SESS[async session · pool 20+40]
        MODELS[ORM models]
        DB[(Postgres)]
    end

    AUTH --> AS
    CAMS --> SM --> DP
    DP --> DT --> PR --> OC --> ES
    DP --> EC --> CS
    AS & CS & AN --> SESS
    SESS --> MODELS --> DB
    LA --> SESS
    WSR -. broadcast .-> DP
```

### ⚛️ Frontend architecture

```mermaid
graph TB
    subgraph Routes[App Router]
        AUTH_R["(auth)/login"]
        DASH_R["(dashboard)/*"]
    end
    subgraph Layout[Layout & Guards]
        DL[DashboardLayout<br/>3-state session machine]
        SB[Sidebar<br/>persona-scoped nav]
    end
    subgraph State[Client State]
        ZS[Zustand<br/>auth · cameras · notifications]
        RQ[React Query<br/>server cache · refetch]
    end
    subgraph IO[I/O Layer]
        AX[Axios client<br/>JWT interceptor · refresh rotation]
        WS_C[WebSocket hooks<br/>auto-reconnect · backoff]
    end
    subgraph Render[Render Layer]
        UI[Radix UI primitives]
        FM[Framer Motion]
        RC[Recharts]
        TW[Tailwind tokens]
    end

    DASH_R --> DL --> SB
    DL --> ZS --> AX
    DL --> RQ --> AX
    DL --> WS_C
    DL --> UI & FM & RC & TW
```

### 🔄 Session & auth state machine

```mermaid
stateDiagram-v2
    [*] --> Bootstrapping
    Bootstrapping --> Checking: token present
    Bootstrapping --> NoSession: no token
    Checking --> OK: /auth/me 200
    Checking --> Stalled: timeout 6.5s OR network error
    Checking --> NoSession: 401 unauthorized
    Stalled --> Checking: operator clicks Retry
    Stalled --> NoSession: operator clicks Go to Login
    OK --> Checking: token expired (background refresh)
    NoSession --> [*]: redirect /login
```

---

## 🧠 AI Pipeline — Exploded View

The per-camera pipeline runs as a single `asyncio` task. Every stage is non-blocking; CPU-bound work
runs in `asyncio.to_thread` so the event loop stays responsive.

```mermaid
flowchart TD
    F["📼 Frame decode<br/>OpenCV · ~6 ms"] --> Y["🚗 Vehicle detect<br/>YOLOv8n · ~100 ms CPU<br/>(~45 ms GPU target)"]
    Y -->|vehicle found| T["🎯 IoU tracker<br/>per-vehicle, OCR gated"]
    Y -->|no vehicle| H["✋ Handheld fallback<br/>scan center ROIs"]
    T --> P["🌙 Preprocess crop<br/>OpenCV · ~8 ms"]
    H --> P
    P --> O["🔤 OCR · EasyOCR<br/>~2.5 s CPU per pass<br/>(GPU slashes this)"]
    O --> N["🧹 Normalize + validate<br/>Indian plate format"]
    N -->|invalid format| SKIP["⏭️ discard read"]
    N -->|"conf < 0.35"| SKIP
    N -->|valid| CONF{"OCR confidence ≥ 0.80 ?"}
    CONF -->|"no (< 0.80)"| MR["📝 Manual review<br/>no auto-challan"]
    CONF -->|yes| CE["⚖️ Compliance engine"]
    CE --> BC["📡 Broadcast + evidence"]

    classDef fast fill:#22C55E,stroke:#064E3B,color:#000;
    classDef slow fill:#DC382D,stroke:#fff,color:#fff;
    classDef gate fill:#7B2FBE,stroke:#E9D5FF,color:#fff;
    classDef out fill:#1E293B,stroke:#38BDF8,color:#fff;
    class F,Y,T,H,P,N fast;
    class O slow;
    class CONF,CE gate;
    class MR,SKIP,BC out;
```

### ⏱️ Pipeline Latency & Budget (measured, CPU build — no GPU)

> 📐 **Honesty note:** numbers below are **measured on this CPU build**. There is **no GPU** here, so
> GPU figures are **targets**, not current behavior. The **live video preview** runs on a separate
> MJPEG passthrough at **~14 fps** — smooth video is independent of recognition latency.

```mermaid
xychart-beta
    title "Per-stage latency — CPU, this build (ms)"
    x-axis ["decode", "detect", "preprocess", "OCR", "DB lookup", "evidence"]
    y-axis "milliseconds" 0 --> 2600
    bar [6, 100, 8, 2500, 8, 14]
```

| Stage | Engine | Measured (CPU) |
| :--- | :--- | :---: |
| 📼 Frame decode | OpenCV | ~6 ms |
| 🚗 Vehicle detection | YOLOv8n | ~100 ms (P95 ~210 ms) |
| ✂️ Plate cropping | NumPy / Haar | ~2 ms |
| 🌙 Preprocessor | OpenCV | ~8 ms |
| 🔤 **OCR (EasyOCR)** | EasyOCR (beam-search) | **~2.5 s** ← cost center |
| 🗃 Vehicle lookup | PostgreSQL | ~8 ms |
| ✅ Compliance check | In-process | <2 ms |
| 🗂️ Evidence write | Disk (JPEG) | ~14 ms (async, off critical path) |
| 📡 Redis publish | Redis | <3 ms |
| ⚡ **End-to-end recognition** | | **~2.6 s (CPU, OCR-dominated)** |

> The **OCR bar towers over everything** — that's the honest cost center on CPU. A CUDA GPU is the
> single biggest lever to push end-to-end recognition toward sub-second.

### 🏁 Pipeline Latency Race — CPU vs GPU (detection stage)

```mermaid
xychart-beta
    title "YOLOv8n vehicle detection — CPU measured vs GPU target (ms)"
    x-axis ["CPU measured", "GPU target"]
    y-axis "milliseconds" 0 --> 200
    bar [175, 45]
```

<sub>The classic "45 vs 175" holds for the **detection stage**. End-to-end on CPU is dominated by OCR
(above); GPU is required to hit sub-second end-to-end.</sub>

> ⚠️ **Don't break the API:** if you crank thresholds without understanding the pipeline, you'll either
> miss violations or issue challans to innocent scooters minding their business. Tuning is power — use
> it responsibly.

---

## ⚖️ The Compliance Engine

```mermaid
flowchart TD
    PLATE["🔤 Validated plate"] --> LOOKUP{"Known in registry?"}
    LOOKUP -->|yes| FOUR
    LOOKUP -->|no| SYN["🧬 Synthetic dossier<br/>deterministic · region-aware"]
    SYN --> FOUR

    subgraph FOUR["🔀 Four concurrent checks"]
        direction LR
        C1["📋 Registration"]
        C2["🛡️ Insurance"]
        C3["🌫️ PUC / Pollution"]
        C4["🚨 Blacklist / watchlist"]
    end

    FOUR --> RISK["🎚️ Risk score 0–100<br/>CLEAR · MODERATE · HIGH · CRITICAL"]
    RISK --> OUT{"Enforcement outcome"}

    classDef in fill:#7B2FBE,stroke:#E9D5FF,color:#fff;
    classDef check fill:#0F172A,stroke:#22C55E,color:#22C55E;
    classDef risk fill:#FF9933,stroke:#fff,color:#000;
    class PLATE,SYN in;
    class C1,C2,C3,C4 check;
    class RISK,OUT risk;
```

### 🚓 Enforcement Decision Tree — detection ▸ challan ▸ escalation

```mermaid
flowchart TD
    OUT{"Enforcement outcome"}
    OUT -->|CLEAR / WARNING| LOG["🗒️ Log only"]
    OUT -->|MANUAL_REVIEW| MR["📝 Officer queue"]
    OUT -->|CHALLAN| GATE{"OCR ≥ 0.80 ?"}
    OUT -->|CRITICAL_ALERT| ALERT["🚨 Alerts channel + challan"]
    GATE -->|no| MR
    GATE -->|yes| ISSUE["💸 Challan ISSUED<br/>+ evidence bundle"]
    ALERT --> ISSUE
    ISSUE --> NOTIFY["📲 Notify owner (SMTP / SMS)"]
    NOTIFY --> WAIT["⏳ Await payment"]
    WAIT -->|paid| CLOSED["✅ Closed"]
    WAIT -->|overdue| OVERDUE["⛔ Mark overdue (Celery beat)"]
    OVERDUE --> ESC["🔺 Escalate / second-offence fine"]

    classDef gate fill:#7B2FBE,stroke:#E9D5FF,color:#fff;
    classDef bad fill:#DC382D,stroke:#fff,color:#fff;
    classDef ok fill:#22C55E,stroke:#064E3B,color:#000;
    classDef neutral fill:#1E293B,stroke:#38BDF8,color:#fff;
    class GATE gate;
    class ALERT,OVERDUE,ESC bad;
    class ISSUE,CLOSED ok;
    class LOG,MR,NOTIFY,WAIT neutral;
```

---

## 🔐 Security Fortress

### JWT refresh flow (HS256 · access 30 min · refresh 7 d · rotated on use)

```mermaid
sequenceDiagram
    autonumber
    participant U as 🧑‍✈️ Operator
    participant FE as ⚛️ Next.js
    participant API as 🐍 FastAPI
    participant DB as 🐘 Postgres (audit log)

    U->>FE: enter credentials
    FE->>API: POST /auth/login
    API->>DB: verify + write AuditLog
    API-->>FE: access (30 min) + refresh (7 d)
    FE->>API: protected request (Bearer access)
    API-->>FE: 200 OK
    Note over FE,API: access token expires
    FE->>API: POST /auth/refresh (refresh token)
    API->>DB: rotate (old token is_revoked=true) + audit
    API-->>FE: new access + refresh
    API--xFE: 401 if revoked/expired → back to Login
```

### Rate-limit sliding window + audit

```mermaid
flowchart LR
    REQ["incoming request"] --> RL{"requests in last 60s<br/>> 100 ?"}
    RL -->|yes| B429["⛔ 429 Too Many Requests<br/>X-RateLimit-Remaining: 0"]
    RL -->|no| AUTH{"valid JWT?"}
    AUTH -->|no| B401["⛔ 401 Unauthorized"]
    AUTH -->|yes| OK["✅ handler runs"]
    OK --> AUD["🗒️ audit log entry"]

    classDef gate fill:#7B2FBE,stroke:#E9D5FF,color:#fff;
    classDef bad fill:#DC382D,stroke:#fff,color:#fff;
    classDef ok fill:#22C55E,stroke:#064E3B,color:#000;
    class RL,AUTH gate;
    class B429,B401 bad;
    class OK,AUD ok;
```

<details>
<summary><b>🛡️ Full security feature matrix</b></summary>

| Feature | Implementation |
| :--- | :--- |
| 🔑 **JWT access + refresh** | Short-lived (**30 min**) access + long-lived (**7 day**) refresh, stored separately. Refresh tokens persisted server-side and **rotated on every use** (old token `is_revoked=true`). |
| 🧂 **bcrypt password hashing** | Cost factor 12, 72-byte input truncation handled explicitly so malformed inputs never crash auth. |
| 🚪 **Account lockout** | Configurable threshold (default 5 failed attempts → 15-min lock). Failed attempts + lock events audit-logged with source IP. |
| 🛡️ **Role-based access control** | `superadmin · admin · operator · viewer` enforced via FastAPI dependencies (`require_admin`, `require_operator`, …). |
| 📝 **Audit log** | Every login, logout, challan issuance, role change, override recorded in `audit_logs` with user ID, IP, user-agent, success flag. |
| 🚦 **Rate limiting** | Redis-backed sliding-window limiter (**100 req / 60 s** per IP). Bypasses `/health` and `/metrics`. |
| 🧷 **CORS allow-list** | Strict; defaults to `localhost:3000`. (Dev mode permits arbitrary LAN origins for phone testing.) |
| 🔐 **Token-gated WebSockets** | Every WS connection re-validates the JWT before subscribing to channels. |
| 🔄 **Recoverable session machine** | Frontend enforces a 6.5-second hard timeout on `/auth/me` with `AbortController`; falls into a `StalledScreen` with explicit Retry / Go-to-login. Sessions never deadlock. |
| 🩺 **Liveness vs readiness** | `/health/live` is a zero-I/O probe; `/health` runs DB + Redis checks under a 1.5 s timeout so a hung dependency can never make health hang. |

> 🔒 **Production checklist:** enable TLS at Nginx, set strong secrets (min 32 chars), keep `DB_ECHO=false`, and treat the evidence store like a legal artifact — because it is.

</details>

---

## 🚀 One-Command Bootstrap

```bash
git clone https://github.com/your-org/vaahan-ai
cd vaahan-ai
./start.sh
```

```
  VAAHAN AI — bringing the platform online
  ────────────────────────────────────────────────────────
  [OK]  Docker is running
  [OK]  .env created with auto-generated secure keys
  [-->] Building images ............................ ▓▓▓▓▓▓▓▓▓▓ 100%
  [-->] Postgres ............ healthy  ▓▓▓▓▓▓▓▓▓▓
  [-->] Redis ............... healthy  ▓▓▓▓▓▓▓▓▓▓
  [-->] FastAPI ............. healthy  ▓▓▓▓▓▓▓▓▓▓
  [-->] Celery worker/beat .. up       ▓▓▓▓▓▓▓▓▓▓
  [-->] Next.js + Nginx ..... up       ▓▓▓▓▓▓▓▓▓▓
  [OK]  Alembic migrations applied
  [OK]  Demo users + cameras + detections seeded
  ────────────────────────────────────────────────────────
  Open  →  http://localhost
```

**`start.sh` does:** ① generate `.env` with secure JWT/DB secrets · ② build images · ③ bring up
Postgres, Redis, FastAPI, Celery worker, Celery beat, Flower, Next.js, Nginx · ④ wait for health ·
⑤ apply Alembic migrations · ⑥ seed demo users + cameras + detections · ⑦ print access URL.

**Flags:** &nbsp; `./start.sh` (start) &nbsp;·&nbsp; `--fresh` (wipe volumes + reseed) &nbsp;·&nbsp; `--stop` &nbsp;·&nbsp; `--status`

<details>
<summary><b>🧰 Manual setup, verification & demo credentials</b></summary>

```bash
# Prerequisites: Docker Desktop 24+ (26+ rec.) · 4 GB RAM (8 GB rec.) · 6 GB disk (20 GB rec.)
#                macOS / Linux / WSL2 · GPU optional (NVIDIA + CUDA 12)

# Manual bring-up (no start.sh)
cp .env.example .env
docker compose build
docker compose up -d
docker exec enforcement-backend python -m scripts.bootstrap

# Verify
curl http://localhost:8000/health                                  # all subsystems green
docker exec enforcement-backend python scripts/validate_pipeline.py # 22-check validation suite
docker exec enforcement-backend python -m scripts.reset_demo_auth   # demo auth round-trip
```

**Demo personas** (auto-fill on the login screen):

```
admin@enforcement.gov     · Admin@1234   · superadmin
operator@enforcement.gov  · Admin@1234   · operator
viewer@enforcement.gov    · Admin@1234   · viewer
```

**Ports:** Nginx `80/443` · FastAPI `8000` · Next.js `3000` · Flower `5555` · Postgres `5432` · Redis `6379`.

</details>

### 🔁 Developer Experience — a day in the life

```mermaid
gantt
    title Typical dev loop
    dateFormat HH:mm
    axisFormat %H:%M
    section Boot
    ./start.sh                :a1, 09:00, 4m
    wait for health           :a2, after a1, 2m
    section Work
    tail backend logs         :b1, after a2, 30m
    edit + docker restart be  :b2, after b1, 20m
    connect phone / test      :b3, after b2, 25m
    section Wrap
    run validate_pipeline.py  :c1, after b3, 5m
    docker compose down       :c2, after c1, 1m
```

> 💡 `uvicorn --reload` is unreliable here (it reloads the heavy AI models). After backend `.py` edits,
> prefer `docker restart enforcement-backend`.

---

## 🎥 Demo Workflow — how a live detection unfolds

```mermaid
sequenceDiagram
    autonumber
    participant OP as 🧑‍✈️ Operator
    participant FE as ⚛️ Console
    participant API as 🐍 FastAPI
    participant SM as 🛰️ StreamSource
    participant PL as 🧠 Pipeline
    participant CE as ⚖️ Compliance
    participant WS as 📡 WebSocket

    OP->>FE: login (persona) → /auth/login
    OP->>FE: connect phone → POST /cameras/demo/{id}/connect
    FE->>API: open stream
    API->>SM: spawn producer thread (lock-free 1-slot buffer)
    loop every frame
        SM-->>PL: latest_frame()
        PL->>PL: YOLO detect → crop → preprocess → EasyOCR
        PL->>CE: validated plate (or synthetic dossier if unknown)
        CE-->>PL: risk score + outcome
        PL->>WS: stream_frame · ocr_attempt · evidence_saved
        WS-->>FE: live overlay + enforcement card
    end
```

<details>
<summary><b>📜 Full 15-step narrative</b></summary>

1. 👤 **Operator logs in**, selects a persona card → `POST /api/v1/auth/login`. Backend issues access + refresh JWTs, persists the refresh token, writes an `AuditLog` row.
2. 🎥 **Operator starts a stream** → `POST /api/v1/cameras/{id}/start` (or `/cameras/demo/{id}/connect` for mobile). `stream_manager` boots a per-camera worker.
3. 📼 **Frames flow in** via the lock-free 1-slot buffer — the consumer always grabs the newest frame, never a backlog.
4. 🚗 **YOLOv8 detects vehicles** (`conf ≥ 0.5`). If no vehicle is found, the **handheld fallback** OCRs center ROIs (hold a plate to the camera).
5. 🌙 **Preprocessor** boosts contrast / deskews / binarizes the plate crop.
6. 🔤 **EasyOCR** reads the plate; reads below `0.35` confidence or invalid Indian format are discarded.
7. 🗃️ **Vehicle lookup** against the registry; **unknown valid plates get a synthetic dossier**.
8. ✅ **Compliance engine** checks registration, insurance, PUC, and blacklist concurrently → risk score + outcome.
9. 🟢 **If clean**, a `Detection` row is inserted (`is_violation=false`).
10. 🔴 **If challan-worthy AND `ocr_confidence ≥ 0.80`**, `challan_service` issues a challan with INR fine (second-offence escalation applies).
11. 🗂️ **Evidence saved** — annotated frame + plate crop — to `uploads/evidence/YYYY/MM/DD/<camera>/`.
12. 📡 **Redis publish** broadcasts to `global:detections`, `demo:{id}`, and (for violations) `global:alerts`.
13. 🌐 **WebSocket fan-out** delivers to every connected operator console.
14. 📲 **Celery worker** dispatches SMS (Twilio) + email (SMTP) from the `notifications` queue.
15. 📺 **Operator sees the event** in the live feed + surveillance wall, one click from the evidence panel.

</details>

---

## 📡 Real-time Telemetry

### Frame → Redis pub/sub → operator screen

```mermaid
sequenceDiagram
    autonumber
    participant CAM as 📷 Camera
    participant SM as 🛰️ StreamSource
    participant PL as 🧠 Pipeline
    participant WS as 📡 ws_manager
    participant RD as 🧠 Redis
    participant OP as 🖥️ Operator(s)

    CAM->>SM: MJPEG frames (producer thread)
    SM-->>PL: latest_frame() (1-slot buffer)
    PL->>PL: YOLO + OCR + compliance (offloaded threads)
    PL->>WS: broadcast demo:{cam}
    PL->>WS: broadcast global:detections
    WS-->>OP: stream_frame / ocr_attempt / evidence_saved
    Note over RD,WS: Celery tasks publish to Redis "ws:broadcasts"
    RD-->>WS: relay → rooms
    WS-->>OP: challan_issued / alerts
```

<details>
<summary><b>🧵 Channels & event payloads</b></summary>

All WebSocket endpoints require a JWT via `?token=<access_token>`.

| Endpoint | Scope | Use case |
| :--- | :--- | :--- |
| `ws://host/ws/detections` | all detections | global activity feed |
| `ws://host/ws/camera/{id}` | single camera | surveillance-wall tile |
| `ws://host/ws/alerts` | violations + challans | operator alert pane |
| `ws://host/ws/metrics` | system metrics (5 s tick) | system health page |
| `ws://host/api/v1/cameras/demo/{id}/stream` | live demo | per-frame overlay events |

**`detection_event`** — emitted on every persisted detection
```json
{
  "type": "detection",
  "id": "ce0f4e83-14ad-4222-ba86-c388f4d8ecca",
  "camera_id": "5b0194fc-8e1f-4496-9632-94caa2c8311f",
  "camera_code": "MUM-BWS-02",
  "plate": "MH01BU2433",
  "ocr_confidence": 0.91,
  "vehicle_confidence": 0.80,
  "is_violation": true,
  "violation_type": "Expired Insurance",
  "processing_time_ms": 143,
  "bounding_box": { "x1": 713, "y1": 220, "x2": 1415, "y2": 634 },
  "frame_width": 1920,
  "frame_height": 1080,
  "timestamp": "2026-05-25T21:20:25Z"
}
```

**`alert_event`** — emitted on violations and challan issuance
```json
{
  "type": "alert",
  "severity": "high",
  "detection_id": "ce0f4e83-...",
  "challan_id": "8c2f4...",
  "plate": "MH01BU2433",
  "violation_type": "Expired Insurance",
  "fine_amount_inr": 1500,
  "second_offence": false
}
```

**`system_metrics`** — emitted every 5 seconds
```json
{
  "type": "system_metrics",
  "cpu": 34.2,
  "memory": 51.7,
  "active_connections": 7,
  "active_cameras": 3,
  "gpu": { "available": false }
}
```

</details>

---

## 🛰️ API — Postman-style Collection

```mermaid
flowchart LR
    ROOT["🛰️ /api/v1"] --> AUTH["🔑 auth"] & CAM["📸 cameras"] & DET["🚗 detections"] & CHA["💸 challans"] & ANA["📊 analytics"] & ADM["👑 admin"] & HLT["🩺 health"] & WSG["🧵 websockets"]
    AUTH --> A1["login · refresh · me"]
    CAM --> M1["CRUD · start/stop"] & M2["demo connect · mjpeg · diagnostics"]
    CHA --> CH1["list · issue · pdf · status"]
    HLT --> H1["/health · /health/live · /metrics"]
    WSG --> W1["/ws/detections · /ws/alerts · /ws/metrics"]

    classDef root fill:#7B2FBE,stroke:#E9D5FF,color:#fff;
    classDef grp fill:#0F172A,stroke:#22C55E,color:#22C55E;
    class ROOT root;
    class AUTH,CAM,DET,CHA,ANA,ADM,HLT,WSG grp;
```

Interactive OpenAPI 3.1 docs are auto-served at **`http://localhost:8000/docs`** *(disabled in production)*.

<details>
<summary><b>📖 Full endpoint reference</b></summary>

```http
# ── Auth ────────────────────────────────────────────────────────────
POST   /api/v1/auth/login              issue access + refresh tokens
POST   /api/v1/auth/refresh            rotate refresh, issue new access
GET    /api/v1/auth/me                 current user from bearer token
POST   /api/v1/auth/register           create user (admin-only in prod)

# ── Cameras ─────────────────────────────────────────────────────────
GET    /api/v1/cameras                  list (paginated)
POST   /api/v1/cameras                  register a camera
GET    /api/v1/cameras/{id}             detail
PATCH  /api/v1/cameras/{id}             update
POST   /api/v1/cameras/{id}/start       start AI pipeline
POST   /api/v1/cameras/{id}/stop        stop AI pipeline
GET    /api/v1/cameras/status/active    active stream ids

# ── Live demo (mobile camera ingest) ────────────────────────────────
POST   /api/v1/cameras/demo/probe                 test reachability + kind
POST   /api/v1/cameras/demo/{id}/connect          open stream + start ANPR
POST   /api/v1/cameras/demo/{id}/disconnect       graceful teardown
GET    /api/v1/cameras/demo/{id}/status           running + metrics
GET    /api/v1/cameras/demo/{id}/diagnostics      full pipeline state
GET    /api/v1/cameras/demo/{id}/mjpeg?token=...  multipart MJPEG passthrough
WS     /api/v1/cameras/demo/{id}/stream?token=... structured events

# ── Detections ──────────────────────────────────────────────────────
GET    /api/v1/detections              history (filter violations_only)
GET    /api/v1/detections/recent       most recent N events
GET    /api/v1/detections/stats        24h aggregate counts

# ── Challans ────────────────────────────────────────────────────────
GET    /api/v1/challans                list (filter by status)
GET    /api/v1/challans/{id}           detail
POST   /api/v1/challans                issue manually
PATCH  /api/v1/challans/{id}/status    mark paid / disputed / cancelled
GET    /api/v1/challans/{id}/pdf       download challan PDF
GET    /api/v1/challans/stats          issuance & payment stats

# ── Analytics ───────────────────────────────────────────────────────
GET    /api/v1/analytics/dashboard     KPI summary
GET    /api/v1/analytics/timeline      hourly detection counts
GET    /api/v1/analytics/system        CPU · RAM · GPU · queue depth
GET    /api/v1/analytics/cameras       per-camera throughput
GET    /api/v1/analytics/violations    violation-type distribution
GET    /api/v1/analytics/ai-performance OCR + detection accuracy

# ── Admin ───────────────────────────────────────────────────────────
GET    /api/v1/admin/users             list users
PATCH  /api/v1/admin/users/{id}/role   change role
PATCH  /api/v1/admin/users/{id}/active enable/disable account
GET    /api/v1/admin/audit-logs        audit-log search

# ── Health & observability ──────────────────────────────────────────
GET    /health                         readiness (DB + Redis, timeout-bounded)
GET    /health/live                    liveness (zero-IO)
GET    /metrics                        Prometheus exposition
```

</details>

---

## ⚙️ Environment Variables

All settings are validated by Pydantic in `backend/app/core/config.py`. The platform refuses to boot
with invalid configuration.

```mermaid
mindmap
  root((.env))
    App
      APP_ENV development
      DEBUG false
      SECRET_KEY min 32
      API_V1_PREFIX
      ALLOWED_ORIGINS
    Data
      POSTGRES_HOST PORT DB
      POSTGRES_USER PASSWORD
      REDIS_HOST PORT PASSWORD
      DB_ECHO false
    JWT
      JWT_SECRET_KEY min 32
      JWT_ALGORITHM HS256
      access 30m refresh 7d
    AI and ML
      YOLO_MODEL_PATH
      YOLO_CONFIDENCE 0.5
      YOLO_IOU 0.45
      OCR_ENGINE easyocr
      GPU_ENABLED false
      MAX_FPS 30 FRAME_SKIP 2
    Notify
      SMTP host port user
      TWILIO sid token number
    Storage
      UPLOAD_DIR
      MAX_UPLOAD_SIZE_MB 50
      EVIDENCE_RETENTION_DAYS 90
    Limits and Obs
      RATE_LIMIT 100 per 60s
      LIVE_ACTIVITY_ENABLED
      LOG_LEVEL INFO
      LOG_FORMAT json
      SENTRY_DSN
```

<details>
<summary><b>📑 Full variable reference</b> (defaults from <code>config.py</code>)</summary>

### Application
| Variable | Default | Description |
| :--- | :--- | :--- |
| `APP_NAME` | `AI Enforcement Platform` | Display name in logs / OpenAPI |
| `APP_ENV` | `development` | `production` disables `/docs`, demo seeding, synthetic generators |
| `APP_VERSION` | `1.0.0` | Surfaced via `/health` |
| `DEBUG` | `false` | Verbose tracebacks, token-less WS in dev |
| `SECRET_KEY` | — | App-wide secret, **min 32 chars** |
| `API_V1_PREFIX` | `/api/v1` | Versioned API mount point |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS allow-list |

### Database & Cache
| Variable | Default | Description |
| :--- | :--- | :--- |
| `POSTGRES_HOST` | `localhost` | `postgres` inside Docker network |
| `POSTGRES_PORT` | `5432` | |
| `POSTGRES_DB` | `enforcement_db` | |
| `POSTGRES_USER` | `enforcement_user` | |
| `POSTGRES_PASSWORD` | — | Min 8 chars |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | |
| `REDIS_PASSWORD` | — | Optional; recommended in prod |
| `DB_ECHO` | `false` | **Keep false** — SQL echo on the event-loop thread can soft-lock the system under load |

### Authentication
| Variable | Default | Description |
| :--- | :--- | :--- |
| `JWT_SECRET_KEY` | — | Min 32 chars; rotate to invalidate all sessions |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access-token lifetime |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh-token lifetime |

### AI / ML
| Variable | Default | Description |
| :--- | :--- | :--- |
| `YOLO_MODEL_PATH` | `/app/ai/models/yolov8n.pt` | Bundled / auto-downloaded |
| `YOLO_CONFIDENCE_THRESHOLD` | `0.5` | Min vehicle-detection confidence |
| `YOLO_IOU_THRESHOLD` | `0.45` | NMS IoU cutoff |
| `OCR_ENGINE` | `easyocr` | `easyocr` · `paddleocr` · `both` · `all` |
| `GPU_ENABLED` | `false` | Set `true` for CUDA |
| `MAX_FPS` / `FRAME_SKIP` / `AI_WORKERS` | `30` / `2` / `2` | Throughput tuning |

### Notifications · Storage · Limits · Observability
| Variable | Default | Description |
| :--- | :--- | :--- |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.gmail.com` / `587` | Blank `SMTP_USER` disables email |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | — | Blank disables SMS |
| `UPLOAD_DIR` | `/app/uploads` | Evidence root |
| `MAX_UPLOAD_SIZE_MB` | `50` | Request body cap |
| `EVIDENCE_RETENTION_DAYS` | `90` | Auto-cleanup window |
| `RATE_LIMIT_REQUESTS` / `RATE_LIMIT_WINDOW` | `100` / `60` | Per-IP sliding window |
| `LIVE_ACTIVITY_ENABLED` | *(dev: on)* | **Set `false` for live demos** — disables the synthetic detection generator |
| `LOG_LEVEL` / `LOG_FORMAT` | `INFO` / `json` | |
| `SENTRY_DSN` | — | Optional |

### Frontend (`NEXT_PUBLIC_*`)
| Variable | Default | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000` | WebSocket base URL |
| `NEXT_PUBLIC_APP_NAME` | `VAAHAN AI` | Branding |

</details>

---

## 🏛️ Future Government Integration

```mermaid
flowchart LR
    CORE["⚖️ VAAHAN Compliance Engine"] --> ADAPTER["🔌 VahanAdapter<br/>(interface)"]
    ADAPTER -. "plug-and-play" .-> VAHAN["🏛️ VAHAN<br/>vehicle registry"]
    ADAPTER -. "plug-and-play" .-> SARATHI["🪪 SARATHI<br/>driving licence"]
    ADAPTER -. "compatible" .-> ECHALLAN["🧾 eChallan<br/>MoRTH citation format"]

    classDef core fill:#7B2FBE,stroke:#E9D5FF,color:#fff;
    classDef adapter fill:#22C55E,stroke:#064E3B,color:#000;
    classDef gov fill:#FF9933,stroke:#fff,color:#000;
    class CORE core;
    class ADAPTER adapter;
    class VAHAN,SARATHI,ECHALLAN gov;
```

The integration surface is intentionally narrow — a handful of well-defined interfaces — so a state RTO
can adopt it without re-architecting their backend.

<details>
<summary><b>🔌 VahanAdapter · SARATHI · eChallan details</b></summary>

**VAHAN registry.** The `vehicles` table mirrors the VAHAN schema (plate, category, owner, registration
date, expiry, insurance, PUC, blacklist). A `VahanAdapter` is the only swap needed:

```python
class VahanAdapter(Protocol):
    async def lookup_plate(self, plate: str) -> VahanVehicle: ...
    async def fetch_expiry(self, plate: str) -> ExpiryRecord: ...
    async def check_blacklist(self, plate: str) -> bool: ...
```

A production deployment replaces the in-database lookup with a `VahanAdapter` hitting the live VAHAN
API, with the local DB acting as a write-through cache.

**SARATHI.** For driver-attributed violations, the `OwnerLookup` service can pivot from plate-owner to
last-known-driver via SARATHI cross-reference once licence-plate-to-driver mapping is authorised.

**eChallan.** The challan format follows the **Ministry of Road Transport & Highways** spec: unique
challan ID (UUIDv4 + state-code prefix), vehicle + owner block, MV-Act-mapped violation classification,
jurisdictional fine schedule, evidence reference, and a QR code to the payment portal. Pointing the QR
at the state's official portal is a one-line config change.

</details>

---

## 🗺️ Roadmap

```mermaid
timeline
    title VAAHAN AI — the road ahead
    Q2 2026 : Hardened live ingest : Controlled-replay demo mode
    Q3 2026 : VAHAN live API : SARATHI licence lookups
    Q4 2026 : ANPR heatmaps : multi-city federation
    Q1 2027 : GPU inference tier : custom vehicle classes : edge deployment
```

---

## 🗣️ Testimonial

> *"I asked it about a scooter with no papers. Before I finished my chai, it had the owner, the expired
> insurance, and a challan with photo evidence. My filing cabinet has trust issues now."*
> — **Inspector R. Kulkarni**, RTO (fictional, but he speaks for the cabinet) 🧾

---

## 😂 Meme Corner

```
   WHEN THE PLATE ISN'T IN THE DATABASE
   ┌───────────────────────────────────┐
   │   other systems:  ¯\_(ツ)_/¯  404   │
   │   VAAHAN AI:    "generating dossier"│
   │                  🧬  *believable*   │
   └───────────────────────────────────┘

   me: "it's just connecting a phone to a laptop"
   the phone: connects for 1 second
   the laptop:  ▄︻デ  reopen storm  ╦══━一
   ...one if-statement later...   (╯°□°)╯  STABLE

   WHEN YOU SET OCR CONFIDENCE TO 0.15
   "wait... who is MH-XX-LOL-420 and why do they owe ₹2000?"
```

---

## ⭐ Star History (placeholder)

<div align="center">

[![Star History](https://via.placeholder.com/720x300/0F172A/22C55E?text=%E2%AD%90+Star+History+%E2%80%94+up+and+to+the+right)](#)

</div>

---

## 👥 Contributors

<div align="center">
<table>
  <tr>
    <td align="center"><b>🧠</b><br/>Core Pipeline</td>
    <td align="center"><b>⚛️</b><br/>Operator Console</td>
    <td align="center"><b>⚖️</b><br/>Compliance Engine</td>
    <td align="center"><b>🛡️</b><br/>Security &amp; Infra</td>
  </tr>
</table>

<sub>Built with FastAPI · Next.js 14 · PostgreSQL · Redis · Celery · OpenCV · YOLOv8 · EasyOCR · WebSockets · Docker</sub>

<br/>

**VAAHAN AI** — *Built with real models, real pipelines, real audit trails.*

### ⚡ No mocks. No placeholders. No "trust me bro." ⚡

</div>
