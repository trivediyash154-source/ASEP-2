"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Camera, ChevronLeft, ChevronRight,
  Copy, Crosshair, Eye, FileImage, FolderOpen, Image as ImageIcon,
  Lock, MapPin, Radio, Search, Shield, ShieldAlert, ShieldCheck,
  Tag, Target, Zap,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { detectionsApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Detection, PaginatedResponse } from "@/lib/types";
import { getApiUrl } from "@/lib/api/client";

function evidenceUrl(path: string | null | undefined): string | null {
  return path ? `${getApiUrl()}/uploads/${path}` : null;
}

function evdCode(d: Detection): string {
  return `EVD-${String(d.id).replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/* ── Bounding boxes (frame pixel space) ───────────────────────────── */
interface Bbox { x1: number; y1: number; x2: number; y2: number }

function normBox(b?: Record<string, number> | null): Bbox | null {
  if (!b) return null;
  if ([b.x1, b.y1, b.x2, b.y2].every((v) => typeof v === "number") && b.x2 > b.x1 && b.y2 > b.y1) {
    return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
  }
  if ([b.x, b.y, b.width, b.height].every((v) => typeof v === "number") && b.width > 0 && b.height > 0) {
    return { x1: b.x, y1: b.y, x2: b.x + b.width, y2: b.y + b.height };
  }
  return null;
}

/* ── Threat level from confidence ─────────────────────────────────── */
function getThreat(d: Detection): { level: string; cls: string } {
  if (!d.is_violation) return { level: "CLEAR",  cls: "threat-clear" };
  const conf = d.vehicle_confidence ?? 0;
  if (conf >= 0.90)    return { level: "HIGH",   cls: "threat-high" };
  if (conf >= 0.75)    return { level: "MEDIUM", cls: "threat-medium" };
  return                      { level: "LOW",    cls: "threat-low" };
}

/* ── Forensic reasoning narrative — explainability, not decoration ── */
function buildReasoning(d: Detection): string {
  const vConf = d.vehicle_confidence != null ? `${Math.round(d.vehicle_confidence * 100)}%` : "n/a";
  const oConf = d.ocr_confidence != null ? `${Math.round(d.ocr_confidence * 100)}%` : "n/a";
  const plate = d.detected_plate ?? "UNREAD";
  const base =
    `YOLOv8 isolated a ${d.vehicle_category ?? "vehicle"} at ${vConf} confidence. ` +
    `The plate region was cropped and EasyOCR resolved "${plate}" at ${oConf}. `;
  if (!d.is_violation) {
    return base + "Registry lookup verified the vehicle documents as compliant — frame archived, no enforcement action required.";
  }
  const viol = d.violation_type?.replace(/_/g, " ") ?? "violation";
  return base +
    `Registry lookup flagged the document state as ${viol}. ` +
    "The frame was hashed, archived to the evidence chain, and the case was queued for enforcement review.";
}

/* ── Confidence widgets ───────────────────────────────────────────── */
function ConfBadge({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-foreground-subtle font-mono text-2xs">—</span>;
  const pct = Math.round(value * 100);
  const cls = pct >= 85 ? "text-sage-700 dark:text-sage-300 bg-sage-50 dark:bg-sage-900/30 border-sage-200 dark:border-sage-700/40"
    : pct >= 65 ? "text-bronze-700 dark:text-bronze-300 bg-bronze-50 dark:bg-bronze-900/30 border-bronze-200 dark:border-bronze-700/40"
    : "text-peach-700 dark:text-peach-300 bg-peach-50 dark:bg-peach-900/30 border-peach-200 dark:border-peach-700/40";
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-2xs font-mono font-semibold tabular-nums", cls)}>
      {pct}%
    </span>
  );
}

function ConfBar({ value }: { value?: number | null }) {
  const pct = value != null ? Math.round(value * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "h-full rounded-full",
            pct >= 85 ? "bg-sage-500" : pct >= 65 ? "bg-bronze-400" : "bg-peach-500"
          )}
        />
      </div>
      <span className="font-mono text-2xs text-foreground-muted tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function ConfEntry({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-foreground-subtle">{label}</span>
        <ConfBadge value={value} />
      </div>
      <ConfBar value={value} />
    </div>
  );
}

function ForensicRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 gap-3">
      <span className="text-2xs text-foreground-subtle shrink-0">{label}</span>
      <span className="text-xs text-right">{children}</span>
    </div>
  );
}

/* ── Stage chrome ─────────────────────────────────────────────────── */
function StageLabel({ no, label, icon: Icon }: { no: string; label: string; icon: typeof Camera }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="font-mono text-[0.625rem] font-bold tracking-[0.14em] text-sage-700 dark:text-sage-400 bg-sage-50 dark:bg-sage-900/30 border border-sage-200 dark:border-sage-700/40 rounded px-1.5 py-px">
        {no}
      </span>
      <Icon className="h-3 w-3 text-foreground-subtle" />
      <span className="data-label">{label}</span>
    </div>
  );
}

function StagePlaceholder({ icon: Icon, text, className }: { icon: typeof Eye; text: string; className?: string }) {
  return (
    <div className={cn("relative rounded-lg border border-dashed border-border bg-stone-950 flex flex-col items-center justify-center gap-2", className)}>
      <div className="tactical-grid opacity-40" />
      <Icon className="h-6 w-6 text-stone-600 relative z-10" />
      <p className="text-2xs text-stone-500 relative z-10 px-4 text-center">{text}</p>
    </div>
  );
}

/* ── Stage 1: full frame with live AI overlays ────────────────────── */
function FrameWithOverlays({ src, vehicleBox, plateBox, vehicleConf, phase, stamp }: {
  src: string;
  vehicleBox: Bbox | null;
  plateBox: Bbox | null;
  vehicleConf?: number | null;
  phase: number;
  stamp: { code: string; ts: string };
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const pct = (b: Bbox) =>
    dims
      ? {
          left: `${(b.x1 / dims.w) * 100}%`,
          top: `${(b.y1 / dims.h) * 100}%`,
          width: `${((b.x2 - b.x1) / dims.w) * 100}%`,
          height: `${((b.y2 - b.y1) / dims.h) * 100}%`,
        }
      : undefined;

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-stone-950">
      <img
        src={src}
        alt="Evidence frame"
        className="block w-full h-auto"
        onLoad={(e) => {
          const t = e.currentTarget;
          if (t.naturalWidth) setDims({ w: t.naturalWidth, h: t.naturalHeight });
        }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      {phase < 3 && <div className="scan-overlay" />}

      {/* Vehicle lock */}
      {dims && vehicleBox && phase >= 1 && (
        <motion.div
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="absolute border-2 border-sage-400/85 rounded-sm pointer-events-none"
          style={pct(vehicleBox)}
        >
          <span className="absolute -top-[18px] left-0 px-1 py-px bg-sage-500/95 text-stone-950 font-mono text-[0.5625rem] font-bold tracking-[0.1em] whitespace-nowrap rounded-sm">
            VEHICLE{vehicleConf != null ? ` ${Math.round(vehicleConf * 100)}%` : ""}
          </span>
        </motion.div>
      )}

      {/* Plate lock */}
      {dims && plateBox && phase >= 2 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="absolute border-2 border-peach-400/95 pointer-events-none"
          style={pct(plateBox)}
        >
          <span className="absolute -bottom-[18px] left-0 px-1 py-px bg-peach-400/95 text-stone-950 font-mono text-[0.5625rem] font-bold tracking-[0.1em] whitespace-nowrap rounded-sm">
            PLATE
          </span>
        </motion.div>
      )}

      {/* Tactical corners + stamps */}
      <div className="absolute inset-1.5 pointer-events-none">
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-sage-400/50" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-sage-400/50" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-sage-400/50" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-sage-400/50" />
      </div>
      <div className="absolute bottom-2 left-2 glass-dark text-stone-300 text-2xs font-mono px-1.5 py-0.5 rounded">
        {stamp.code}
      </div>
      <div className="absolute bottom-2 right-2 glass-dark text-stone-300 text-2xs font-mono px-1.5 py-0.5 rounded tabular-nums">
        {stamp.ts}
      </div>
    </div>
  );
}

/* ── Stage 2: CSS region crop from the full frame ─────────────────── */
function RegionCrop({ src, box, pad = 0.1, className }: {
  src: string; box: Bbox; pad?: number; className?: string;
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const bw = box.x2 - box.x1;
  const bh = box.y2 - box.y1;
  const x1 = Math.max(0, box.x1 - bw * pad);
  const y1 = Math.max(0, box.y1 - bh * pad);
  const w = box.x2 + bw * pad - x1;
  const h = box.y2 + bh * pad - y1;

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg border border-border bg-stone-950", className)}
      style={{ aspectRatio: `${w} / ${h}` }}
    >
      <img
        src={src}
        alt="Vehicle region"
        onLoad={(e) => {
          const t = e.currentTarget;
          if (t.naturalWidth) setDims({ w: t.naturalWidth, h: t.naturalHeight });
        }}
        className="absolute transition-opacity duration-300"
        style={
          dims
            ? {
                width: `${(dims.w / w) * 100}%`,
                maxWidth: "none",
                left: `${(-x1 / w) * 100}%`,
                top: `${(-y1 / h) * 100}%`,
                opacity: 1,
              }
            : { opacity: 0 }
        }
      />
      <div className="absolute inset-1 pointer-events-none">
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-sage-400/60" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-sage-400/60" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   QUEUE PANE — left column. Compact case rows, search, filter, paging.
   ════════════════════════════════════════════════════════════════════ */
function QueueRow({ detection: d, selected, onClick }: {
  detection: Detection; selected: boolean; onClick: () => void;
}) {
  const frameUrl = evidenceUrl(d.frame_path);
  const threat = getThreat(d);

  return (
    <button
      onClick={onClick}
      data-selected={selected || undefined}
      className={cn(
        "relative w-full text-left flex items-center gap-3 px-4 py-2.5",
        "border-b border-border/60 transition-colors duration-150",
        selected ? "bg-sage-50/80 dark:bg-sage-900/20" : "hover:bg-muted/40"
      )}
    >
      {selected && <span className="severity-rail bg-sage-500" aria-hidden />}

      <div className="relative h-10 w-16 shrink-0 rounded-md overflow-hidden bg-stone-950 border border-stone-900/20">
        {frameUrl ? (
          <img
            src={frameUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <FileImage className="h-4 w-4 text-stone-600 absolute inset-0 m-auto" />
        )}
        {d.is_violation && (
          <span className="absolute top-0 left-0 right-0 h-[2px] bg-peach-500" aria-hidden />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "font-mono text-xs font-bold tracking-wider truncate",
            d.detected_plate ? "text-foreground" : "text-foreground-subtle italic"
          )}>
            {d.detected_plate ?? "UNREAD"}
          </span>
          <span className={cn("font-mono text-2xs font-semibold shrink-0 px-1 rounded border", threat.cls)}>
            {threat.level}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-2xs text-foreground-subtle font-mono truncate">
            {d.is_violation
              ? (d.violation_type?.replace(/_/g, " ") ?? "violation")
              : (d.vehicle_category ?? "compliant")}
          </span>
          <span className="text-2xs text-foreground-subtle font-mono tabular-nums shrink-0">
            {format(new Date(d.timestamp), "HH:mm:ss")}
          </span>
        </div>
      </div>
    </button>
  );
}

function QueueRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60">
      <div className="skeleton h-10 w-16 rounded-md shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-2 w-1/2 rounded" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   FORENSIC WORKBENCH — the three-stage examination surface.
   FULL FRAME → VEHICLE ISOLATION → PLATE EXTRACTION, reasoning below.
   ════════════════════════════════════════════════════════════════════ */
function ForensicWorkspace({ detection: d }: { detection: Detection }) {
  const frameUrl = evidenceUrl(d.frame_path);
  const plateUrl = evidenceUrl(d.plate_crop_path);
  const isViolation = d.is_violation;
  const threat = getThreat(d);
  const vehicleBox = normBox(d.bounding_box);
  const plateBox = normBox(d.plate_bounding_box);

  // AI lock sequence — replays per selected case
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 350);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 1250);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [d.id]);

  const violTypeDisplay = d.violation_type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const timeline = [
    { step: "Vehicle Detected",     icon: Camera,    done: phase >= 1, ts: "T+0ms"  },
    { step: "Plate Region Located", icon: Crosshair, done: phase >= 1, ts: "T+12ms" },
    { step: "OCR Extraction",       icon: Zap,       done: phase >= 2, ts: "T+38ms" },
    { step: "Compliance Check",     icon: Shield,    done: phase >= 2, ts: "T+55ms" },
    { step: "Evidence Archived",    icon: Lock,      done: phase >= 3, ts: "T+62ms" },
    {
      step: isViolation ? "Challan Queued" : "Record Cleared",
      icon: isViolation ? ShieldAlert : ShieldCheck,
      done: phase >= 3, ts: "T+80ms",
    },
  ];

  return (
    <div className="min-w-0">
      {/* ── Case header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border px-5 py-3 glass-warm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle">
            {evdCode(d)}
          </span>
          <span className="h-3 w-px bg-border" />
          {d.detected_plate ? (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(d.detected_plate!);
                toast.success(`Plate ${d.detected_plate} copied`);
              }}
              title="Copy plate number"
              className="plate-chip text-sm group/plate cursor-copy hover:border-sage-400 transition-colors"
            >
              {d.detected_plate}
              <Copy className="h-3 w-3 opacity-0 group-hover/plate:opacity-60 transition-opacity" />
            </button>
          ) : (
            <span className="plate-chip text-sm">UNREAD</span>
          )}
          <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-2xs font-mono font-semibold uppercase tracking-wider",
            threat.cls
          )}>
            <Target className="h-2.5 w-2.5" />
            {threat.level}
          </span>
          {isViolation && d.violation_type && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-peach-100 border border-peach-200 text-peach-800 dark:bg-peach-900/30 dark:border-peach-700/40 dark:text-peach-300 text-2xs font-semibold uppercase tracking-wider">
              <AlertTriangle className="h-2.5 w-2.5" />
              {violTypeDisplay}
            </span>
          )}
          <span className="ml-auto font-mono text-2xs text-foreground-subtle tabular-nums">
            {format(new Date(d.timestamp), "dd MMM yyyy · HH:mm:ss.SSS")}
          </span>
        </div>

        {/* Chain of custody */}
        <div className="mt-2 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.1em] text-foreground-subtle">
          <Lock className="h-3 w-3" />
          <span>Custody:</span>
          {["Captured", "OCR Verified", "Hashed", "Archived"].map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-border-strong">→</span>}
              <span className={cn(phase >= Math.min(i, 3) ? "text-sage-700 dark:text-sage-400" : "")}>{s}</span>
            </span>
          ))}
          <span className="ml-auto hidden sm:inline tabular-nums">
            CAM {d.camera_id ? String(d.camera_id).slice(0, 8).toUpperCase() : "—"}
          </span>
        </div>
      </header>

      <div className="p-5 space-y-5">
        {/* ── EXAMINATION BENCH: three stages across ──────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
          {/* Stage 01 — full frame */}
          <div className="min-w-0">
            <StageLabel no="01" label="Full Frame Capture" icon={Camera} />
            {frameUrl ? (
              <FrameWithOverlays
                src={frameUrl}
                vehicleBox={vehicleBox}
                plateBox={plateBox}
                vehicleConf={d.vehicle_confidence}
                phase={phase}
                stamp={{ code: evdCode(d), ts: format(new Date(d.timestamp), "HH:mm:ss.SSS") }}
              />
            ) : (
              <StagePlaceholder icon={FileImage} text="No frame captured" className="aspect-video" />
            )}
          </div>

          {/* Stage 02 — vehicle isolation */}
          <div className="min-w-0">
            <StageLabel no="02" label="Vehicle Isolation" icon={Crosshair} />
            {frameUrl && vehicleBox ? (
              <RegionCrop src={frameUrl} box={vehicleBox} />
            ) : (
              <StagePlaceholder icon={Crosshair} text="Vehicle region not recorded" className="aspect-[4/3]" />
            )}
            <p className="mt-1.5 font-mono text-2xs text-foreground-subtle">
              YOLOv8 lock · {d.vehicle_confidence != null ? `${Math.round(d.vehicle_confidence * 100)}% conf` : "—"} · {d.vehicle_category ?? "vehicle"}
            </p>
          </div>

          {/* Stage 03 — plate extraction + OCR */}
          <div className="min-w-0">
            <StageLabel no="03" label="Plate Extraction" icon={ImageIcon} />
            {plateUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-sage-300/30 dark:border-sage-600/30 bg-stone-950 aspect-[2.4/1]">
                <img src={plateUrl} alt="Plate crop" className="w-full h-full object-contain" />
                {phase >= 2 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="ocr-bbox inset-[14%]" />
                  </div>
                )}
              </div>
            ) : frameUrl && plateBox ? (
              <RegionCrop src={frameUrl} box={plateBox} pad={0.25} />
            ) : (
              <StagePlaceholder icon={Eye} text="No plate crop saved" className="aspect-[2.4/1]" />
            )}

            {/* OCR readout */}
            <div className="mt-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-2xs text-foreground-subtle font-mono uppercase tracking-[0.12em]">OCR Result</span>
                <ConfBadge value={d.ocr_confidence} />
              </div>
              <p className={cn(
                "font-mono text-xl font-bold tracking-[0.18em] tabular-nums",
                d.detected_plate ? "text-foreground" : "text-foreground-subtle italic text-sm tracking-normal"
              )}>
                {d.detected_plate ?? "no read"}
              </p>
            </div>
          </div>
        </section>

        {/* ── ANALYSIS ROW ────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
            <p className="data-label flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Confidence Analysis
            </p>
            <div className="space-y-2.5">
              <ConfEntry label="Vehicle detection" value={d.vehicle_confidence} />
              <ConfEntry label="Plate localisation" value={d.plate_confidence} />
              <ConfEntry label="OCR extraction" value={d.ocr_confidence} />
            </div>
          </div>

          <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-1">
            <p className="data-label flex items-center gap-1.5 mb-2">
              <Eye className="h-3.5 w-3.5" /> Detection Metadata
            </p>
            <ForensicRow label="Vehicle Type">
              <span className="capitalize text-foreground text-xs font-medium">{d.vehicle_category ?? "—"}</span>
            </ForensicRow>
            <ForensicRow label="Process Time">
              <span className="font-mono text-xs text-foreground tabular-nums">
                {d.processing_time_ms != null ? `${d.processing_time_ms}ms` : "—"}
              </span>
            </ForensicRow>
            <ForensicRow label="Record ID">
              <span className="font-mono text-xs text-foreground tabular-nums">{String(d.id).slice(0, 8).toUpperCase()}</span>
            </ForensicRow>
            <ForensicRow label="Status">
              {isViolation
                ? <span className="text-2xs font-semibold text-peach-600 dark:text-peach-400 inline-flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Violation</span>
                : <span className="text-2xs font-semibold text-sage-600 dark:text-sage-400 inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Clear</span>
              }
            </ForensicRow>
          </div>

          <div className="bg-muted/40 border border-border rounded-xl p-4">
            <p className="data-label flex items-center gap-1.5 mb-3">
              <Target className="h-3.5 w-3.5" /> Risk Classification
            </p>
            <div className={cn(
              "rounded-lg border px-3 py-2.5 flex items-center justify-between",
              threat.cls
            )}>
              <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em]">{threat.level} RISK</span>
              <span className="font-display text-lg font-bold tabular-nums">
                {d.vehicle_confidence != null ? Math.round(d.vehicle_confidence * 100) : "—"}
              </span>
            </div>
            <p className="mt-2.5 text-2xs text-foreground-subtle leading-relaxed">
              {isViolation
                ? "Classification derived from detection confidence and document state. Case routed to the enforcement queue."
                : "All compliance checks passed — record archived with no enforcement action."}
            </p>
          </div>
        </section>

        {/* ── AI REASONING BAND ───────────────────────────────────── */}
        <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4">
          {/* Detection sequence */}
          <div className="bg-muted/40 border border-border rounded-xl p-4">
            <p className="data-label flex items-center gap-1.5 mb-3">
              <Activity className="h-3.5 w-3.5" /> AI Detection Sequence
            </p>
            <div className="space-y-2">
              {timeline.map((t, i) => {
                const Icon = t.icon;
                const isFinalViolation = i === timeline.length - 1 && isViolation;
                return (
                  <motion.div
                    key={t.step}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: t.done ? 1 : 0.35, x: 0 }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                    className="flex items-center gap-3"
                  >
                    <div className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors duration-400",
                      t.done
                        ? isFinalViolation
                          ? "bg-peach-100 border-peach-200 dark:bg-peach-900/40 dark:border-peach-700/40"
                          : "bg-sage-100 border-sage-200 dark:bg-sage-900/40 dark:border-sage-700/40"
                        : "bg-muted border-border"
                    )}>
                      <Icon className={cn(
                        "h-3 w-3 transition-colors duration-400",
                        t.done
                          ? isFinalViolation
                            ? "text-peach-600 dark:text-peach-400"
                            : "text-sage-600 dark:text-sage-400"
                          : "text-foreground-subtle/40"
                      )} />
                    </div>
                    <span className={cn(
                      "flex-1 text-xs transition-colors duration-400",
                      t.done ? "text-foreground" : "text-foreground-subtle/40"
                    )}>
                      {t.step}
                    </span>
                    <span className={cn(
                      "font-mono text-2xs tabular-nums transition-colors duration-400",
                      t.done ? "text-foreground-subtle" : "text-foreground-subtle/30"
                    )}>
                      {t.ts}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Decision + reasoning */}
          <div className={cn(
            "rounded-xl border p-4",
            isViolation
              ? "border-peach-200 dark:border-peach-700/40 bg-peach-50 dark:bg-peach-900/20"
              : "border-sage-200 dark:border-sage-700/40 bg-sage-50/60 dark:bg-sage-900/20"
          )}>
            <div className="flex items-start gap-3">
              {isViolation
                ? <ShieldAlert className="h-5 w-5 text-peach-600 dark:text-peach-400 shrink-0 mt-0.5" />
                : <ShieldCheck className="h-5 w-5 text-sage-600 dark:text-sage-400 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className={cn(
                    "text-sm font-semibold capitalize",
                    isViolation ? "text-peach-900 dark:text-peach-100" : "text-sage-900 dark:text-sage-100"
                  )}>
                    {isViolation ? (violTypeDisplay ?? "Violation Recorded") : "No Violation — Record Cleared"}
                  </p>
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg border text-2xs font-mono font-bold uppercase tracking-[0.1em] shrink-0",
                    threat.cls
                  )}>
                    {threat.level} RISK
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-foreground-muted">
                  {buildReasoning(d)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isViolation && (
                    <>
                      <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface hover:bg-muted text-xs font-semibold text-sage-700 dark:text-sage-400 transition-colors">
                        <Radio className="h-3.5 w-3.5" /> Issue Challan
                      </button>
                      <button className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface hover:bg-muted text-xs font-semibold text-bronze-700 dark:text-bronze-400 transition-colors">
                        <Target className="h-3.5 w-3.5" /> Flag for Inspection
                      </button>
                    </>
                  )}
                  {d.detected_plate && (
                    <Link
                      href={`/vehicles/${encodeURIComponent(d.detected_plate)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-sage-700 dark:text-sage-400 hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Vehicle intelligence dossier →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   EVIDENCE VIEW — digital forensics workbench (queue + workbench)
   ════════════════════════════════════════════════════════════════════ */
export function EvidenceView() {
  const [page, setPage] = useState(1);
  const [violationsOnly, setViolationsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["evidence-list", page, violationsOnly],
    queryFn: () => detectionsApi.list(page, 18, violationsOnly).then((r) => r.data as PaginatedResponse<Detection>),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
  });

  const items: Detection[] = data?.items ?? [];
  const filtered = useMemo(
    () => (search ? items.filter((d) => d.detected_plate?.includes(search.toUpperCase())) : items),
    [items, search]
  );

  // Selection follows the visible list: keep current if still visible,
  // otherwise fall back to the first record.
  const selected = filtered.find((d) => d.id === selectedId) ?? filtered[0] ?? null;

  // Keyboard case navigation — ↑/↓ or J/K, examiner style
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement | null)?.isContentEditable) return;
      const down = e.key === "ArrowDown" || e.key === "j";
      const up = e.key === "ArrowUp" || e.key === "k";
      if (!down && !up) return;
      e.preventDefault();
      if (!filtered.length) return;
      const idx = Math.max(0, filtered.findIndex((d) => d.id === (selected?.id ?? "")));
      const next = filtered[Math.min(filtered.length - 1, Math.max(0, idx + (down ? 1 : -1)))];
      if (next) setSelectedId(next.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selected]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 18)) : 1;

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ── Queue pane ─────────────────────────────────────────── */}
      <aside className={cn(
        "border-b lg:border-b-0 lg:border-r border-border bg-surface flex flex-col",
        "lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)]"
      )}>
        <header className="px-4 py-3 border-b border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="ops-title">Evidence Queue</span>
            <span className="ops-meta">{data?.total ?? 0} records</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1 bg-muted/60 border border-border rounded-lg px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-foreground-subtle shrink-0" />
              <input
                type="text"
                placeholder="Search plate…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent font-mono text-xs text-foreground placeholder:text-foreground-subtle/60 outline-none w-full uppercase"
              />
            </div>
            <button
              onClick={() => { setViolationsOnly(!violationsOnly); setPage(1); }}
              title={violationsOnly ? "Showing violations only" : "Showing all evidence"}
              className={cn(
                "inline-flex items-center gap-1.5 text-2xs font-mono font-semibold uppercase tracking-[0.08em] px-2.5 py-2 rounded-lg border transition-all shrink-0",
                violationsOnly
                  ? "bg-peach-600 text-white border-peach-700"
                  : "bg-surface text-foreground-muted border-border hover:bg-muted"
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {violationsOnly ? "Viol" : "All"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto max-h-[40vh] lg:max-h-none">
          {isLoading
            ? Array.from({ length: 10 }, (_, i) => <QueueRowSkeleton key={i} />)
            : filtered.length === 0 ? (
                <div className="py-16 text-center px-6">
                  <FolderOpen className="h-6 w-6 text-foreground-subtle mx-auto mb-2" />
                  <p className="text-xs text-foreground-muted font-medium">No evidence records</p>
                  <p className="text-2xs text-foreground-subtle mt-1">Start a camera stream to capture detections.</p>
                </div>
              ) : (
                filtered.map((det) => (
                  <QueueRow
                    key={det.id}
                    detection={det}
                    selected={selected?.id === det.id}
                    onClick={() => setSelectedId(det.id)}
                  />
                ))
              )}
        </div>

        <footer className="px-4 py-2.5 border-t border-border flex items-center justify-between bg-muted/30">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
            className="p-1.5 rounded-md text-foreground-subtle hover:bg-muted disabled:opacity-30 border border-border transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-2xs text-foreground-subtle tabular-nums uppercase tracking-[0.1em]">
            Page {page} / {totalPages} · <span title="Navigate cases with arrow keys or J/K">↑↓ keys</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="Next page"
            className="p-1.5 rounded-md text-foreground-subtle hover:bg-muted disabled:opacity-30 border border-border transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </footer>
      </aside>

      {/* ── Workbench pane ─────────────────────────────────────── */}
      <main className="min-w-0 lg:h-[calc(100dvh-4rem)] lg:overflow-y-auto">
        {selected ? (
          <ForensicWorkspace key={selected.id} detection={selected} />
        ) : (
          <div className="h-full min-h-[420px] flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="relative h-14 w-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
              <Tag className="h-6 w-6 text-foreground-subtle" />
            </div>
            <p className="text-sm font-semibold text-foreground-muted">No case selected</p>
            <p className="text-xs text-foreground-subtle max-w-xs">
              Select an evidence record from the queue to open the forensic examination workbench.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
