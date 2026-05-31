"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, ScanLine, Type, ShieldCheck, FileWarning, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { StreamFramePayload } from "./LiveStreamCanvas";

/**
 * Horizontal pipeline rail for the live demo console.
 *
 * Lights up stage-by-stage in real time as each frame flows through the ANPR
 * pipeline — turning the invisible ML into something a VIP can watch happen:
 *
 *   DECODE → DETECT (YOLO) → OCR (EasyOCR) → COMPLIANCE (4 checks) → CHALLAN
 *
 * Driven entirely off the WebSocket events the backend already broadcasts
 * (stream_frame, ocr_attempt, plate_read.compliance, enforcement_outcome).
 */

type StageStatus = "idle" | "active" | "done" | "alert";

interface RailCheck {
  status?: string;
}
interface RailCompliance {
  risk_score?: number;
  risk_band?: string;
  enforcement_outcome?: string;
  registration?: RailCheck;
  insurance?: RailCheck;
  puc?: RailCheck;
  blacklist?: RailCheck;
}

interface Props {
  state: "idle" | "connecting" | "live" | "offline" | "reconnecting";
  payload: StreamFramePayload | null;
  /** Bumps on every ocr_attempt WS event. */
  ocrAttemptKey?: number;
}

const CHALLANABLE = new Set(["CHALLAN", "CRITICAL_ALERT"]);

export function PipelineRail({ state, payload, ocrAttemptKey = 0 }: Props) {
  const live = state === "live";
  const isFrame = payload?.type === "stream_frame";
  const dets = isFrame ? payload?.detections?.length ?? 0 : 0;
  const plateText = isFrame ? payload?.plate_read?.plate_text ?? null : null;
  const compliance = (isFrame ? (payload?.plate_read?.compliance as RailCompliance | undefined) : undefined) ?? null;
  const outcome = compliance?.enforcement_outcome;
  const isViolation = !!outcome && CHALLANABLE.has(outcome);

  // OCR pulse — active for ~1.4s after each ocr_attempt.
  const [ocrActive, setOcrActive] = useState(false);
  const ocrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (ocrAttemptKey === 0) return;
    setOcrActive(true);
    if (ocrTimer.current) clearTimeout(ocrTimer.current);
    ocrTimer.current = setTimeout(() => setOcrActive(false), 1400);
    return () => {
      if (ocrTimer.current) clearTimeout(ocrTimer.current);
    };
  }, [ocrAttemptKey]);

  // Risk score count-up.
  const targetRisk = compliance?.risk_score ?? 0;
  const [risk, setRisk] = useState(0);
  useEffect(() => {
    if (!compliance) {
      setRisk(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const dur = 700;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setRisk(Math.round(from + (targetRisk - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [compliance, targetRisk]);

  const stages: { key: string; label: string; icon: typeof Cpu; status: StageStatus; meta?: string }[] = [
    {
      key: "decode",
      label: "DECODE",
      icon: Cpu,
      status: live ? "done" : "idle",
      meta: live ? "frames in" : undefined,
    },
    {
      key: "detect",
      label: "DETECT",
      icon: ScanLine,
      status: dets > 0 ? "done" : live ? "active" : "idle",
      meta: dets > 0 ? `${dets} vehicle${dets > 1 ? "s" : ""}` : "YOLOv8",
    },
    {
      key: "ocr",
      label: "OCR",
      icon: Type,
      status: plateText ? "done" : ocrActive ? "active" : live ? "idle" : "idle",
      meta: plateText ?? "EasyOCR",
    },
    {
      key: "compliance",
      label: "COMPLIANCE",
      icon: ShieldCheck,
      status: compliance ? (isViolation ? "alert" : "done") : plateText ? "active" : "idle",
      meta: compliance ? `risk ${risk}` : "4 checks",
    },
    {
      key: "challan",
      label: "CHALLAN",
      icon: FileWarning,
      status: compliance ? (isViolation ? "alert" : "done") : "idle",
      meta: compliance ? (isViolation ? "ISSUED" : "clear") : undefined,
    },
  ];

  return (
    <div className="surface-panel p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="section-eyebrow">Live pipeline</p>
        <span className="text-2xs font-mono text-foreground-subtle">
          {live ? "STREAMING" : state.toUpperCase()}
        </span>
      </div>

      <div className="flex items-stretch gap-1 sm:gap-2 overflow-x-auto pb-1">
        {stages.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1 sm:gap-2 min-w-0">
            <StageNode stage={s} />
            {i < stages.length - 1 && <Connector active={s.status === "done" || s.status === "alert"} alert={s.status === "alert"} />}
          </div>
        ))}
      </div>

      {/* Compliance sub-checks — animate the four resolving */}
      <AnimatePresence>
        {compliance && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2"
          >
            {([
              ["Registration", compliance.registration?.status],
              ["Insurance", compliance.insurance?.status],
              ["PUC", compliance.puc?.status],
              ["Watchlist", compliance.blacklist?.status],
            ] as const).map(([label, status], idx) => (
              <CheckChip key={label} label={label} status={status} delay={idx * 0.12} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Stage node ──────────────────────────────────────────────────────────────

function StageNode({ stage }: { stage: { label: string; icon: typeof Cpu; status: StageStatus; meta?: string } }) {
  const { label, icon: Icon, status, meta } = stage;
  const cfg: Record<StageStatus, { ring: string; bg: string; text: string; dot: string }> = {
    idle: { ring: "border-border", bg: "bg-surface", text: "text-foreground-subtle", dot: "bg-stone-300" },
    active: { ring: "border-bronze-400/50", bg: "bg-bronze-50 dark:bg-bronze-900/20", text: "text-bronze-700 dark:text-bronze-300", dot: "bg-bronze-400 animate-pulse" },
    done: { ring: "border-sage-400/60", bg: "bg-sage-50 dark:bg-sage-900/25", text: "text-sage-700 dark:text-sage-300", dot: "bg-sage-500" },
    alert: { ring: "border-peach-400/60", bg: "bg-peach-50 dark:bg-peach-900/25", text: "text-peach-700 dark:text-peach-300", dot: "bg-peach-500 animate-pulse" },
  };
  const c = cfg[status];
  return (
    <motion.div
      layout
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 rounded-xl border px-2.5 sm:px-3.5 py-2.5 min-w-[78px] sm:min-w-[104px] shrink-0 transition-colors",
        c.ring, c.bg
      )}
    >
      <span className={cn("absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full", c.dot)} />
      <Icon className={cn("h-4 w-4", c.text)} />
      <span className={cn("text-2xs font-mono font-semibold tracking-[0.14em]", c.text)}>{label}</span>
      {meta && (
        <span className="text-[10px] font-mono text-foreground-subtle truncate max-w-[92px]">{meta}</span>
      )}
    </motion.div>
  );
}

function Connector({ active, alert }: { active: boolean; alert: boolean }) {
  return (
    <div className="relative h-0.5 w-3 sm:w-6 rounded-full bg-border overflow-hidden shrink-0">
      <motion.div
        className={cn("absolute inset-y-0 left-0", alert ? "bg-peach-500" : "bg-sage-500")}
        initial={{ width: "0%" }}
        animate={{ width: active ? "100%" : "0%" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

function CheckChip({ label, status, delay }: { label: string; status?: string; delay: number }) {
  const s = (status ?? "").toUpperCase();
  const bad = s === "EXPIRED" || s === "FLAGGED";
  const warn = s === "EXPIRING_SOON" || s === "OUTSTANDING";
  const ok = s === "VALID" || s === "CLEAR";
  const tone = bad
    ? "border-peach-300 bg-peach-50 text-peach-800 dark:bg-peach-900/25 dark:text-peach-300"
    : warn
    ? "border-bronze-300 bg-bronze-50 text-bronze-800 dark:bg-bronze-900/25 dark:text-bronze-300"
    : ok
    ? "border-sage-300 bg-sage-50 text-sage-800 dark:bg-sage-900/25 dark:text-sage-300"
    : "border-border bg-surface text-foreground-subtle";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.22 }}
      className={cn("flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-2xs font-mono", tone)}
    >
      <span className="font-semibold tracking-[0.06em]">{label}</span>
      <span className="flex items-center gap-0.5">
        {ok && <Check className="h-3 w-3" />}
        {s || "—"}
      </span>
    </motion.div>
  );
}
