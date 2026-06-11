"use client";

import { Activity, Cpu, Eye, Gauge, Layers, Signal, Wifi, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

export interface Telemetry {
  // Stream metrics (from StreamSource.metrics)
  fps?: number;
  latency_ms?: number;
  frames_read?: number;
  frames_dropped?: number;
  stream_health?: string;
  reconnects?: number;
  // Pipeline metrics (added by _run_pipeline)
  pipeline_ms?: number;
  frame_age_ms?: number;
  yolo_ms?: number;
  ocr_ms?: number;
  frames_processed?: number;
  ocr_attempts?: number;
  ocr_reliable?: number;
  detections_persisted?: number;
  active_tracks?: number;
}

interface Props {
  telemetry: Telemetry | null;
  status: string;
}

const healthColor: Record<string, string> = {
  EXCELLENT:    "text-sage-700",
  GOOD:         "text-sage-600",
  DEGRADED:     "text-bronze-600",
  CRITICAL:     "text-peach-600",
  OFFLINE:      "text-stone-400",
  UNKNOWN:      "text-stone-400",
};

const healthDot: Record<string, string> = {
  EXCELLENT:    "bg-sage-500",
  GOOD:         "bg-sage-400",
  DEGRADED:     "bg-bronze-400",
  CRITICAL:     "bg-peach-400",
  OFFLINE:      "bg-stone-400",
  UNKNOWN:      "bg-stone-400",
};

export function TelemetryHUD({ telemetry, status }: Props) {
  const t = telemetry ?? {};
  const health = (t.stream_health || status || "UNKNOWN").toUpperCase();
  const healthClass = healthColor[health] ?? "text-stone-400";
  const dotClass = healthDot[health] ?? "bg-stone-400";

  const dropPct =
    t.frames_read && t.frames_dropped !== undefined
      ? Math.min(100, (t.frames_dropped / Math.max(t.frames_read, 1)) * 100)
      : undefined;

  const ocrHitRate =
    t.ocr_attempts
      ? Math.round(((t.ocr_reliable ?? 0) / t.ocr_attempts) * 100)
      : undefined;

  return (
    <div className="surface-panel p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-eyebrow">Pipeline telemetry</p>
          <h3 className="mt-0.5 font-display text-sm font-semibold text-foreground tracking-tight">
            Real-time operations
          </h3>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.16em]", healthClass)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", dotClass, health !== "OFFLINE" && health !== "UNKNOWN" && "animate-pulse")} />
          {health}
        </span>
      </div>

      {/* Tier 1 — stream metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile icon={<Gauge />} label="Stream FPS"
          value={t.fps !== undefined ? t.fps.toFixed(1) : "—"}
          accent={t.fps !== undefined && t.fps >= 12 ? "sage" : "peach"}
        />
        <Tile icon={<Activity />} label="Pipeline ms"
          value={t.pipeline_ms !== undefined ? Math.round(t.pipeline_ms).toString() : "—"}
          accent="bronze" suffix="ms"
        />
        <Tile icon={<Cpu />} label="Frame age"
          value={t.frame_age_ms !== undefined ? Math.round(t.frame_age_ms).toString() : "—"}
          accent={t.frame_age_ms !== undefined && t.frame_age_ms > 500 ? "peach" : "bronze"}
          suffix="ms"
        />
        <Tile icon={<Signal />} label="Drop %"
          value={dropPct !== undefined ? dropPct.toFixed(1) : "—"}
          accent={dropPct !== undefined && dropPct > 25 ? "peach" : "sage"}
          suffix="%"
        />
      </div>

      {/* Tier 2 — AI inference latency */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile icon={<Zap />} label="YOLO ms"
          value={t.yolo_ms !== undefined ? Math.round(t.yolo_ms).toString() : "—"}
          accent={t.yolo_ms !== undefined && t.yolo_ms > 200 ? "peach" : "bronze"}
          suffix="ms"
        />
        <Tile icon={<Eye />} label="OCR ms"
          value={t.ocr_ms !== undefined ? Math.round(t.ocr_ms).toString() : "—"}
          accent={t.ocr_ms !== undefined && t.ocr_ms > 500 ? "peach" : "bronze"}
          suffix="ms"
        />
        <Tile icon={<Layers />} label="OCR hit rate"
          value={ocrHitRate !== undefined ? ocrHitRate.toString() : "—"}
          accent={ocrHitRate !== undefined && ocrHitRate >= 50 ? "sage" : "bronze"}
          suffix="%"
        />
        <Tile icon={<Activity />} label="Active tracks"
          value={t.active_tracks !== undefined ? t.active_tracks.toString() : "—"}
          accent="sage"
        />
      </div>

      {/* Footer counters */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-2xs text-foreground-subtle font-mono border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5">
          <Wifi className="h-3 w-3" />
          {t.frames_read?.toLocaleString("en-IN") ?? "0"} frames in ·{" "}
          {t.frames_processed?.toLocaleString("en-IN") ?? "0"} processed
        </span>
        <span>
          {t.ocr_attempts ?? 0} OCR attempts · {t.ocr_reliable ?? 0} reliable reads
        </span>
        <span>
          {t.detections_persisted ?? 0} persisted · {t.reconnects ?? 0} reconnect{t.reconnects === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  accent,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "sage" | "bronze" | "peach";
  suffix?: string;
}) {
  const palette = {
    sage:   "border-sage-200 bg-sage-50/70 dark:border-sage-700/50 dark:bg-sage-900/25",
    bronze: "border-bronze-200 bg-bronze-50/70 dark:border-bronze-700/50 dark:bg-bronze-900/25",
    peach:  "border-peach-200 bg-peach-50/70 dark:border-peach-700/50 dark:bg-peach-900/25",
  }[accent];
  const numColor = {
    sage:   "text-sage-900",
    bronze: "text-bronze-900",
    peach:  "text-peach-900",
  }[accent];
  return (
    <div className={cn("rounded-lg border px-3 py-2", palette)}>
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
          {label}
        </span>
        <span className="text-foreground-subtle [&_svg]:h-3 [&_svg]:w-3">{icon}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn("font-display text-xl font-semibold tabular-nums", numColor)}>
          {value}
        </span>
        {suffix && (
          <span className="text-2xs font-mono text-foreground-subtle">{suffix}</span>
        )}
      </div>
    </div>
  );
}
