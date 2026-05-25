import Link from "next/link";
import {
  Activity, ArrowRight, Camera, Database,
  FileText, Globe, Lock, Shield, ShieldCheck, TrendingUp, Zap,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-50">

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-stone-50/95 backdrop-blur border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-display text-sm font-bold text-stone-900 tracking-tight">VAAHAN AI</span>
              <span className="ml-2 text-xs text-stone-400 hidden sm:inline font-mono">Enforcement Platform</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-stone-500">
            <a href="#features" className="hover:text-stone-900 transition-colors">Features</a>
            <a href="#architecture" className="hover:text-stone-900 transition-colors">Architecture</a>
            <a href="#quickstart" className="hover:text-stone-900 transition-colors">Quick Start</a>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-sage-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-sage-700 transition-colors"
          >
            Sign In <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-warm-mesh pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.16] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #CBCAC0 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-sage-radial opacity-60 pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-sage-50 border border-sage-200 rounded-full px-4 py-1.5 text-xs font-semibold text-sage-700 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-sage-500 animate-pulse" />
            Smart City AI Enforcement Infrastructure
          </div>

          <h1 className="font-display text-5xl md:text-display font-bold text-stone-900 leading-[1.05] tracking-tightest mb-6">
            Automated Vehicle<br />
            <span className="text-sage-600">Expiry Enforcement</span>
          </h1>

          <p className="text-lg text-stone-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Enterprise-grade ANPR detection · real-time CCTV monitoring ·
            AI-powered OCR · automated challan generation · live surveillance dashboard.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-16">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-sage-600 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-sage-700 transition-colors shadow-card-md"
            >
              Open Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white text-stone-700 font-semibold px-7 py-3.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors shadow-card"
            >
              Sign In
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {[
              { value: "94.2%",   label: "Detection Accuracy", accent: "text-sage-700"   },
              { value: "148ms",   label: "Avg Processing",     accent: "text-bronze-600" },
              { value: "YOLOv8",  label: "AI Model",           accent: "text-stone-800"  },
              { value: "EasyOCR", label: "OCR Engine",         accent: "text-stone-800"  },
            ].map(({ value, label, accent }) => (
              <div key={label} className="text-center">
                <p className={`font-display text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
                <p className="text-2xs text-stone-400 mt-1 font-mono uppercase tracking-widest">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-stone-100/60 border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-2xs font-semibold uppercase tracking-[0.20em] text-stone-400 font-mono mb-3">Capabilities</p>
            <h2 className="font-display text-3xl font-bold text-stone-900 mb-3">Complete AI Enforcement Stack</h2>
            <p className="text-stone-500 max-w-xl mx-auto">
              Every component production-ready. Real AI models, real database, real pipelines.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Camera,      color: "text-sage-700",    bg: "bg-sage-50 border-sage-200",     title: "Multi-Camera RTSP",   desc: "Live CCTV ingestion via OpenCV. RTSP/HTTP/USB. Per-camera async AI pipeline with reconnect logic." },
              { icon: Zap,         color: "text-bronze-600",  bg: "bg-bronze-50 border-bronze-200", title: "YOLOv8 Detection",    desc: "Detects 4 vehicle classes. Dedicated plate model with Haar cascade fallback. GPU-accelerated." },
              { icon: FileText,    color: "text-sage-600",    bg: "bg-sage-50 border-sage-100",     title: "Dual-Engine OCR",     desc: "EasyOCR + PaddleOCR confidence chain. Position-aware character correction. Tesseract fallback." },
              { icon: ShieldCheck, color: "text-sage-700",    bg: "bg-sage-100 border-sage-200",    title: "Expiry Validation",   desc: "Registration, insurance, PUC checked against PostgreSQL registry. pg_trgm fuzzy matching." },
              { icon: Activity,    color: "text-peach-600",   bg: "bg-peach-50 border-peach-200",   title: "Async Challans",      desc: "Idempotent Celery tasks. PDF with evidence photos. ReportLab. Auto SMS + email notifications." },
              { icon: Globe,       color: "text-stone-600",   bg: "bg-stone-100 border-stone-200",  title: "WebSocket Live",      desc: "Authenticated WS rooms per camera. Redis pub/sub relay from Celery to browser dashboard." },
              { icon: Database,    color: "text-stone-600",   bg: "bg-stone-100 border-stone-200",  title: "PostgreSQL + Redis",  desc: "Async SQLAlchemy 2.0, UUID keys, migrations. Redis for queuing, rate-limiting, pub/sub." },
              { icon: TrendingUp,  color: "text-bronze-600",  bg: "bg-bronze-50 border-bronze-100", title: "Analytics Dashboard", desc: "7-day trends, camera performance, violation breakdown, AI perf metrics. Recharts." },
              { icon: Lock,        color: "text-stone-700",   bg: "bg-stone-100 border-stone-200",  title: "JWT + RBAC",          desc: "Access + refresh token rotation. 4 roles. Sliding-window Redis rate limiter. Audit logs." },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="bg-white rounded-xl border border-stone-200 p-5 shadow-card hover:shadow-card-md transition-shadow">
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border mb-3 ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <h3 className="font-display text-sm font-semibold text-stone-900 mb-1.5">{title}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture ──────────────────────────────────────── */}
      <section id="architecture" className="py-20 bg-stone-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-2xs font-semibold uppercase tracking-[0.20em] text-stone-400 font-mono mb-3">System Design</p>
            <h2 className="font-display text-3xl font-bold text-stone-900 mb-3">System Architecture</h2>
            <p className="text-stone-500">Production-ready layered design</p>
          </div>
          <div className="bg-stone-900 rounded-2xl p-7 font-mono text-xs text-stone-300 leading-relaxed overflow-x-auto shadow-card-lg">
            <pre className="whitespace-pre">{`Browser  ──────────────────────────────────────────  Next.js 14
            REST API + WebSocket (JWT authenticated)
Nginx  ────────────────────────────────────────────  Reverse Proxy
  │
  ├── FastAPI  ─────  /api/v1/auth │ cameras │ detections
  │                   /api/v1/challans │ analytics │ ws/*
  │
  ├── AI Pipeline (asyncio task per camera)
  │     OpenCV → YOLOv8 → Plate Crop → Preprocess
  │     → EasyOCR → DB Lookup → Expiry Check
  │     → Evidence Save → Detection Persist
  │     → Celery Enqueue → WebSocket Broadcast
  │
  ├── Celery Workers  (queues: ai / notifications / reports)
  │     process_detection_violation  (idempotent)
  │     send_challan_sms  (Twilio E.164)
  │     send_challan_email  (SMTP HTML)
  │
  ├── PostgreSQL 16  ──  users vehicles cameras
  │                       detections challans notifications
  │
  └── Redis 7  ──  rate-limit  ws:broadcasts  celery`}</pre>
          </div>
        </div>
      </section>

      {/* ── Tech stack ────────────────────────────────────────── */}
      <section className="py-12 bg-stone-100/60 border-y border-stone-200">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-2xs font-semibold uppercase tracking-widest text-stone-400 font-mono mb-6">Technology Stack</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              "Python 3.11", "FastAPI", "PostgreSQL 16", "Redis 7", "Celery",
              "YOLOv8", "EasyOCR", "OpenCV", "Next.js 14", "TypeScript",
              "Tailwind CSS", "Framer Motion", "Recharts", "Docker", "Nginx",
            ].map((t) => (
              <span key={t} className="bg-white border border-stone-200 text-stone-600 text-xs px-3 py-1.5 rounded-full shadow-card font-mono">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quick Start ───────────────────────────────────────── */}
      <section id="quickstart" className="py-20 bg-stone-900">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-2xs font-semibold uppercase tracking-[0.20em] text-stone-500 font-mono mb-3">Deployment</p>
          <h2 className="font-display text-3xl font-bold text-stone-50 mb-3">Deploy in 3 Commands</h2>
          <p className="text-stone-400 mb-8">No manual model downloads. Everything auto-configures.</p>
          <div className="bg-stone-950 rounded-xl p-5 font-mono text-sm text-left mb-8 border border-stone-800">
            <p className="text-stone-600 mb-1"># 1. Configure environment</p>
            <p className="text-stone-300">cp .env.example .env  <span className="text-stone-600"># then edit passwords</span></p>
            <p className="text-stone-600 mt-3 mb-1"># 2. Start everything</p>
            <p className="text-stone-300">docker compose up --build</p>
            <p className="text-stone-600 mt-3 mb-1"># 3. Seed test data</p>
            <p className="text-stone-300">docker exec enforcement-backend python scripts/seed_db.py</p>
            <p className="text-stone-500 mt-3"># Open http://localhost → Login → Cameras → Start Stream</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-sage-500 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-sage-600 transition-colors"
          >
            Open Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200 py-8 bg-stone-50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-sage-600">
              <Shield className="h-3 w-3 text-white" />
            </div>
            <span className="font-display text-xs font-bold text-stone-700">VAAHAN AI — Enforcement Platform</span>
          </div>
          <p className="text-xs text-stone-400 font-mono">
            FastAPI · YOLOv8 · EasyOCR · Next.js 14 · PostgreSQL · Docker
          </p>
        </div>
      </footer>
    </div>
  );
}
