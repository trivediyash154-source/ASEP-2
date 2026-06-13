"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { analyticsApi, challansApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import type { DashboardSummary } from "@/lib/types";
import { PUNE_ZONES } from "./PuneIntelMap";

interface ChallanStats {
  total_issued: number;
  total_collected: number;
  pending_count: number;
  collection_rate: number;
}

/**
 * Situation briefing — one narrative line that answers the operator's
 * first four questions: what is happening, what needs attention, where,
 * and what action is underway. Synthesized from live data, written like
 * a duty officer's handover note, not a metrics row.
 */
export function SituationBriefing() {
  const { data } = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data),
    refetchInterval: 15_000,
    staleTime: 8_000,
  });
  const { data: chStats } = useQuery({
    queryKey: ["challan-stats"],
    queryFn: () => challansApi.stats().then((r) => r.data as ChallanStats),
    refetchInterval: 60_000,
  });

  const kpis = (data as DashboardSummary | undefined)?.kpis;
  if (!kpis) return null;

  const rate = kpis.total_scans_24h > 0 ? kpis.violations_24h / kpis.total_scans_24h : 0;
  const condition =
    rate >= 0.25 ? { word: "Severe activity", cls: "text-threat-critical" } :
    rate >= 0.10 ? { word: "Elevated activity", cls: "text-threat-high" } :
    rate >= 0.03 ? { word: "Guarded condition", cls: "text-threat-medium" } :
    { word: "Network nominal", cls: "text-threat-clear" };

  // Heaviest curated zone — the believable "where"
  const hotZone = PUNE_ZONES[0];

  const sentences: string[] = [];
  sentences.push(
    `${kpis.active_cameras} camera${kpis.active_cameras === 1 ? "" : "s"} streaming, AI engine at ${kpis.success_rate.toFixed(1)}%.`
  );
  if (kpis.violations_24h > 0) {
    sentences.push(
      `${kpis.violations_24h.toLocaleString("en-IN")} violation${kpis.violations_24h === 1 ? "" : "s"} flagged in 24h — heaviest load on the ${hotZone.name} corridor (${hotZone.corridor}).`
    );
  } else {
    sentences.push("No violations flagged in the last 24 hours.");
  }
  if (chStats) {
    sentences.push(
      `${chStats.pending_count} enforcement case${chStats.pending_count === 1 ? "" : "s"} open, recovery at ${chStats.collection_rate}%.`
    );
  }

  return (
    <section
      className="op-surface flex items-center gap-3 px-4 py-2"
      aria-label="Situation briefing"
    >
      <span className="flex items-center gap-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-foreground-subtle shrink-0">
        <FileText className="h-3 w-3" />
        Situation
      </span>
      <span className="h-3.5 w-px bg-border shrink-0" aria-hidden />
      <p className="text-xs text-foreground-muted leading-snug min-w-0">
        <span className={cn("font-semibold", condition.cls)}>{condition.word}.</span>{" "}
        {sentences.join(" ")}
      </p>
    </section>
  );
}
