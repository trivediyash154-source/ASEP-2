"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";

import { analyticsApi, detectionsApi } from "@/lib/api/endpoints";
import { cn, formatCompact } from "@/lib/utils";
import type { DashboardSummary } from "@/lib/types";

interface DetectionStats {
  total_24h?: number;
  violations_24h?: number;
}

/**
 * Thin operational status bar pinned to the top of the command overview.
 * Reads like a header strip in an ATC console: system identity on the
 * left, derived threat condition + engine state in the middle, IST
 * mission clock on the right. Shares the dashboard query cache.
 */
export function CommandStatusBar() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data),
    refetchInterval: 15_000,
    staleTime: 8_000,
  });

  // Evidence archive counter — ticks up as the pipeline files frames
  const { data: detStats } = useQuery({
    queryKey: ["detection-stats"],
    queryFn: () => detectionsApi.stats().then((r) => r.data as DetectionStats),
    refetchInterval: 15_000,
  });

  const kpis = (data as DashboardSummary | undefined)?.kpis;
  const condition = deriveCondition(kpis);
  const evidenceCount = detStats?.total_24h;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-5 gap-y-2 px-5 py-2.5",
        "bg-surface border border-border rounded-xl shadow-card",
        "font-mono text-2xs uppercase tracking-[0.12em]"
      )}
    >
      <div className="flex items-center gap-5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inset-0 rounded-full bg-status-success opacity-60 animate-ping" />
            <span className="relative h-2 w-2 rounded-full bg-status-success" />
          </span>
          <span className="text-foreground font-semibold whitespace-nowrap">VAAHAN AI · OPERATIONAL</span>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-foreground-subtle">
          <MapPin className="h-3 w-3" />
          Pune Regional Surveillance Network
        </span>
      </div>

      <div className="hidden lg:flex items-center gap-6 text-foreground-muted">
        <BarStat label="Condition" value={condition.label} className={condition.cls} />
        <BarStat label="AI Engine" value={isLoading || !kpis ? "—" : `${kpis.success_rate.toFixed(1)}%`} />
        <BarStat label="Cameras" value={isLoading || !kpis ? "—" : String(kpis.active_cameras)} />
        <BarStat label="Queue" value={isLoading || !kpis ? "—" : String(kpis.pending_challans)} />
        <span className="flex items-center gap-1.5 whitespace-nowrap" title="Evidence frames archived in the last 24h">
          <span className="text-foreground-subtle">Evidence</span>
          <span
            key={evidenceCount ?? "none"}
            className="text-foreground font-semibold tabular-nums animate-counter-tick"
          >
            {evidenceCount != null ? formatCompact(evidenceCount) : "—"}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3 text-foreground-subtle">
        <span>PUNE · IST</span>
        <MissionClock />
      </div>
    </div>
  );
}

/** Threat condition derived from the live violation rate — not decorative. */
function deriveCondition(kpis?: DashboardSummary["kpis"]) {
  if (!kpis || kpis.total_scans_24h === 0) {
    return { label: "STANDBY", cls: "text-foreground-subtle" };
  }
  const rate = kpis.violations_24h / kpis.total_scans_24h;
  if (rate >= 0.25) return { label: "SEVERE",   cls: "text-threat-critical" };
  if (rate >= 0.10) return { label: "ELEVATED", cls: "text-threat-high" };
  if (rate >= 0.03) return { label: "GUARDED",  cls: "text-threat-medium" };
  return { label: "NOMINAL", cls: "text-threat-clear" };
}

function BarStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-foreground-subtle">{label}</span>
      <span className={cn("text-foreground font-semibold tabular-nums", className)}>{value}</span>
    </div>
  );
}

function MissionClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    setT(new Date());
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-foreground font-semibold tabular-nums signal-live">
      {t ? t.toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--"}
    </span>
  );
}
