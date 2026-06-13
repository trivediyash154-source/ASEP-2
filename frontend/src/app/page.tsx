"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, Camera, Cpu, Crosshair, Database,
  FileText, Fingerprint, FolderOpen, Layers, LayoutDashboard, Lock,
  Radio, Scale, ShieldAlert, ShieldCheck, Workflow, Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { LivingNetworkBackground } from "@/components/shared/LivingNetworkBackground";
import { ThemeToggleMini } from "@/components/shared/ThemeToggleMini";

/* ════════════════════════════════════════════════════════════════════
   VAAHAN AI — platform introduction.
   Theme-aware: premium warm-paper light by default, cinematic dark on
   toggle. Embedded pipeline/preview visuals stay dark — they are the
   console screens of the deployment, monitors sitting on paper.
   ════════════════════════════════════════════════════════════════════ */

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

/* ── Simulated pipeline reads for the hero flow ───────────────────── */
const SIM_READS = [
  { plate: "MH12 KT 4821", zone: "Shivajinagar · JM Rd",   status: "CLEAR",             violation: false, conf: 97 },
  { plate: "MH14 EQ 0072", zone: "PCMC · Old Mumbai Hwy",  status: "EXPIRED INSURANCE", violation: true,  conf: 94 },
  { plate: "MH12 AB 7790", zone: "Hinjewadi · Phase 2",    status: "CLEAR",             violation: false, conf: 91 },
  { plate: "MH12 ZX 5544", zone: "Koregaon Park · N Main", status: "EXPIRED PUC",       violation: true,  conf: 89 },
  { plate: "MH14 GH 2310", zone: "Wakad · Expressway Exit", status: "CLEAR",            violation: false, conf: 96 },
];

const PIPE_STAGES = [
  { key: "capture",    label: "CAPTURE",    icon: Camera },
  { key: "detect",     label: "DETECT",     icon: Crosshair },
  { key: "ocr",        label: "OCR",        icon: Zap },
  { key: "compliance", label: "COMPLIANCE", icon: Scale },
  { key: "enforce",    label: "ENFORCE",    icon: FileText },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen text-foreground antialiased">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 glass-warm border-b border-border dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-sage-800 ring-1 ring-sage-500/40 shadow-glow-sage">
              <Crosshair className="h-4 w-4 text-sand-100" strokeWidth={1.75} />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-peach-400 border-[1.5px] border-background" />
            </div>
            <div>
              <span className="font-display text-sm font-bold text-foreground tracking-tight">VAAHAN AI</span>
              <span className="ml-2 text-2xs text-foreground-subtle hidden sm:inline font-mono uppercase tracking-[0.18em]">
                Pune Regional Surveillance Network
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
            <a href="#mission" className="hover:text-foreground transition-colors">Mission</a>
            <a href="#system" className="hover:text-foreground transition-colors">System</a>
            <a href="#impact" className="hover:text-foreground transition-colors">Impact</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleMini />
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-sage-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-sage-500 transition-colors ring-1 ring-sage-500/50"
            >
              Access Console <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ════ SECTION 1 — MISSION HERO ════════════════════════════ */}
      <div className="relative">
        {/* The network, operating behind the mission statement */}
        <LivingNetworkBackground
          opacity={0.45}
          className="[mask-image:linear-gradient(180deg,rgba(0,0,0,0.9)_0%,black_35%,transparent_96%)]"
        />
      <section id="mission" className="relative max-w-7xl mx-auto px-6 pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-sage-300 bg-sage-100/70 dark:border-sage-700/50 dark:bg-sage-900/30 pl-1.5 pr-3.5 py-1 mb-7">
            <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-sage-700">
              <span className="absolute inset-0 rounded-full bg-sage-500 opacity-50 animate-ping" />
              <Radio className="relative h-2.5 w-2.5 text-sand-100" />
            </span>
            <span className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-sage-800 dark:text-sage-300">
              Smart City Pilot · Pune · MH-12 / MH-14
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tightest leading-[1.06] text-foreground">
            AI-powered vehicle intelligence and{" "}
            <span className="text-sage-700 dark:text-sage-300">automated compliance enforcement.</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-foreground-muted leading-relaxed max-w-2xl">
            VAAHAN AI watches the road network the way an officer never could —
            every vehicle, every lane, every hour. Live camera feeds are read by a
            YOLOv8 + OCR pipeline, checked against the compliance registry, and
            converted into court-ready evidence and e-challans in under a tenth
            of a second.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-sage-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-sage-500 transition-colors ring-1 ring-sage-500/50"
            >
              <LayoutDashboard className="h-4 w-4" />
              Access Command Center
            </Link>
            <a
              href="#system"
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg border border-border-strong text-foreground-muted hover:bg-muted hover:text-foreground dark:border-white/10 dark:hover:bg-white/[0.04] transition-colors"
            >
              How the system works
            </a>
          </div>

          {/* Live operational indicators */}
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-status-success opacity-60 animate-ping" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-status-success" />
              </span>
              24 cameras online
            </span>
            <span>12 zones reporting</span>
            <span>AI engine nominal</span>
            <span className="text-sage-700 dark:text-sage-400/80">evidence chain verified</span>
          </div>
        </motion.div>

        {/* Live pipeline flow */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-14"
        >
          <HeroPipeline />
        </motion.div>
      </section>
      </div>

      {/* ════ SECTION 2 — PROBLEM STATEMENT ═══════════════════════ */}
      <section className="relative border-t border-border dark:border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <motion.div {...reveal} className="max-w-2xl mb-10">
            <p className="font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-peach-700 dark:text-peach-400 mb-3">
              The enforcement gap
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Manual enforcement cannot keep pace with the road.
            </h2>
            <p className="mt-3 text-sm text-foreground-muted leading-relaxed">
              India's vehicle population grows faster than any checkpoint can
              scale. Compliance failures stay invisible until they become
              accidents, fraud, or lost revenue — because no human team can
              verify documents at traffic speed.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                icon: ShieldAlert,
                stat: "~1 in 2",
                title: "Vehicles ride uninsured",
                body: "Industry estimates put uninsured two-wheelers near half the fleet. Each one is an unrecoverable liability on the road.",
              },
              {
                icon: AlertTriangle,
                stat: "Expired & unseen",
                title: "Registration / PUC lapses",
                body: "Document expiry is invisible at a glance. A vehicle can run years past its registration or pollution check without ever being stopped.",
              },
              {
                icon: Scale,
                stat: "~40 / shift",
                title: "Manual verification ceiling",
                body: "A checkpoint officer can physically verify only a few dozen vehicles per shift — while thousands pass the same junction every hour.",
              },
              {
                icon: FolderOpen,
                stat: "Paper trails",
                title: "Evidence that doesn't hold",
                body: "Handwritten challans and unverifiable photographs collapse under dispute. Enforcement without evidence is revenue lost in court.",
              },
            ].map((p, i) => (
              <motion.div
                key={p.title}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.07 }}
                className="rounded-xl border border-border bg-surface shadow-card dark:border-white/[0.07] dark:bg-white/[0.025] dark:shadow-none p-5"
              >
                <p.icon className="h-4 w-4 text-peach-600 dark:text-peach-400" />
                <p className="mt-3 font-display text-xl font-semibold text-foreground tabular-nums">{p.stat}</p>
                <p className="mt-1 text-sm font-medium text-foreground">{p.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-foreground-subtle">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SECTION 3 — HOW IT WORKS ════════════════════════════ */}
      <section id="system" className="relative border-t border-border dark:border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <motion.div {...reveal} className="max-w-2xl mb-12">
            <p className="font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-sage-700 dark:text-sage-400 mb-3">
              How VAAHAN AI works
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Camera to challan in 80 milliseconds.
            </h2>
          </motion.div>

          <div className="relative">
            {/* Connector */}
            <div className="hidden lg:block absolute top-[26px] left-[6%] right-[6%] h-px bg-gradient-to-r from-sage-700/0 via-sage-600/50 to-sage-700/0" aria-hidden />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { icon: Camera,    t: "T+0ms",  title: "Live capture",      body: "Junction cameras stream frames from the Pune corridor network — expressway exits to MG Road." },
                { icon: Crosshair, t: "T+12ms", title: "Vehicle lock",      body: "YOLOv8 isolates every vehicle in frame and pins the number-plate region with pixel coordinates." },
                { icon: Zap,       t: "T+38ms", title: "OCR extraction",    body: "EasyOCR resolves the registration mark with a per-character confidence score." },
                { icon: Scale,     t: "T+55ms", title: "Compliance check",  body: "The plate is verified against registry, insurance, PUC and blacklist state in one pass." },
                { icon: FileText,  t: "T+80ms", title: "Evidence + action", body: "Frames are hashed into a tamper-evident archive; violations auto-generate a bilingual e-challan." },
              ].map((s, i) => (
                <motion.div
                  key={s.title}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: i * 0.08 }}
                  className="relative"
                >
                  <div className="relative z-10 flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-sage-300 bg-sage-100/80 dark:border-sage-700/50 dark:bg-sage-900/40 shadow-glow-sage">
                    <s.icon className="h-5 w-5 text-sage-700 dark:text-sage-300" strokeWidth={1.75} />
                  </div>
                  <p className="mt-3 font-mono text-2xs text-bronze-700 dark:text-bronze-300 tabular-nums tracking-[0.1em]">{s.t}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-foreground-subtle">{s.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════ SECTION 4 — IMPACT METRICS ══════════════════════════ */}
      <section id="impact" className="relative border-t border-border dark:border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <motion.div {...reveal} className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <p className="font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-sage-700 dark:text-sage-400 mb-3">
                Pilot programme · cumulative
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                What one corridor network already delivers.
              </h2>
            </div>
            <span className="font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
              PMC + PCMC limits · 12 zones · 24 cameras
            </span>
          </motion.div>

          <div className="grid grid-cols-2 xl:grid-cols-4 divide-x divide-y xl:divide-y-0 divide-border dark:divide-white/[0.06] rounded-xl border border-border bg-surface shadow-card dark:border-white/[0.07] dark:bg-white/[0.02] dark:shadow-none overflow-hidden">
            {[
              { value: "240K+", label: "Vehicles monitored",  sub: "AI reads across the network" },
              { value: "12K+",  label: "Violations detected", sub: "insurance · PUC · registration" },
              { value: "100%",  label: "Evidence integrity",  sub: "hashed, archived, court-ready" },
              { value: "94.2",  label: "Compliance score",    sub: "network-wide · trending up" },
            ].map((m, i) => (
              <motion.div
                key={m.label}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.07 }}
                className="px-6 py-7"
              >
                <p className="font-display text-3xl sm:text-4xl font-semibold text-foreground tabular-nums" style={{ textShadow: "0 0 24px rgba(169,179,148,0.25)" }}>
                  {m.value}
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">{m.label}</p>
                <p className="mt-0.5 font-mono text-2xs text-foreground-subtle">{m.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SECTION 5 — TECHNOLOGY STACK ════════════════════════ */}
      <section className="relative border-t border-border dark:border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <motion.div {...reveal} className="max-w-2xl mb-10">
            <p className="font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-bronze-700 dark:text-bronze-300 mb-3">
              Technology stack
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Production-grade, end to end.
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[
              { name: "YOLOv8",     role: "vehicle detection",   icon: Crosshair },
              { name: "EasyOCR",    role: "plate recognition",   icon: Zap },
              { name: "FastAPI",    role: "control plane",       icon: Workflow },
              { name: "PostgreSQL", role: "evidence store",      icon: Database },
              { name: "Redis",      role: "stream bus",          icon: Radio },
              { name: "Celery",     role: "task pipeline",       icon: Layers },
              { name: "Next.js 14", role: "operations console",  icon: LayoutDashboard },
              { name: "WebSocket",  role: "live intelligence",   icon: Radio },
              { name: "Docker",     role: "deployment",          icon: Cpu },
              { name: "JWT + RBAC", role: "role-gated access",   icon: Lock },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.04 }}
                className="rounded-lg border border-border bg-surface shadow-card hover:border-sage-400 hover:bg-sage-50 dark:border-white/[0.07] dark:bg-white/[0.025] dark:shadow-none dark:hover:border-sage-600/40 dark:hover:bg-sage-900/15 px-4 py-3.5 flex items-center gap-3 transition-colors"
              >
                <t.icon className="h-4 w-4 text-sage-700 dark:text-sage-400 shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-foreground truncate">{t.name}</p>
                  <p className="font-mono text-2xs text-foreground-subtle truncate">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SECTION 6 — SYSTEM ARCHITECTURE ═════════════════════ */}
      <section id="architecture" className="relative border-t border-border dark:border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <motion.div {...reveal} className="max-w-2xl mb-10">
            <p className="font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-sage-700 dark:text-sage-400 mb-3">
              System architecture
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Five layers, one evidence chain.
            </h2>
            <p className="mt-2 text-sm text-foreground-subtle">Select a layer to inspect it.</p>
          </motion.div>

          <motion.div {...reveal}>
            <ArchitectureDiagram />
          </motion.div>
        </div>
      </section>

      {/* ════ SECTION 7 — CONSOLE PREVIEW ═════════════════════════ */}
      <section className="relative border-t border-border dark:border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <motion.div {...reveal} className="max-w-2xl mb-10">
            <p className="font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-peach-700 dark:text-peach-400 mb-3">
              Inside the console
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Four operational surfaces. Zero dashboards.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PreviewCard
              title="Command Center"
              caption="Threat feed · live intelligence · enforcement queue on one zoned wall"
              delay={0}
            >
              <MockCommandCenter />
            </PreviewCard>
            <PreviewCard
              title="Surveillance Wall"
              caption="Live AI feeds with OCR overlays, ceremonies, and an evidence filmstrip"
              delay={0.06}
            >
              <MockSurveillance />
            </PreviewCard>
            <PreviewCard
              title="Evidence Workbench"
              caption="Three-stage forensic bench — frame, vehicle isolation, plate extraction"
              delay={0.12}
            >
              <MockWorkbench />
            </PreviewCard>
            <PreviewCard
              title="Enforcement Case Files"
              caption="Every challan is a case: vehicle, owner, compliance, risk, history"
              delay={0.18}
            >
              <MockCaseFiles />
            </PreviewCard>
          </div>
        </div>
      </section>

      {/* ════ SECTION 8 — FINAL CTA ═══════════════════════════════ */}
      <section className="relative border-t border-border dark:border-white/[0.05]">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <motion.div {...reveal}>
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-800 ring-1 ring-sage-500/40 shadow-glow-sage">
              <Fingerprint className="h-5 w-5 text-sand-100" />
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              The road is already being read.
            </h2>
            <p className="mt-3 text-sm text-foreground-muted max-w-xl mx-auto">
              Step into the Pune Regional Surveillance Network — live feeds,
              forensic evidence, and the enforcement queue, in one command center.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-sage-600 text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-sage-500 transition-colors ring-1 ring-sage-500/50"
              >
                <LayoutDashboard className="h-4 w-4" />
                Access Command Center
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="border-t border-border dark:border-white/[0.05]">
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-3 font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
            <span>VAAHAN AI · Pune Regional Surveillance Network · Smart City Pilot</span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3 w-3" />
              Evidence-grade · RBAC-gated · Audit-logged
            </span>
          </div>
        </footer>
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   HERO PIPELINE — the platform working, on loop. Stage lights walk
   left→right while simulated corridor reads print to the console card.
   ════════════════════════════════════════════════════════════════════ */
function HeroPipeline() {
  const [cycle, setCycle] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStage((s) => {
        if (s >= PIPE_STAGES.length - 1) {
          setCycle((c) => c + 1);
          return 0;
        }
        return s + 1;
      });
    }, 650);
    return () => clearInterval(id);
  }, []);

  const history = [0, 1, 2].map(
    (off) => SIM_READS[(cycle - off + SIM_READS.length * 8) % SIM_READS.length]
  );

  return (
    <div className="rounded-2xl border border-stone-700/60 overflow-hidden shadow-card-lg" style={{ background: "#16130f" }}>
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06]">
        <span className="flex items-center gap-2 font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-stone-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-status-success opacity-60 animate-ping" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-status-success" />
          </span>
          Live pipeline · simulated corridor feed
        </span>
        <span className="font-mono text-2xs text-stone-600 uppercase tracking-[0.14em]">80ms end-to-end</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Stage flow */}
        <div className="p-6 lg:p-8 flex items-center">
          <div className="w-full flex items-center justify-between gap-2">
            {PIPE_STAGES.map((s, i) => {
              const active = i === stage;
              const done = i < stage;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none min-w-0">
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300",
                        active
                          ? "border-sage-400/70 bg-sage-800/70 shadow-glow-sage scale-110"
                          : done
                            ? "border-sage-700/50 bg-sage-900/40"
                            : "border-white/[0.08] bg-white/[0.02]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] transition-colors duration-300",
                          active ? "text-sage-200" : done ? "text-sage-400" : "text-stone-600"
                        )}
                        strokeWidth={1.75}
                      />
                    </div>
                    <span className={cn(
                      "font-mono text-[0.625rem] font-semibold tracking-[0.14em] transition-colors duration-300",
                      active ? "text-sage-300" : done ? "text-stone-400" : "text-stone-600"
                    )}>
                      {s.label}
                    </span>
                  </div>
                  {i < PIPE_STAGES.length - 1 && (
                    <div className="flex-1 mx-2 h-px relative overflow-hidden bg-white/[0.06] rounded-full min-w-[12px]">
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 bg-sage-500/70 transition-all duration-500",
                          i < stage ? "w-full" : "w-0"
                        )}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Console card */}
        <div className="border-t lg:border-t-0 lg:border-l border-white/[0.06] p-4 font-mono">
          <p className="text-2xs uppercase tracking-[0.16em] text-stone-600 mb-2">Detection log</p>
          <div className="space-y-1.5">
            <AnimatePresence initial={false} mode="popLayout">
              {history.map((r, i) => (
                <motion.div
                  key={`${r.plate}-${cycle - i}`}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: i === 0 ? 1 : 0.55 - i * 0.15, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-2 text-2xs"
                >
                  {r.violation
                    ? <ShieldAlert className="h-3 w-3 text-peach-400 shrink-0" />
                    : <ShieldCheck className="h-3 w-3 text-sage-400 shrink-0" />}
                  <span className="font-bold tracking-wider text-stone-200 shrink-0">{r.plate}</span>
                  <span className={cn(
                    "font-semibold shrink-0",
                    r.violation ? "text-peach-400" : "text-sage-400"
                  )}>
                    {r.status}
                  </span>
                  <span className="text-stone-600 truncate">{r.zone}</span>
                  <span className="ml-auto text-stone-600 tabular-nums shrink-0">{r.conf}%</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="mt-3 pt-2 border-t border-white/[0.06] flex items-center justify-between text-2xs text-stone-600">
            <span>EVD ARCHIVE</span>
            <motion.span key={cycle} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="tabular-nums text-stone-400">
              #{(240318 + cycle).toLocaleString("en-IN")}
            </motion.span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ARCHITECTURE DIAGRAM — selectable layers with an inspector panel.
   ════════════════════════════════════════════════════════════════════ */
const LAYERS = [
  {
    key: "edge",
    label: "EDGE",
    title: "Camera network",
    icon: Camera,
    nodes: ["Junction cameras", "Mobile units", "RTSP / MJPEG ingest"],
    body: "24 cameras across 12 Pune zones stream frames into the platform. Any RTSP or phone camera can join the network — the demo theatre runs on the same path as a roadside unit.",
  },
  {
    key: "ai",
    label: "AI CORE",
    title: "Detection + OCR pipeline",
    icon: Cpu,
    nodes: ["YOLOv8 vehicle lock", "Plate localisation", "EasyOCR extraction"],
    body: "Every frame passes a two-stage model: YOLOv8 isolates vehicles and plate regions, EasyOCR resolves the registration mark with per-character confidence. Sub-100ms per frame on commodity hardware.",
  },
  {
    key: "control",
    label: "CONTROL",
    title: "FastAPI control plane",
    icon: Workflow,
    nodes: ["Compliance engine", "Challan generator", "RBAC + audit log"],
    body: "The control plane verifies each read against registry, insurance, PUC and blacklist state, scores risk, and issues bilingual e-challans. Every action is role-gated and audit-logged.",
  },
  {
    key: "data",
    label: "DATA",
    title: "Evidence store + stream bus",
    icon: Database,
    nodes: ["PostgreSQL evidence", "Redis stream bus", "Celery pipeline"],
    body: "Frames, crops and decisions are hashed into PostgreSQL as a tamper-evident chain. Redis fans events out to every console in real time; Celery handles archival and notification work.",
  },
  {
    key: "console",
    label: "CONSOLE",
    title: "Operations console",
    icon: LayoutDashboard,
    nodes: ["Command center", "Forensic workbench", "Case files"],
    body: "Operators work a zoned command wall, a three-stage evidence bench, and enforcement case files — fed live over WebSocket, navigable end-to-end by keyboard.",
  },
];

function ArchitectureDiagram() {
  const [selected, setSelected] = useState(1);
  const layer = LAYERS[selected];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
      {/* Layer stack */}
      <div className="rounded-xl border border-border bg-surface shadow-card dark:border-white/[0.07] dark:bg-white/[0.02] dark:shadow-none p-4 space-y-2">
        {LAYERS.map((l, i) => {
          const active = i === selected;
          const Icon = l.icon;
          return (
            <button
              key={l.key}
              onClick={() => setSelected(i)}
              className={cn(
                "w-full text-left rounded-lg border px-4 py-3 transition-all duration-200 group",
                active
                  ? "border-sage-500/60 bg-sage-100/70 shadow-glow-sage dark:bg-sage-900/30"
                  : "border-border bg-surface hover:border-border-strong dark:border-white/[0.06] dark:bg-white/[0.015] dark:hover:border-white/[0.14]"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-sage-700 dark:text-sage-300" : "text-foreground-subtle")} strokeWidth={1.75} />
                <span className={cn(
                  "font-mono text-2xs font-bold tracking-[0.16em] w-20 shrink-0",
                  active ? "text-sage-800 dark:text-sage-300" : "text-foreground-subtle"
                )}>
                  {l.label}
                </span>
                <span className={cn("text-sm font-medium flex-1 min-w-0 truncate", active ? "text-foreground" : "text-foreground-muted")}>
                  {l.title}
                </span>
                <div className="hidden sm:flex items-center gap-1.5">
                  {l.nodes.map((n) => (
                    <span
                      key={n}
                      className={cn(
                        "font-mono text-[0.5625rem] px-1.5 py-0.5 rounded border whitespace-nowrap",
                        active ? "border-sage-400 text-sage-800 dark:border-sage-700/60 dark:text-sage-300/90" : "border-border text-foreground-subtle dark:border-white/[0.07]"
                      )}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Inspector */}
      <div className="rounded-xl border border-border bg-surface shadow-card dark:border-white/[0.07] dark:bg-white/[0.02] dark:shadow-none p-5 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={layer.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1"
          >
            <p className="font-mono text-2xs font-bold tracking-[0.18em] text-sage-700 dark:text-sage-400">{layer.label}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-foreground">{layer.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground-muted">{layer.body}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {layer.nodes.map((n) => (
                <span key={n} className="font-mono text-2xs px-2 py-1 rounded-md border border-sage-300 bg-sage-100/70 text-sage-800 dark:border-sage-700/50 dark:bg-sage-900/25 dark:text-sage-300">
                  {n}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
        <p className="mt-4 pt-3 border-t border-border dark:border-white/[0.06] font-mono text-2xs text-foreground-subtle uppercase tracking-[0.14em]">
          One evidence chain · camera to court
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CONSOLE PREVIEWS — stylised screen sketches (no screenshots needed).
   ════════════════════════════════════════════════════════════════════ */
function PreviewCard({ title, caption, delay, children }: {
  title: string; caption: string; delay: number; children: React.ReactNode;
}) {
  return (
    <motion.div
      {...reveal}
      transition={{ ...reveal.transition, delay }}
      className="group rounded-xl border border-border bg-surface shadow-card hover:border-sage-400 dark:border-white/[0.07] dark:bg-white/[0.02] dark:shadow-none dark:hover:border-sage-600/40 overflow-hidden transition-colors"
    >
      <Link href="/login" className="block">
        <div className="relative aspect-[16/8] bg-[#0c0a08] border-b border-stone-800/80 dark:border-white/[0.06] p-3 overflow-hidden">
          {children}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a08]/60 to-transparent pointer-events-none" />
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-2xs text-foreground-subtle truncate">{caption}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-foreground-subtle group-hover:text-sage-700 dark:group-hover:text-sage-400 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}

/* Abstract screen sketches — proportions of the real consoles */
function MockCommandCenter() {
  return (
    <div className="h-full flex flex-col gap-1.5">
      <div className="h-2.5 rounded-sm bg-white/[0.06]" />
      <div className="h-4 rounded-sm bg-white/[0.04] flex gap-1 p-0.5">
        {[...Array(6)].map((_, i) => <div key={i} className="flex-1 rounded-[2px] bg-sage-500/15" />)}
      </div>
      <div className="flex-1 flex gap-1.5 min-h-0">
        <div className="w-1/5 rounded-sm bg-peach-500/10 border border-peach-500/20" />
        <div className="flex-1 rounded-sm bg-sage-500/10 border border-sage-500/25 relative">
          <div className="absolute inset-[20%] rounded-full border border-sage-400/30" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sage-400/70" />
        </div>
        <div className="w-1/4 rounded-sm bg-bronze-500/10 border border-bronze-500/20" />
      </div>
      <div className="h-3.5 rounded-sm bg-white/[0.04]" />
    </div>
  );
}

function MockSurveillance() {
  return (
    <div className="h-full flex gap-1.5">
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex-1 rounded-sm bg-sage-900/40 border border-sage-500/25 relative overflow-hidden">
          <div className="absolute left-[30%] top-[35%] h-1/3 w-1/4 border border-sage-400/60 rounded-[2px]" />
          <div className="absolute left-[34%] top-[58%] h-[8%] w-[14%] border border-peach-400/70 rounded-[1px]" />
          <div className="absolute inset-x-0 top-1/4 h-px bg-sage-400/20" />
        </div>
        <div className="h-1/4 flex gap-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={cn("flex-1 rounded-[2px] border", i === 1 ? "bg-peach-500/15 border-peach-500/30" : "bg-white/[0.04] border-white/[0.06]")} />
          ))}
        </div>
      </div>
      <div className="w-1/4 rounded-sm bg-white/[0.04] border border-white/[0.06]" />
    </div>
  );
}

function MockWorkbench() {
  return (
    <div className="h-full flex flex-col gap-1.5">
      <div className="h-2.5 rounded-sm bg-white/[0.06]" />
      <div className="flex-1 flex gap-1.5 min-h-0">
        <div className="flex-[1.6] rounded-sm bg-sage-900/40 border border-sage-500/25 relative">
          <div className="absolute left-[25%] top-[30%] h-2/5 w-2/5 border border-sage-400/60 rounded-[2px]" />
        </div>
        <div className="flex-1 rounded-sm bg-white/[0.04] border border-white/[0.06]" />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex-1 rounded-sm bg-peach-500/10 border border-peach-500/25" />
          <div className="h-1/3 rounded-sm bg-white/[0.05]" />
        </div>
      </div>
      <div className="h-1/4 flex gap-1.5">
        <div className="flex-1 rounded-sm bg-white/[0.04]" />
        <div className="flex-[1.2] rounded-sm bg-sage-500/10 border border-sage-500/20" />
      </div>
    </div>
  );
}

function MockCaseFiles() {
  return (
    <div className="h-full flex flex-col gap-1">
      <div className="h-4 rounded-sm bg-white/[0.06]" />
      {[
        "bg-peach-500/15 border-l-2 border-peach-500/60",
        "bg-white/[0.04] border-l-2 border-bronze-500/50",
        "bg-white/[0.04] border-l-2 border-sage-500/50",
      ].map((cls, i) => (
        <div key={i} className={cn("flex-1 rounded-sm flex items-center gap-1.5 px-1.5", cls)}>
          <div className="h-1.5 w-8 rounded-full bg-white/[0.12]" />
          <div className="h-1.5 flex-1 rounded-full bg-white/[0.06]" />
          <div className="h-1.5 w-5 rounded-full bg-white/[0.10]" />
        </div>
      ))}
      <div className="flex-[2] rounded-sm bg-white/[0.03] border border-white/[0.06] flex gap-1.5 p-1.5">
        <div className="flex-[1.4] rounded-[2px] bg-white/[0.05]" />
        <div className="flex-1 rounded-[2px] bg-sage-500/10" />
        <div className="w-1/4 rounded-[2px] bg-white/[0.05]" />
      </div>
    </div>
  );
}
