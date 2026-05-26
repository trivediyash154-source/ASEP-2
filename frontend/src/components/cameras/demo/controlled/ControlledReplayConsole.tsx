"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Crosshair, Radio, RotateCcw, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

import { demoApi, type DemoCaseSummary, type DemoReplayPayload } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

import { CaseGallery } from "./CaseGallery";
import { PipelineTimeline } from "./PipelineTimeline";
import { DossierPanel } from "./DossierPanel";

/**
 * Controlled Demo Replay — deterministic counterpart to the live mobile-camera
 * console. The operator picks (or uploads — TBD) a vehicle case; we fetch the
 * pre-computed Detection + Challan from the backend; we play the stages back
 * locally with the latencies the backend returned, so judges see the same
 * pipeline beat by beat every single time. Real DB rows are written and real
 * WS events fire, so dashboards downstream react naturally.
 */
type Phase = "idle" | "loading" | "playing" | "complete" | "error";

export function ControlledReplayConsole() {
  const [cases, setCases] = useState<DemoCaseSummary[] | null>(null);
  const [casesLoading, setCasesLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [selected, setSelected] = useState<DemoCaseSummary | null>(null);
  const [payload, setPayload] = useState<DemoReplayPayload | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);  // stage in flight
  const [doneIdx, setDoneIdx] = useState(-1);      // last completed stage
  const [error, setError] = useState<string | null>(null);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const abortRef = useRef(false);

  // ── Initial case load ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCasesLoading(true);
      try {
        const list = await demoApi.cases();
        if (!cancelled) setCases(list);
      } catch (err) {
        if (!cancelled) {
          setCases([]);
          setError((err as Error)?.message ?? "Failed to load demo cases");
        }
      } finally {
        if (!cancelled) setCasesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Cleanup any in-flight timers on unmount or reset ──────────────
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => () => { clearTimers(); abortRef.current = true; }, [clearTimers]);

  // ── Start a replay ────────────────────────────────────────────────
  const startReplay = useCallback(async (c: DemoCaseSummary) => {
    clearTimers();
    abortRef.current = false;
    setSelected(c);
    setPhase("loading");
    setActiveIdx(-1);
    setDoneIdx(-1);
    setPayload(null);
    setError(null);

    try {
      const result = await demoApi.replay(c.id);
      if (abortRef.current) return;
      setPayload(result);
      setPhase("playing");

      // Schedule stage ticks from latency budgets
      let cumulative = 0;
      result.stages.forEach((stage, idx) => {
        // Stage begins
        const startTimer = setTimeout(() => {
          if (!abortRef.current) setActiveIdx(idx);
        }, cumulative);
        timersRef.current.push(startTimer);

        cumulative += stage.latency_ms;

        // Stage completes
        const endTimer = setTimeout(() => {
          if (!abortRef.current) setDoneIdx(idx);
        }, cumulative);
        timersRef.current.push(endTimer);
      });

      // Final transition to dossier — small pause for the last check to register
      const finishTimer = setTimeout(() => {
        if (!abortRef.current) setPhase("complete");
      }, cumulative + 350);
      timersRef.current.push(finishTimer);

      toast.success("Replay initiated", {
        description: `${c.title} · ${c.plate}`,
        duration: 2200,
      });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err as Error)?.message ?? "Replay failed";
      setError(typeof msg === "string" ? msg : "Replay failed");
      setPhase("error");
    }
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    abortRef.current = true;
    setPhase("idle");
    setSelected(null);
    setPayload(null);
    setActiveIdx(-1);
    setDoneIdx(-1);
    setError(null);
    // Re-enable for the next run
    queueMicrotask(() => { abortRef.current = false; });
  }, [clearTimers]);

  // ── Render ────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="space-y-4">
        <Header
          cases={cases?.length ?? 0}
          eyebrow="Controlled replay"
          title="Curated enforcement scenarios"
          subtitle="Pick a vehicle. Watch the full AI pipeline animate from capture to challan dispatch. Every run writes real database rows and broadcasts to the live dashboards."
        />
        {error && (
          <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 px-3.5 py-2.5 text-sm text-status-danger">
            {error}
          </div>
        )}
        <CaseGallery
          cases={cases ?? []}
          loading={casesLoading}
          onSelect={startReplay}
        />
      </div>
    );
  }

  // loading / playing / complete / error — all show the stage view layout
  return (
    <div className="space-y-3">
      {/* ── Back row ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to case library
        </button>
        {selected && (
          <div className="hidden sm:flex items-center gap-2 text-2xs font-mono uppercase tracking-[0.16em] text-foreground-subtle">
            <span>CASE</span>
            <span className="text-foreground font-semibold">{selected.id}</span>
            <span>·</span>
            <span>{selected.camera_code}</span>
          </div>
        )}
      </div>

      {/* ── Stage view: image + telemetry on left, timeline on right ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-3">
        <StageView
          caseImage={selected?.image ?? "/demo-assets/cases/05-clean-compliance.svg"}
          caseTitle={selected?.title ?? ""}
          payload={payload}
          phase={phase}
          doneIdx={doneIdx}
          activeIdx={activeIdx}
        />
        <div className="surface-panel-elevated p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-peach-600" />
              <span className="section-eyebrow">Pipeline timeline</span>
            </div>
            {phase === "loading" && (
              <span className="font-mono text-2xs uppercase tracking-[0.16em] text-foreground-subtle animate-pulse">Initialising…</span>
            )}
            {phase === "playing" && (
              <span className="font-mono text-2xs uppercase tracking-[0.16em] text-peach-700 dark:text-peach-200">
                Stage {Math.max(activeIdx + 1, 1)} / {payload?.stages.length ?? 10}
              </span>
            )}
            {phase === "complete" && (
              <span className="font-mono text-2xs uppercase tracking-[0.16em] text-sage-700 dark:text-sage-200">
                Complete · {payload?.telemetry.total_latency_ms} ms
              </span>
            )}
          </div>
          {payload ? (
            <PipelineTimeline
              stages={payload.stages}
              activeIndex={activeIdx}
              doneIndex={doneIdx}
            />
          ) : (
            <SkeletonTimeline />
          )}
        </div>
      </div>

      {/* ── Dossier ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "complete" && payload && (
          <DossierPanel payload={payload} onAnother={reset} />
        )}
      </AnimatePresence>

      {phase === "error" && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 px-3.5 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-status-danger">{error ?? "Replay failed"}</p>
            <button
              onClick={() => selected && startReplay(selected)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-status-danger/50 bg-surface text-xs font-semibold text-status-danger hover:bg-status-danger/10"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Header bar ────────────────────────────────────────────────────────

function Header({
  cases,
  eyebrow,
  title,
  subtitle,
}: {
  cases: number;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="surface-panel-elevated p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-6">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-3.5 w-3.5 text-peach-600" />
          <span className="section-eyebrow">{eyebrow}</span>
        </div>
        <h2 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-foreground leading-tight">
          {title}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-foreground-muted max-w-2xl">
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Stat label="Cases" value={String(cases || "—")} />
        <Stat label="Mode" value="DETERMINISTIC" mono />
        <Stat label="Persistence" value="REAL DB" mono />
      </div>
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-1.5 min-w-[88px]">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">{label}</p>
      <p className={cn("mt-0.5 text-sm font-bold text-foreground leading-tight", mono && "font-mono tracking-tight")}>
        {value}
      </p>
    </div>
  );
}

function SkeletonTimeline() {
  return (
    <div className="space-y-3.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-stone-200/40 dark:bg-stone-800/40 animate-pulse" />
          <div className="flex-1 h-4 rounded bg-stone-200/30 dark:bg-stone-800/30 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── Stage view (image + overlays + per-stage HUD) ─────────────────────

function StageView({
  caseImage,
  caseTitle,
  payload,
  phase,
  doneIdx,
  activeIdx,
}: {
  caseImage: string;
  caseTitle: string;
  payload: DemoReplayPayload | null;
  phase: Phase;
  doneIdx: number;
  activeIdx: number;
}) {
  // Which overlays should be visible right now?
  const showVehicleBbox  = doneIdx >= 1 || activeIdx >= 1; // vehicle_localized
  const showPlateBbox    = doneIdx >= 2 || activeIdx >= 2; // plate_isolated
  const showOcrLabel     = doneIdx >= 3; // ocr complete
  const showThreatRibbon = doneIdx >= 6; // threat_scoring complete

  const sevColor =
    payload?.outcome.severity === "critical" ? "border-status-danger text-status-danger" :
    payload?.outcome.severity === "high"     ? "border-[#bd8658] text-[#bd8658]" :
    payload?.outcome.severity === "medium"   ? "border-peach-500 text-peach-700 dark:text-peach-200" :
    payload?.outcome.severity === "low"      ? "border-peach-400 text-peach-600 dark:text-peach-200" :
                                                "border-sage-500 text-sage-700 dark:text-sage-200";

  return (
    <div className="relative surface-panel-elevated overflow-hidden">
      {/* Frame */}
      <div className="relative aspect-[16/9] bg-black">
        <Image
          src={caseImage}
          alt={caseTitle}
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />

        {/* Scan sweep — only during playing */}
        {phase === "playing" && (
          <motion.div
            aria-hidden
            initial={{ y: "-12%" }}
            animate={{ y: "112%" }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
            className="pointer-events-none absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-peach-400/12 to-transparent"
          />
        )}

        {/* Vehicle bbox */}
        <AnimatePresence>
          {showVehicleBbox && payload && (
            <Bbox
              key="vehicle"
              bbox={payload.bounding_box}
              color="rgba(127, 136, 118, 0.95)"
              label={`VEHICLE  ${(payload.telemetry.vehicle_confidence * 100).toFixed(0)}%`}
            />
          )}
        </AnimatePresence>

        {/* Plate bbox */}
        <AnimatePresence>
          {showPlateBbox && payload && (
            <Bbox
              key="plate"
              bbox={payload.plate_bounding_box}
              color="rgba(237, 159, 126, 0.95)"
              label={showOcrLabel ? payload.vehicle.plate : "PLATE"}
              strokeDash="3,3"
            />
          )}
        </AnimatePresence>

        {/* Top-left HUD */}
        <div className="absolute top-3 left-3 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-white/90">
          <Crosshair className="h-3 w-3" />
          <span className="font-bold">{payload?.camera.code ?? "—"}</span>
          <span className="text-white/50">·</span>
          <span className="text-white/70 normal-case tracking-normal">{payload?.camera.name ?? caseTitle}</span>
        </div>

        {/* Top-right LIVE pip */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="flex h-2 w-2 rounded-full bg-status-danger animate-pulse" />
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-white/90">REPLAY</span>
        </div>

        {/* Threat ribbon */}
        <AnimatePresence>
          {showThreatRibbon && payload && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32 }}
              className={cn(
                "absolute bottom-3 left-3 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-black/55 backdrop-blur-sm border",
                sevColor,
              )}
            >
              <span className="font-mono text-2xs font-bold uppercase tracking-[0.18em]">
                THREAT {payload.outcome.threat_score}/100
              </span>
              {payload.outcome.is_violation && (
                <>
                  <span className="text-white/40">·</span>
                  <span className="font-mono text-2xs font-bold uppercase tracking-[0.14em]">
                    {payload.outcome.violation_type}
                  </span>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom-right telemetry */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2 font-mono text-2xs text-white/80">
          <Radio className="h-3 w-3" />
          <span>1920 × 1080 · 30 FPS</span>
        </div>
      </div>
    </div>
  );
}

// Bbox drawn over the image. Coords assumed in 1920×1080 reference frame.
function Bbox({
  bbox,
  color,
  label,
  strokeDash,
}: {
  bbox: { x1: number; y1: number; x2: number; y2: number };
  color: string;
  label: string;
  strokeDash?: string;
}) {
  const left = (bbox.x1 / 1920) * 100;
  const top = (bbox.y1 / 1080) * 100;
  const width = ((bbox.x2 - bbox.x1) / 1920) * 100;
  const height = ((bbox.y2 - bbox.y1) / 1080) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute",
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
        border: `1.5px ${strokeDash ? "dashed" : "solid"} ${color}`,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.35), 0 0 24px -8px ${color}`,
      }}
    >
      <span
        className="absolute -top-[18px] left-0 px-1.5 h-[18px] inline-flex items-center font-mono text-[10px] font-bold tracking-[0.10em] text-black"
        style={{ background: color }}
      >
        {label}
      </span>
    </motion.div>
  );
}
