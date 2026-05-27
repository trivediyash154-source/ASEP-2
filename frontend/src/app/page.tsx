"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Camera,
  Database,
  FileText,
  Globe,
  Lock,
  Shield,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";

import { LightRaysBackground } from "@/components/landing/LightRaysBackground";
import { cn } from "@/lib/utils";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] },
});

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-stone-50/80 border-b border-stone-200/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-sage-600 shadow-lg shadow-sage-600/20 ring-1 ring-sage-700/30">
              <Shield className="h-4 w-4 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-peach-400 border-[1.5px] border-stone-50" />
            </div>
            <div>
              <span className="font-display text-sm font-bold text-stone-900 tracking-tight">
                VAAHAN AI
              </span>
              <span className="ml-2 text-2xs text-stone-400 hidden sm:inline font-mono uppercase tracking-wider">
                Enforcement Platform
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-stone-500">
            <a href="#features" className="hover:text-stone-900 transition-colors">
              Features
            </a>
            <a href="#architecture" className="hover:text-stone-900 transition-colors">
              Architecture
            </a>
            <a href="#quickstart" className="hover:text-stone-900 transition-colors">
              Quick Start
            </a>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-sage-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-sage-700 transition-all shadow-md shadow-sage-600/15 hover:shadow-lg hover:shadow-sage-600/25"
          >
            Sign In <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-28 overflow-hidden">
        <LightRaysBackground intensity="high" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <motion.div {...fadeUp(0)}>
            <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-xl border border-sage-200/70 rounded-full pl-2 pr-4 py-1.5 text-xs font-semibold text-sage-700 mb-8 shadow-[0_8px_30px_-12px_rgba(127,136,118,0.45)] ring-1 ring-white/60">
              <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-sage-600">
                <span className="absolute inset-0 rounded-full bg-sage-500 opacity-60 animate-ping" />
                <ShieldCheck className="relative h-3 w-3 text-white" />
              </span>
              Smart City AI Enforcement Infrastructure
              <span className="text-2xs font-mono uppercase tracking-[0.16em] text-stone-400">
                v2.6 · live
              </span>
            </div>
          </motion.div>

          <motion.h1
            {...fadeUp(0.08)}
            className="font-display text-5xl md:text-6xl lg:text-[5.4rem] font-bold text-stone-900 leading-[1.02] tracking-tightest mb-6"
          >
            <span className="block">Automated Vehicle</span>
            <span className="relative inline-block mt-1">
              <span
                aria-hidden
                className="absolute -inset-x-6 -inset-y-3 -z-10 rounded-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(127,136,118,0.18) 0%, rgba(196,167,125,0.14) 100%)",
                  filter: "blur(28px)",
                }}
              />
              <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-sage-800 via-sage-600 to-bronze-500">
                Expiry Enforcement
              </span>
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(0.15)}
            className="text-lg md:text-xl text-stone-500 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Enterprise-grade ANPR detection · real-time CCTV monitoring ·
            AI-powered OCR · automated challan generation · live surveillance
            dashboard.
          </motion.p>

          <motion.div {...fadeUp(0.22)} className="flex flex-wrap items-center justify-center gap-3 mb-16">
            <Link
              href="/dashboard"
              className={cn(
                "group relative inline-flex items-center gap-2 font-semibold px-7 py-3.5 rounded-xl transition-all",
                "bg-sage-600 text-white hover:bg-sage-700",
                "shadow-[0_18px_50px_-12px_rgba(127,136,118,0.55)] hover:shadow-[0_26px_60px_-12px_rgba(127,136,118,0.7)]",
                "hover:-translate-y-0.5",
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-b from-white/15 to-transparent"
              />
              Open Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className={cn(
                "inline-flex items-center gap-2 font-semibold px-7 py-3.5 rounded-xl transition-all",
                "bg-white/70 backdrop-blur-xl text-stone-700 border border-stone-200/60",
                "hover:bg-white hover:border-stone-300 hover:-translate-y-0.5",
                "shadow-[0_10px_30px_-12px_rgba(15,23,42,0.18)]",
              )}
            >
              Sign In
            </Link>
          </motion.div>

          {/* Feature badges row — small operational chips */}
          <motion.div
            {...fadeUp(0.26)}
            className="flex flex-wrap items-center justify-center gap-2 mb-10"
          >
            {[
              { icon: Camera, label: "Multi-camera RTSP" },
              { icon: Activity, label: "<250ms inference" },
              { icon: ShieldCheck, label: "RBAC · audit-logged" },
              { icon: Globe, label: "Smart-city scale" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-2xs font-semibold tracking-wide text-stone-600
                           bg-white/60 backdrop-blur-md border border-white/70 ring-1 ring-stone-200/40 shadow-sm"
              >
                <Icon className="h-3 w-3 text-sage-700" />
                {label}
              </span>
            ))}
          </motion.div>

          {/* Stats row — glassmorphism with depth */}
          <motion.div
            {...fadeUp(0.3)}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto"
          >
            {[
              { value: "94.2%", label: "Detection Accuracy", accent: "text-sage-700" },
              { value: "148ms", label: "Avg Processing", accent: "text-bronze-600" },
              { value: "YOLOv8", label: "AI Model", accent: "text-stone-800" },
              { value: "EasyOCR", label: "OCR Engine", accent: "text-stone-800" },
            ].map(({ value, label, accent }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.06, duration: 0.5 }}
                whileHover={{ y: -3 }}
                className={cn(
                  "relative p-4 rounded-2xl text-center overflow-hidden",
                  "bg-white/55 backdrop-blur-xl border border-white/70",
                  "shadow-[0_18px_38px_-18px_rgba(15,23,42,0.25)] ring-1 ring-stone-200/40",
                )}
              >
                {/* Inner highlight */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
                />
                <p className={cn("font-display text-2xl font-bold tabular-nums tracking-tight", accent)}>
                  {value}
                </p>
                <p className="text-2xs text-stone-400 mt-1 font-mono uppercase tracking-widest">
                  {label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="relative py-24 border-y border-stone-200/60">
        <div className="absolute inset-0 bg-gradient-to-b from-stone-100/50 to-stone-50 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          <motion.div {...fadeUp(0)} className="text-center mb-14">
            <p className="text-2xs font-semibold uppercase tracking-[0.20em] text-stone-400 font-mono mb-3">
              Capabilities
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-stone-900 mb-3">
              Complete AI Enforcement Stack
            </h2>
            <p className="text-stone-500 max-w-xl mx-auto">
              Every component production-ready. Real AI models, real database, real
              pipelines.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Camera, color: "text-sage-700", bg: "bg-sage-50 border-sage-200", title: "Multi-Camera RTSP", desc: "Live CCTV ingestion via OpenCV. RTSP/HTTP/USB. Per-camera async AI pipeline with reconnect logic." },
              { icon: Zap, color: "text-bronze-600", bg: "bg-bronze-50 border-bronze-200", title: "YOLOv8 Detection", desc: "Detects 4 vehicle classes. Dedicated plate model with Haar cascade fallback. GPU-accelerated." },
              { icon: FileText, color: "text-sage-600", bg: "bg-sage-50 border-sage-100", title: "Dual-Engine OCR", desc: "EasyOCR + PaddleOCR confidence chain. Position-aware character correction. Tesseract fallback." },
              { icon: ShieldCheck, color: "text-sage-700", bg: "bg-sage-100 border-sage-200", title: "Expiry Validation", desc: "Registration, insurance, PUC checked against PostgreSQL registry. pg_trgm fuzzy matching." },
              { icon: Activity, color: "text-peach-600", bg: "bg-peach-50 border-peach-200", title: "Async Challans", desc: "Idempotent Celery tasks. PDF with evidence photos. ReportLab. Auto SMS + email notifications." },
              { icon: Globe, color: "text-stone-600", bg: "bg-stone-100 border-stone-200", title: "WebSocket Live", desc: "Authenticated WS rooms per camera. Redis pub/sub relay from Celery to browser dashboard." },
              { icon: Database, color: "text-stone-600", bg: "bg-stone-100 border-stone-200", title: "PostgreSQL + Redis", desc: "Async SQLAlchemy 2.0, UUID keys, migrations. Redis for queuing, rate-limiting, pub/sub." },
              { icon: TrendingUp, color: "text-bronze-600", bg: "bg-bronze-50 border-bronze-100", title: "Analytics Dashboard", desc: "7-day trends, camera performance, violation breakdown, AI perf metrics. Recharts." },
              { icon: Lock, color: "text-stone-700", bg: "bg-stone-100 border-stone-200", title: "JWT + RBAC", desc: "Access + refresh token rotation. 4 roles. Sliding-window Redis rate limiter. Audit logs." },
            ].map(({ icon: Icon, color, bg, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.04, duration: 0.45 }}
                className={cn(
                  "group relative rounded-xl border p-5 transition-all duration-200",
                  "bg-white/70 backdrop-blur-sm border-stone-200/60",
                  "shadow-md shadow-stone-900/[0.03]",
                  "hover:shadow-xl hover:shadow-stone-900/[0.06] hover:-translate-y-0.5",
                  "hover:bg-white hover:border-stone-300/60",
                )}
              >
                <div className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg border mb-3", bg)}>
                  <Icon className={cn("h-4 w-4", color)} />
                </div>
                <h3 className="font-display text-sm font-semibold text-stone-900 mb-1.5">
                  {title}
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Architecture ──────────────────────────────────────── */}
      <section id="architecture" className="relative py-24 bg-stone-50">
        <LightRaysBackground intensity="low" />
        <div className="relative max-w-4xl mx-auto px-6">
          <motion.div {...fadeUp(0)} className="text-center mb-12">
            <p className="text-2xs font-semibold uppercase tracking-[0.20em] text-stone-400 font-mono mb-3">
              System Design
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-stone-900 mb-3">
              System Architecture
            </h2>
            <p className="text-stone-500">Production-ready layered design</p>
          </motion.div>
          <motion.div
            {...fadeUp(0.1)}
            className={cn(
              "rounded-2xl p-7 font-mono text-xs leading-relaxed overflow-x-auto",
              "bg-stone-900 text-stone-300",
              "shadow-2xl shadow-stone-900/30 ring-1 ring-white/5",
              "backdrop-blur-xl",
            )}
          >
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
          </motion.div>
        </div>
      </section>

      {/* ── Tech stack ────────────────────────────────────────── */}
      <section className="relative py-14 border-y border-stone-200/60 bg-gradient-to-b from-stone-100/50 to-stone-50">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-2xs font-semibold uppercase tracking-widest text-stone-400 font-mono mb-6">
            Technology Stack
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              "Python 3.11", "FastAPI", "PostgreSQL 16", "Redis 7", "Celery",
              "YOLOv8", "EasyOCR", "OpenCV", "Next.js 14", "TypeScript",
              "Tailwind CSS", "Framer Motion", "Recharts", "Docker", "Nginx",
            ].map((t) => (
              <span
                key={t}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full font-mono transition-all",
                  "bg-white/70 backdrop-blur-sm border border-stone-200/60 text-stone-600",
                  "shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-white",
                )}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quick Start ───────────────────────────────────────── */}
      <section id="quickstart" className="relative py-24 bg-stone-900 overflow-hidden">
        {/* Dark section light rays */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div
            className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[140%] h-[100%] opacity-30"
            style={{
              background: `conic-gradient(
                from 200deg at 50% 0%,
                transparent 0deg,
                rgba(127,136,118,0.15) 15deg,
                transparent 30deg,
                transparent 120deg,
                rgba(196,167,125,0.10) 140deg,
                transparent 160deg,
                transparent 250deg,
                rgba(127,136,118,0.08) 270deg,
                transparent 290deg
              )`,
              filter: "blur(60px)",
            }}
          />
        </div>

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <motion.div {...fadeUp(0)}>
            <p className="text-2xs font-semibold uppercase tracking-[0.20em] text-stone-500 font-mono mb-3">
              Deployment
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-stone-50 mb-3">
              Deploy in 3 Commands
            </h2>
            <p className="text-stone-400 mb-8">
              No manual model downloads. Everything auto-configures.
            </p>
          </motion.div>
          <motion.div
            {...fadeUp(0.1)}
            className={cn(
              "rounded-xl p-5 font-mono text-sm text-left mb-8",
              "bg-stone-950/80 backdrop-blur-md border border-stone-800/60",
              "shadow-2xl shadow-black/20 ring-1 ring-white/5",
            )}
          >
            <p className="text-stone-600 mb-1"># 1. Configure environment</p>
            <p className="text-stone-300">
              cp .env.example .env{" "}
              <span className="text-stone-600"># then edit passwords</span>
            </p>
            <p className="text-stone-600 mt-3 mb-1"># 2. Start everything</p>
            <p className="text-stone-300">docker compose up --build</p>
            <p className="text-stone-600 mt-3 mb-1"># 3. Seed test data</p>
            <p className="text-stone-300">
              docker exec enforcement-backend python scripts/seed_db.py
            </p>
            <p className="text-stone-500 mt-3">
              # Open http://localhost → Login → Cameras → Start Stream
            </p>
          </motion.div>
          <motion.div {...fadeUp(0.18)}>
            <Link
              href="/dashboard"
              className={cn(
                "group inline-flex items-center gap-2 font-bold px-8 py-3.5 rounded-xl transition-all",
                "bg-sage-500 text-white hover:bg-sage-400",
                "shadow-xl shadow-sage-500/20 hover:shadow-2xl hover:shadow-sage-400/30",
                "hover:-translate-y-0.5",
              )}
            >
              Open Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-stone-200/60 py-8 bg-stone-50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-sage-600 shadow-sm">
              <Shield className="h-3 w-3 text-white" />
            </div>
            <span className="font-display text-xs font-bold text-stone-700">
              VAAHAN AI — Enforcement Platform
            </span>
          </div>
          <p className="text-xs text-stone-400 font-mono">
            FastAPI · YOLOv8 · EasyOCR · Next.js 14 · PostgreSQL · Docker
          </p>
        </div>
      </footer>
    </div>
  );
}
