"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, Camera, ChevronLeft, ChevronRight,
  Clock, Eye, FileImage, FolderOpen, Image as ImageIcon,
  MapPin, Search, Shield, ShieldAlert, ShieldCheck, Tag, X,
  Crosshair, Zap, Activity, Lock, Radio, Target,
} from "lucide-react";
import Link from "next/link";
import { detectionsApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Detection } from "@/lib/types";
import { getApiUrl } from "@/lib/api/client";

function evidenceUrl(path: string | null | undefined): string | null {
  return path ? `${getApiUrl()}/uploads/${path}` : null;
}

/* ── Threat level from confidence ─────────────────────────────────── */
function getThreat(d: Detection): { level: string; cls: string } {
  if (!d.is_violation) return { level: "CLEAR",    cls: "threat-clear" };
  const conf = d.vehicle_confidence ?? 0;
  if (conf >= 0.90)    return { level: "HIGH",     cls: "threat-high" };
  if (conf >= 0.75)    return { level: "MEDIUM",   cls: "threat-medium" };
  return                      { level: "LOW",       cls: "threat-low" };
}

/* ── Confidence badge ─────────────────────────────────────────────── */
function ConfBadge({ value, label }: { value?: number | null; label?: string }) {
  if (value == null) return <span className="text-foreground-subtle font-mono text-2xs">—</span>;
  const pct = Math.round(value * 100);
  const cls = pct >= 85 ? "text-sage-700 dark:text-sage-300 bg-sage-50 dark:bg-sage-900/30 border-sage-200 dark:border-sage-700/40"
    : pct >= 65 ? "text-bronze-700 dark:text-bronze-300 bg-bronze-50 dark:bg-bronze-900/30 border-bronze-200 dark:border-bronze-700/40"
    : "text-peach-700 dark:text-peach-300 bg-peach-50 dark:bg-peach-900/30 border-peach-200 dark:border-peach-700/40";
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-2xs font-mono font-semibold tabular-nums", cls)}>
      {label && <span className="opacity-60">{label}</span>}
      {pct}%
    </span>
  );
}

/* ── Confidence bar ───────────────────────────────────────────────── */
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

/* ── Evidence Card ────────────────────────────────────────────────── */
function EvidenceCard({ detection: d, index, onClick }: {
  detection: Detection; index: number; onClick: () => void;
}) {
  const frameUrl = evidenceUrl(d.frame_path);
  const threat = getThreat(d);
  const conf = d.vehicle_confidence ?? 0;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.4), ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className={cn(
        "group text-left rounded-xl overflow-hidden w-full",
        "bg-surface border shadow-card",
        "hover:shadow-card-md hover:-translate-y-0.5",
        "transition-all duration-250 ease-out-quart",
        d.is_violation
          ? "border-peach-200/80 dark:border-peach-700/40"
          : "border-border"
      )}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-stone-950 relative overflow-hidden">
        {frameUrl ? (
          <img
            src={frameUrl}
            alt={d.detected_plate ?? "Detection"}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-950">
            <div className="tactical-grid" />
            <FileImage className="h-7 w-7 text-stone-600 relative z-10" />
          </div>
        )}

        {/* Scan overlay on hover */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="scan-overlay" />
        </div>

        {/* Tactical corner brackets */}
        <div className="absolute inset-1 pointer-events-none">
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-sage-400/60 rounded-tl" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-sage-400/60 rounded-tr" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-sage-400/60 rounded-bl" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-sage-400/60 rounded-br" />
        </div>

        {/* Threat level top strip */}
        <div className={cn(
          "absolute top-0 inset-x-0 flex items-center justify-between px-2 py-1",
          d.is_violation ? "bg-peach-600/85" : "bg-stone-900/70"
        )}>
          <div className="flex items-center gap-1">
            {d.is_violation
              ? <AlertTriangle className="h-2.5 w-2.5 text-white shrink-0" />
              : <Shield className="h-2.5 w-2.5 text-stone-300 shrink-0" />
            }
            <span className="text-2xs text-white font-semibold font-mono uppercase tracking-[0.1em]">
              {d.is_violation ? (d.violation_type?.replace(/_/g, " ") ?? "Violation") : "Clear"}
            </span>
          </div>
          <span className={cn("text-2xs font-mono font-bold", threat.cls)}>{threat.level}</span>
        </div>

        {/* Confidence chip bottom */}
        {d.vehicle_confidence != null && (
          <div className="absolute bottom-1.5 right-1.5 glass-dark text-white text-2xs font-mono font-semibold px-1.5 py-0.5 rounded">
            {Math.round(conf * 100)}%
          </div>
        )}

        {/* Evidence ID bottom-left */}
        <div className="absolute bottom-1.5 left-1.5 glass-dark text-stone-300 text-2xs font-mono px-1.5 py-0.5 rounded">
          EVD-{String(d.id).slice(0, 6).toUpperCase()}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300">
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1.5 glass-dark px-3 py-1.5 rounded-lg">
              <Target className="h-3.5 w-3.5 text-sage-300" />
              <span className="text-2xs text-white font-semibold uppercase tracking-[0.1em]">Forensic View</span>
            </div>
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="px-3 py-2.5 bg-surface">
        <p className={cn(
          "font-mono text-xs font-bold tracking-wider leading-none",
          d.detected_plate ? "text-foreground" : "text-foreground-subtle italic"
        )}>
          {d.detected_plate ?? "UNREAD"}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-2xs text-foreground-subtle font-mono tabular-nums">
            {format(new Date(d.timestamp), "HH:mm:ss")}
          </span>
          <div className="flex items-center gap-1.5">
            {d.is_violation
              ? <ShieldAlert className="h-3 w-3 text-peach-500" />
              : <ShieldCheck className="h-3 w-3 text-sage-500" />
            }
            <span className="text-2xs text-foreground-subtle capitalize font-mono">{d.vehicle_category ?? "—"}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function EvidenceCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border border-border">
      <div className="aspect-video skeleton" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-2 w-1/2 rounded" />
      </div>
    </div>
  );
}

/* ── Forensic Intelligence Panel ──────────────────────────────────── */
function ForensicPanel({ detection: d, onClose }: { detection: Detection; onClose: () => void }) {
  const frameUrl = evidenceUrl(d.frame_path);
  const plateUrl = evidenceUrl(d.plate_crop_path);
  const isViolation = d.is_violation;
  const threat = getThreat(d);

  const [phase, setPhase] = useState(0);

  // AI lock sequence animation phases
  useEffect(() => {
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [d.id]);

  const violTypeDisplay = d.violation_type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const ocrConf = d.ocr_confidence != null ? Math.round(d.ocr_confidence * 100) : null;
  const vehicleConf = d.vehicle_confidence != null ? Math.round(d.vehicle_confidence * 100) : null;
  const plateConf = d.plate_confidence != null ? Math.round(d.plate_confidence * 100) : null;

  const timeline = [
    { step: "Vehicle Detected",      icon: Camera,     done: phase >= 1, ts: "T+0ms"    },
    { step: "Plate Region Located",   icon: Crosshair,  done: phase >= 1, ts: "T+12ms"  },
    { step: "OCR Extraction",         icon: Zap,        done: phase >= 2, ts: "T+38ms"  },
    { step: "Compliance Check",       icon: Shield,     done: phase >= 2, ts: "T+55ms"  },
    { step: "Evidence Archived",      icon: Lock,       done: phase >= 3, ts: "T+62ms"  },
    { step: isViolation ? "Challan Generated" : "Record Cleared",
      icon: isViolation ? ShieldAlert : ShieldCheck,
      done: phase >= 3, ts: "T+80ms" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch justify-end"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[720px] bg-surface border-l border-border shadow-card-lg overflow-y-auto flex flex-col"
      >
        {/* ── Sticky header ─────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className={cn(
            "sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-4 border-b border-border",
            isViolation
              ? "bg-peach-50 dark:bg-peach-900/20"
              : "bg-sage-50 dark:bg-sage-900/20"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border shrink-0",
              isViolation
                ? "bg-peach-100 border-peach-200 dark:bg-peach-900/40 dark:border-peach-700/50"
                : "bg-sage-100 border-sage-200 dark:bg-sage-900/40 dark:border-sage-700/50"
            )}>
              {isViolation
                ? <ShieldAlert className="h-5 w-5 text-peach-700 dark:text-peach-400" />
                : <ShieldCheck className="h-5 w-5 text-sage-700 dark:text-sage-400" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="plate-chip font-mono text-sm">{d.detected_plate ?? "UNREAD"}</span>
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
              </div>
              <p className="text-2xs text-foreground-subtle font-mono mt-0.5">
                {format(new Date(d.timestamp), "dd MMM yyyy · HH:mm:ss.SSS")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-foreground-subtle hover:text-foreground hover:bg-muted transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </motion.header>

        <div className="p-6 space-y-6 flex-1">

          {/* Evidence ID */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3 bg-muted/60 border border-border rounded-lg px-4 py-2.5 font-mono text-2xs"
          >
            <Tag className="h-3 w-3 text-foreground-subtle shrink-0" />
            <span className="text-foreground-subtle font-semibold uppercase tracking-[0.1em]">Evidence ID</span>
            <span className="ml-auto text-foreground tabular-nums">{d.id}</span>
            <span className="text-foreground-subtle">·</span>
            <span className="text-foreground-subtle">Frame #{d.frame_number ?? "—"}</span>
          </motion.div>

          {/* Forensic images — cinematic treatment */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="section-eyebrow mb-3">Forensic Captures</p>
            <div className="grid grid-cols-2 gap-4">
              {/* Full frame */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Camera className="h-3 w-3 text-foreground-subtle" />
                  <span className="text-2xs font-semibold text-foreground-muted uppercase tracking-[0.12em]">Full Frame</span>
                </div>
                <div className={cn(
                  "aspect-video rounded-xl overflow-hidden border relative bg-stone-950",
                  frameUrl ? "border-border" : "border-dashed border-border"
                )}>
                  {frameUrl ? (
                    <>
                      <img src={frameUrl} alt="Evidence frame" className="w-full h-full object-contain" />
                      {/* AI lock border on violation */}
                      {isViolation && phase >= 1 && (
                        <div className="ai-lock-border" />
                      )}
                      {/* Tactical corners */}
                      <div className="absolute inset-1.5 pointer-events-none">
                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-sage-400/50" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-sage-400/50" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-sage-400/50" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-sage-400/50" />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="tactical-grid opacity-40" />
                      <FileImage className="h-8 w-8 text-stone-600 relative z-10" />
                      <p className="text-2xs text-stone-500 relative z-10">No frame captured</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Plate crop / OCR */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <ImageIcon className="h-3 w-3 text-foreground-subtle" />
                  <span className="text-2xs font-semibold text-foreground-muted uppercase tracking-[0.12em]">Plate · OCR Crop</span>
                </div>
                <div className={cn(
                  "aspect-video rounded-xl overflow-hidden border relative bg-stone-950",
                  plateUrl ? "border-sage-300/30 dark:border-sage-600/30" : "border-dashed border-border"
                )}>
                  {plateUrl ? (
                    <>
                      <img src={plateUrl} alt="Plate crop" className="w-full h-full object-contain" />
                      {phase >= 2 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="ocr-bbox inset-[20%]" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="tactical-grid opacity-40" />
                      <Eye className="h-8 w-8 text-stone-600 relative z-10" />
                      <p className="text-2xs text-stone-500 relative z-10">No crop saved</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.section>

          {/* AI Reasoning Timeline */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-3.5 w-3.5 text-foreground-subtle" />
              <p className="section-eyebrow">AI Detection Sequence</p>
            </div>
            <div className="bg-muted/40 border border-border rounded-xl p-4">
              <div className="space-y-2">
                {timeline.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <motion.div
                      key={t.step}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: t.done ? 1 : 0.35, x: 0 }}
                      transition={{ delay: i * 0.12 + 0.3 }}
                      className="flex items-center gap-3"
                    >
                      <div className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors duration-400",
                        t.done
                          ? (i === timeline.length - 1 && isViolation)
                            ? "bg-peach-100 border-peach-200 dark:bg-peach-900/40 dark:border-peach-700/40"
                            : "bg-sage-100 border-sage-200 dark:bg-sage-900/40 dark:border-sage-700/40"
                          : "bg-muted border-border"
                      )}>
                        <Icon className={cn(
                          "h-3 w-3 transition-colors duration-400",
                          t.done
                            ? (i === timeline.length - 1 && isViolation)
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
          </motion.section>

          {/* AI Confidence Breakdown */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-3.5 w-3.5 text-foreground-subtle" />
              <p className="section-eyebrow">Confidence Analysis</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* OCR block */}
              <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                <p className="text-2xs font-semibold text-foreground-subtle uppercase tracking-[0.14em] flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> OCR Intelligence
                </p>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-2xs text-foreground-subtle">Plate Number</span>
                    <span className="font-mono font-bold text-sm text-foreground">{d.detected_plate ?? "—"}</span>
                  </div>
                  <div className="space-y-2">
                    <ConfEntry label="OCR"     value={ocrConf}     />
                    <ConfEntry label="Vehicle" value={vehicleConf} />
                    <ConfEntry label="Plate"   value={plateConf}   />
                  </div>
                </div>
              </div>

              {/* Detection info */}
              <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                <p className="text-2xs font-semibold text-foreground-subtle uppercase tracking-[0.14em] flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Detection Metadata
                </p>
                <div className="space-y-2">
                  <ForensicRow label="Vehicle Type">
                    <span className="capitalize text-foreground text-xs font-medium">{d.vehicle_category ?? "—"}</span>
                  </ForensicRow>
                  <ForensicRow label="Process Time">
                    <span className="font-mono text-xs text-foreground tabular-nums">
                      {d.processing_time_ms != null ? `${d.processing_time_ms}ms` : "—"}
                    </span>
                  </ForensicRow>
                  <ForensicRow label="Threat Level">
                    <span className={cn("font-mono text-2xs font-semibold uppercase", threat.cls)}>{threat.level}</span>
                  </ForensicRow>
                  <ForensicRow label="Status">
                    {isViolation
                      ? <span className="text-2xs font-semibold text-peach-600 dark:text-peach-400 flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Violation</span>
                      : <span className="text-2xs font-semibold text-sage-600 dark:text-sage-400 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Clear</span>
                    }
                  </ForensicRow>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Violation record + enforcement */}
          {isViolation && d.violation_type && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="h-3.5 w-3.5 text-foreground-subtle" />
                <p className="section-eyebrow">Violation Record</p>
              </div>
              <div className="rounded-xl border border-peach-200 dark:border-peach-700/40 bg-peach-50 dark:bg-peach-900/20 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-peach-600 dark:text-peach-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-peach-900 dark:text-peach-100 capitalize">
                      {violTypeDisplay}
                    </p>
                    <p className="text-2xs text-peach-600 dark:text-peach-400 font-mono mt-0.5">
                      Detected at {format(new Date(d.timestamp), "HH:mm:ss")} ·{" "}
                      {format(new Date(d.timestamp), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className={cn(
                    "px-2.5 py-1 rounded-lg border text-2xs font-mono font-bold uppercase tracking-[0.1em]",
                    threat.cls
                  )}>
                    {threat.level} RISK
                  </div>
                </div>
                {d.detected_plate && (
                  <Link
                    href={`/vehicles/${encodeURIComponent(d.detected_plate)}`}
                    className="mt-3 flex items-center gap-2 text-xs font-semibold text-sage-700 dark:text-sage-400 hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Open vehicle intelligence dossier →
                  </Link>
                )}
              </div>

              {/* Enforcement recommendations */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { icon: Radio,    label: "Issue Challan",       color: "text-sage-700 dark:text-sage-400" },
                  { icon: Target,   label: "Flag for Inspection",  color: "text-bronze-700 dark:text-bronze-400" },
                ].map((a) => (
                  <button key={a.label} className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border",
                    "bg-surface hover:bg-muted text-xs font-semibold transition-colors",
                    a.color
                  )}>
                    <a.icon className="h-3.5 w-3.5" />
                    {a.label}
                  </button>
                ))}
              </div>
            </motion.section>
          )}

          {/* Timestamp footer */}
          <div className="flex items-center gap-2 text-2xs text-foreground-subtle font-mono border-t border-border pt-4">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(d.timestamp), "dd MMM yyyy HH:mm:ss.SSS")}</span>
            {d.detected_plate && (
              <Link href={`/vehicles/${encodeURIComponent(d.detected_plate)}`}
                className="ml-auto text-sage-600 dark:text-sage-400 hover:underline flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Vehicle dossier
              </Link>
            )}
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function ConfEntry({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-2xs text-foreground-subtle">{label}</span>
        <ConfBadge value={value != null ? value / 100 : null} />
      </div>
      <ConfBar value={value != null ? value / 100 : null} />
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

/* ── EvidenceView ──────────────────────────────────────────────────── */
export function EvidenceView() {
  const [page, setPage] = useState(1);
  const [violationsOnly, setViolationsOnly] = useState(false);
  const [selected, setSelected] = useState<Detection | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["evidence-list", page, violationsOnly],
    queryFn: () => detectionsApi.list(page, 18, violationsOnly).then((r) => r.data),
    keepPreviousData: true,
    refetchInterval: 20_000,
  });

  const items: Detection[] = data?.items ?? [];
  const filtered = search
    ? items.filter((d) => d.detected_plate?.includes(search.toUpperCase()))
    : items;

  const totalPages = data ? Math.ceil(data.total / 18) : 1;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-screen-2xl mx-auto">

        {/* ── Command toolbar ───────────────────────── */}
        <div className={cn(
          "flex flex-wrap items-center justify-between gap-3 mb-5 px-4 py-3",
          "bg-surface border border-border rounded-xl shadow-card"
        )}>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2">
              <Search className="h-3.5 w-3.5 text-foreground-subtle shrink-0" />
              <input
                type="text"
                placeholder="Search plate…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-foreground placeholder:text-foreground-subtle/60 outline-none w-32"
              />
            </div>

            {/* Violations filter */}
            <button
              onClick={() => { setViolationsOnly(!violationsOnly); setPage(1); }}
              className={cn(
                "inline-flex items-center gap-1.5 text-2xs font-semibold px-3 py-2 rounded-lg border transition-all",
                violationsOnly
                  ? "bg-peach-600 text-white border-peach-700 shadow-glow-peach"
                  : "bg-surface text-foreground-muted border-border hover:bg-muted"
              )}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              {violationsOnly ? "Violations Only" : "All Evidence"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-2xs font-mono text-foreground-subtle">
              <Radio className="h-3 w-3 text-status-success animate-pulse-soft" />
              <span className="uppercase tracking-[0.1em]">Forensic Archive</span>
            </div>
            <p className="text-2xs text-foreground-subtle font-mono tabular-nums">
              {data?.total ?? 0} records · pg {page}/{totalPages}
            </p>
          </div>
        </div>

        {/* ── Evidence grid ─────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 mb-6">
          {isLoading
            ? Array.from({ length: 18 }, (_, i) => <EvidenceCardSkeleton key={i} />)
            : filtered.map((det, i) => (
                <EvidenceCard
                  key={det.id}
                  detection={det}
                  index={i}
                  onClick={() => setSelected(det)}
                />
              ))
          }
        </div>

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div className="py-24 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border mb-4">
              <FolderOpen className="h-6 w-6 text-foreground-subtle" />
            </div>
            <p className="text-sm text-foreground-muted font-semibold">No evidence records found</p>
            <p className="text-xs text-foreground-subtle mt-1">Start a camera stream to capture detections</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg text-foreground-subtle hover:bg-muted disabled:opacity-30 border border-border transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-foreground-subtle font-mono px-3 tabular-nums">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="p-2 rounded-lg text-foreground-subtle hover:bg-muted disabled:opacity-30 border border-border transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Forensic Intelligence Panel */}
      <AnimatePresence>
        {selected && (
          <ForensicPanel detection={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
