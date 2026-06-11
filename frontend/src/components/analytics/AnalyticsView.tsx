"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, AlertTriangle, Camera, Cpu, Crosshair, Gauge } from "lucide-react";

import { analyticsApi } from "@/lib/api/endpoints";
import { PuneIntelMap } from "@/components/dashboard/PuneIntelMap";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCompact } from "@/lib/utils";
import type { DashboardSummary } from "@/lib/types";

interface BucketRow { hour: string; total: number; violations: number }
interface CameraRow {
  camera_id: string;
  name: string;
  status: "active" | "inactive" | "error" | "maintenance";
  total_detections: number;
  error_count: number;
  last_seen: string | null;
}

function hourLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", hour12: false });
}

/* ════════════════════════════════════════════════════════════════════
   TRAFFIC INTELLIGENCE — patterns, hotspots, risk zones, camera
   effectiveness, and compliance trends. Not a chart gallery: every
   block answers an operational question.
   ════════════════════════════════════════════════════════════════════ */
export function AnalyticsView() {
  const { data: summary } = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data as DashboardSummary),
    refetchInterval: 30_000,
  });
  const { data: timeline, isLoading: tlLoading } = useQuery({
    queryKey: ["analytics", "timeline", 24],
    queryFn: () => analyticsApi.timeline(24).then((r) => r.data as BucketRow[]),
    refetchInterval: 30_000,
  });
  const { data: violations, isLoading: vLoading } = useQuery({
    queryKey: ["analytics", "violations"],
    queryFn: () => analyticsApi.violations().then((r) => r.data),
    refetchInterval: 60_000,
  });
  const { data: ai, isLoading: aiLoading } = useQuery({
    queryKey: ["analytics", "ai-performance"],
    queryFn: () => analyticsApi.aiPerformance().then((r) => r.data),
    refetchInterval: 60_000,
  });
  const { data: cameras, isLoading: camLoading } = useQuery({
    queryKey: ["analytics", "cameras"],
    queryFn: () => analyticsApi.cameras().then((r) => r.data as CameraRow[]),
    refetchInterval: 30_000,
  });

  const kpis = summary?.kpis;
  const buckets = timeline ?? [];
  const trendRows = buckets.map((b) => ({
    label: hourLabel(b.hour),
    compliant: Math.max(0, b.total - b.violations),
    violations: b.violations,
  }));

  const violationRate =
    kpis && kpis.total_scans_24h > 0 ? kpis.violations_24h / kpis.total_scans_24h : 0;
  const complianceIndex = kpis ? Math.max(0, 100 - violationRate * 100) : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full px-4 sm:px-5 py-4 space-y-4 max-w-[1800px] mx-auto">

        {/* ── Intelligence ribbon ───────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="op-surface"
          aria-label="Intelligence summary"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border/70">
            <RibbonCell
              label="Compliance Index"
              value={complianceIndex != null ? `${complianceIndex.toFixed(1)}` : "—"}
              sub="of 100 · trailing 24h"
              state={complianceIndex == null ? "info" : complianceIndex >= 97 ? "ok" : complianceIndex >= 90 ? "warn" : "alert"}
            />
            <RibbonCell
              label="Violation Rate"
              value={kpis ? `${(violationRate * 100).toFixed(1)}%` : "—"}
              sub={kpis ? `${formatCompact(kpis.violations_24h)} of ${formatCompact(kpis.total_scans_24h)} reads` : "—"}
              state={violationRate >= 0.1 ? "alert" : violationRate >= 0.03 ? "warn" : "ok"}
            />
            <RibbonCell
              label="AI Read Accuracy"
              value={ai?.ocr_accuracy_pct != null ? `${ai.ocr_accuracy_pct.toFixed(1)}%` : "—"}
              sub={ai ? `${formatCompact(ai.sample_size)} sample` : "—"}
              state={!ai?.ocr_accuracy_pct ? "info" : ai.ocr_accuracy_pct >= 85 ? "ok" : "warn"}
            />
            <RibbonCell
              label="Network Throughput"
              value={kpis ? formatCompact(kpis.total_scans_24h) : "—"}
              sub="frames processed · 24h"
              state="info"
            />
          </div>
        </motion.section>

        {/* ── Row A: compliance trend + violation patterns ──────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4">
          {/* Compliance trend */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="op-surface"
          >
            <header className="ops-header">
              <span className="ops-title">Compliance Trend · Trailing 24h</span>
              <div className="flex items-center gap-4 ops-meta">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-sage-500" /> compliant
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-peach-500" /> violations
                </span>
              </div>
            </header>
            <div className="px-2 py-3">
              {tlLoading ? (
                <Skeleton className="h-52 mx-3" />
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendRows} margin={{ top: 6, right: 16, bottom: 4, left: 4 }}>
                      <defs>
                        <linearGradient id="ti-compliant" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7F8876" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#7F8876" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ti-violation" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ED9F7E" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#ED9F7E" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tickLine={false} axisLine={false} width={32} />
                      <Tooltip
                        cursor={{ stroke: "#A9B394", strokeDasharray: "3 3" }}
                        formatter={(v: number, name: string) => [
                          v.toLocaleString("en-IN"),
                          name === "compliant" ? "Compliant" : "Violations",
                        ]}
                      />
                      <Area type="monotone" dataKey="compliant" stackId="1" stroke="#969D87" strokeWidth={1.8} fill="url(#ti-compliant)" />
                      <Area type="monotone" dataKey="violations" stackId="1" stroke="#ED9F7E" strokeWidth={1.8} fill="url(#ti-violation)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Hourly risk pattern heat strip */}
            <div className="border-t border-border px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
                  Hourly Risk Pattern
                </span>
                <span className="font-mono text-2xs text-foreground-subtle">violation density / hour</span>
              </div>
              <div className="flex gap-[3px]">
                {buckets.map((b, i) => {
                  const rate = b.total > 0 ? b.violations / b.total : 0;
                  const alpha = b.total === 0 ? 0.05 : Math.min(0.9, 0.08 + rate * 2.4);
                  const hue = rate >= 0.15 ? "0 60% 48%" : rate >= 0.06 ? "17 70% 55%" : rate > 0 ? "35 65% 48%" : "150 30% 42%";
                  return (
                    <div key={b.hour} className="flex-1 min-w-0">
                      <div
                        className="h-7 rounded-[3px] border border-border/40"
                        style={{ background: `hsl(${hue} / ${alpha})` }}
                        title={`${hourLabel(b.hour)} — ${b.violations}/${b.total} violations`}
                      />
                      {i % 4 === 0 && (
                        <p className="mt-1 font-mono text-[0.5625rem] text-foreground-subtle tabular-nums text-center">
                          {hourLabel(b.hour)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>

          {/* Violation pattern analysis */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="op-surface flex flex-col"
          >
            <header className="ops-header">
              <span className="ops-title">Violation Patterns</span>
              <span className="ops-meta flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" /> by document state
              </span>
            </header>
            <div className="p-4 flex-1">
              {vLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
                </div>
              ) : !violations || violations.length === 0 ? (
                <p className="py-10 text-center font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
                  No violations recorded
                </p>
              ) : (
                <div className="space-y-3.5">
                  {violations.map((v, i) => (
                    <div key={v.type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground capitalize truncate">
                          {v.type.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono text-2xs text-foreground-muted tabular-nums shrink-0">
                          {v.count.toLocaleString("en-IN")} · {v.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${v.pct}%` }}
                          transition={{ delay: i * 0.08 + 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className={cn(
                            "h-full rounded-full",
                            i === 0 ? "bg-peach-500" : i === 1 ? "bg-bronze-400" : "bg-sage-400"
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <footer className="px-4 py-2.5 border-t border-border font-mono text-2xs text-foreground-subtle uppercase tracking-[0.1em]">
              Top pattern drives enforcement priority
            </footer>
          </motion.section>
        </div>

        {/* ── Row B: risk zones + camera effectiveness + AI engine ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="min-w-0"
          >
            <PuneIntelMap />
          </motion.div>

          {/* Camera effectiveness */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="op-surface flex flex-col min-w-0"
          >
            <header className="ops-header">
              <span className="ops-title">Camera Effectiveness</span>
              <span className="ops-meta flex items-center gap-1.5">
                <Camera className="h-3 w-3" /> throughput ranking
              </span>
            </header>
            <div className="p-4 flex-1">
              {camLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
                </div>
              ) : (
                <CameraEffectiveness rows={cameras ?? []} />
              )}
            </div>
          </motion.section>

          {/* AI engine performance */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="op-surface flex flex-col min-w-0"
          >
            <header className="ops-header">
              <span className="ops-title">AI Engine Performance</span>
              <span className="ops-meta flex items-center gap-1.5">
                <Cpu className="h-3 w-3" /> YOLOv8 + EasyOCR
              </span>
            </header>
            <div className="p-4 flex-1 space-y-4">
              {aiLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
                </div>
              ) : (
                <>
                  <EngineGauge icon={Crosshair} label="Vehicle detection" value={ai?.vehicle_detection_pct ?? null} unit="%" />
                  <EngineGauge icon={Activity} label="OCR accuracy" value={ai?.ocr_accuracy_pct ?? null} unit="%" />
                  <EngineGauge icon={AlertTriangle} label="Error rate" value={ai?.error_rate_pct ?? null} unit="%" invert />
                  <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
                    <div>
                      <p className="data-label mb-1">Avg Latency</p>
                      <p className="font-mono text-sm font-bold text-foreground tabular-nums">
                        {ai?.avg_processing_ms != null ? `${Math.round(ai.avg_processing_ms)}ms` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="data-label mb-1">Sample Size</p>
                      <p className="font-mono text-sm font-bold text-foreground tabular-nums">
                        {ai ? formatCompact(ai.sample_size) : "—"}
                      </p>
                    </div>
                  </div>
                  {ai && ai.sample_size === 0 && (
                    <p className="font-mono text-2xs text-foreground-subtle">
                      No processed detections yet — run the live pipeline to populate metrics.
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

/* ── Ribbon cell ──────────────────────────────────────────────────── */
function RibbonCell({ label, value, sub, state }: {
  label: string; value: string; sub: string;
  state: "ok" | "info" | "warn" | "alert" | "critical";
}) {
  return (
    <div className={cn("readout-cell", `readout-${state}`)}>
      <span className="data-label">{label}</span>
      <div className="mt-2">
        <span className="data-value text-2xl font-semibold leading-none">{value}</span>
      </div>
      <p className="mt-1.5 font-mono text-2xs text-foreground-subtle truncate">{sub}</p>
    </div>
  );
}

/* ── Camera effectiveness ranking ─────────────────────────────────── */
function CameraEffectiveness({ rows }: { rows: CameraRow[] }) {
  const sorted = [...rows].sort((a, b) => b.total_detections - a.total_detections);
  const max = Math.max(...sorted.map((r) => r.total_detections), 1);

  if (sorted.length === 0) {
    return (
      <p className="py-10 text-center font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
        No cameras provisioned
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.slice(0, 8).map((r, i) => {
        const pct = Math.round((r.total_detections / max) * 100);
        const faulty = r.error_count > 0;
        return (
          <div key={r.camera_id}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-2xs text-foreground-subtle w-4 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-xs font-medium text-foreground truncate">{r.name}</span>
              </span>
              <span className={cn(
                "font-mono text-2xs tabular-nums shrink-0",
                faulty ? "text-threat-high font-semibold" : "text-foreground-muted"
              )}>
                {formatCompact(r.total_detections)}{faulty ? ` · ${r.error_count} err` : ""}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: i * 0.06 + 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={cn("h-full rounded-full", faulty ? "bg-bronze-400" : "bg-sage-500")}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Engine gauge ─────────────────────────────────────────────────── */
function EngineGauge({ icon: Icon, label, value, unit, invert }: {
  icon: typeof Gauge; label: string; value: number | null; unit: string; invert?: boolean;
}) {
  const pct = value != null ? Math.min(100, Math.max(0, value)) : 0;
  const good = invert ? pct < 5 : pct >= 85;
  const mid = invert ? pct < 15 : pct >= 65;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-xs text-foreground-muted">
          <Icon className="h-3 w-3 text-foreground-subtle" /> {label}
        </span>
        <span className="font-mono text-xs font-semibold text-foreground tabular-nums">
          {value != null ? `${value.toFixed(1)}${unit}` : "—"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "h-full rounded-full",
            good ? "bg-sage-500" : mid ? "bg-bronze-400" : "bg-peach-500"
          )}
        />
      </div>
    </div>
  );
}
