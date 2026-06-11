"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

import { analyticsApi } from "@/lib/api/endpoints";
import { cn, formatCompact } from "@/lib/utils";
import type { DashboardSummary } from "@/lib/types";

interface BucketRow {
  hour: string;
  total: number;
  violations: number;
}

type ReadoutState = "ok" | "info" | "warn" | "alert" | "critical";

interface Readout {
  label: string;
  value: string;
  sub: string;
  state: ReadoutState;
  live?: boolean;
  spark?: number[];
  href: string;
}

/**
 * Command readout — a single segmented instrument strip that replaces
 * the old grid of floating KPI cards. One surface, six readouts, each
 * with a state-coloured baseline. Reads left-to-right as an operational
 * sentence: network → detections → threats → risk → enforcement → AI.
 */
export function CommandReadout({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data),
    refetchInterval: 15_000,
    staleTime: 8_000,
  });
  const { data: timeline } = useQuery({
    queryKey: ["analytics", "timeline", 24],
    queryFn: () => analyticsApi.timeline(24).then((r) => r.data as BucketRow[]),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const kpis = (data as DashboardSummary | undefined)?.kpis;
  const violationRate =
    kpis && kpis.total_scans_24h > 0 ? kpis.violations_24h / kpis.total_scans_24h : 0;

  const readouts: Readout[] = [
    {
      label: "Camera Network",
      value: kpis ? String(kpis.active_cameras) : "—",
      sub: "streaming live",
      state: kpis && kpis.active_cameras > 0 ? "ok" : "warn",
      live: !!kpis && kpis.active_cameras > 0,
      href: "/cameras",
    },
    {
      label: "AI Scans · 24h",
      value: kpis ? formatCompact(kpis.total_scans_24h) : "—",
      sub: "frames processed",
      state: "info",
      spark: (timeline ?? []).map((b) => b.total),
      href: "/detections",
    },
    {
      label: "Active Violations",
      value: kpis ? formatCompact(kpis.violations_24h) : "—",
      sub: kpis ? `${kpis.success_rate.toFixed(1)}% compliant` : "—",
      state: !kpis || kpis.violations_24h === 0 ? "ok" : violationRate >= 0.1 ? "alert" : "warn",
      spark: (timeline ?? []).map((b) => b.violations),
      href: "/detections",
    },
    {
      label: "Compliance Risk",
      value: kpis ? `${(violationRate * 100).toFixed(1)}%` : "—",
      sub:
        violationRate >= 0.25 ? "severe — intervene" :
        violationRate >= 0.10 ? "elevated" :
        violationRate >= 0.03 ? "guarded" : "nominal",
      state:
        violationRate >= 0.25 ? "critical" :
        violationRate >= 0.10 ? "alert" :
        violationRate >= 0.03 ? "warn" : "ok",
      href: "/analytics",
    },
    {
      label: "Enforcement Queue",
      value: kpis ? formatCompact(kpis.pending_challans) : "—",
      sub: kpis ? `₹${formatCompact(kpis.revenue_pending)} outstanding` : "—",
      state: !kpis || kpis.pending_challans === 0 ? "ok" : "warn",
      href: "/challans",
    },
    {
      label: "AI Health",
      value: kpis ? `${kpis.success_rate.toFixed(1)}%` : "—",
      sub: kpis ? `conf ${(kpis.avg_confidence * 100).toFixed(0)}% · YOLOv8 + OCR` : "—",
      state: !kpis ? "info" : kpis.success_rate >= 85 ? "ok" : kpis.success_rate >= 70 ? "warn" : "alert",
      href: "/system",
    },
  ];

  return (
    <section className="op-surface" aria-label="Command readout">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-y md:divide-y xl:divide-y-0 divide-border/70">
        {readouts.map((r) => (
          <ReadoutCell key={r.label} readout={r} loading={isLoading} compact={compact} />
        ))}
      </div>
    </section>
  );
}

function ReadoutCell({ readout: r, loading, compact }: { readout: Readout; loading: boolean; compact: boolean }) {
  return (
    <Link
      href={r.href}
      className={cn(
        "readout-cell group block transition-colors duration-150 hover:bg-muted/40",
        compact && "py-3",
        `readout-${r.state}`
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="data-label truncate">{r.label}</span>
        {r.live
          ? <span className="status-dot-live group-hover:hidden" aria-label="live" />
          : <ArrowUpRight className="h-3 w-3 text-foreground-subtle/0 group-hover:text-foreground-subtle transition-colors" />}
        {r.live && (
          <ArrowUpRight className="hidden group-hover:block h-3 w-3 text-foreground-subtle" />
        )}
      </div>

      <div className={cn("flex items-end justify-between gap-2", compact ? "mt-1.5" : "mt-2.5")}>
        {loading ? (
          <div className={cn("skeleton w-16", compact ? "h-6" : "h-8")} />
        ) : (
          <span className={cn("data-value font-semibold leading-none", compact ? "text-2xl" : "text-3xl")}>
            {r.value}
          </span>
        )}
        {r.spark && r.spark.length > 1 && <Sparkline points={r.spark} state={r.state} />}
      </div>

      <p className="mt-1.5 font-mono text-2xs text-foreground-subtle truncate">{r.sub}</p>
    </Link>
  );
}

// Threat tokens are CSS vars so the strokes brighten automatically in dark.
const SPARK_STROKE: Record<ReadoutState, string> = {
  ok:       "hsl(var(--threat-clear))",
  info:     "#969D87",
  warn:     "hsl(var(--threat-medium))",
  alert:    "hsl(var(--threat-high))",
  critical: "hsl(var(--threat-critical))",
};

function Sparkline({ points, state }: { points: number[]; state: ReadoutState }) {
  const w = 64;
  const h = 22;
  const max = Math.max(...points, 1);
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (p / max) * (h - 2) - 1).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 opacity-80" aria-hidden>
      <path d={d} fill="none" stroke={SPARK_STROKE[state]} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
