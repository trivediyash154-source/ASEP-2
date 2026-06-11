"use client";

import { useMemo } from "react";
import { Circle, Eye, Sparkles, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, formatCompact } from "@/lib/utils";
import { useCamerasStore } from "@/lib/stores/cameras.store";
import type { Camera } from "@/lib/types";

import { LiveClock } from "./primitives/LiveClock";

interface Props {
  cameras: Camera[];
  wsConnected: boolean;
}

/**
 * Page-level tactical header. Shows fleet roll-up, AI engine state,
 * and the live throughput rate. Designed to read like an operations
 * board, not a regular dashboard title block.
 */
export function TacticalHeader({ cameras, wsConnected }: Props) {
  const events = useCamerasStore((s) => s.events);

  const stats = useMemo(() => {
    const live = cameras.filter((c) => c.status === "active").length;
    const fault = cameras.filter((c) => c.status === "error").length;
    const idle = cameras.filter((c) => c.status === "inactive" || c.status === "maintenance").length;
    const totalReads = cameras.reduce((s, c) => s + (c.total_detections ?? 0), 0);
    // Events per minute over the last 5 minutes from the live store
    const fiveMinAgo = Date.now() - 5 * 60_000;
    const recent = events.filter((e) => e.receivedAt > fiveMinAgo);
    const rate = recent.length / 5;
    const violations = events.filter((e) => e.is_violation).length;
    return { live, fault, idle, totalReads, rate, violations };
  }, [cameras, events]);

  return (
    <section className="relative overflow-hidden surface-panel">
      <div className="absolute inset-0 -z-0 opacity-60 bg-sage-radial pointer-events-none" />
      <div className="absolute inset-0 -z-0 opacity-40 bg-peach-radial pointer-events-none" />

      <div className="relative z-10 p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-end">
        {/* Title block */}
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 h-6 rounded-md border border-sage-300 bg-sage-100/70 text-2xs font-semibold uppercase tracking-[0.16em] text-sage-800 dark:border-sage-700/60 dark:bg-sage-900/40 dark:text-sage-300">
              <Target className="h-3 w-3" />
              Theatre · PUNE
            </span>
            <Badge variant={wsConnected ? "sage" : "danger"} withDot pulse={wsConnected} size="sm">
              {wsConnected ? "Stream connected" : "Stream offline"}
            </Badge>
            <span className="hidden md:inline-flex items-center gap-1.5 h-6 px-2 rounded-md border border-border bg-surface/80 text-2xs font-mono text-foreground-muted">
              <LiveClock format="iso" />
            </span>
          </div>

          <h1 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-foreground tracking-tightest leading-[1.05]">
            Surveillance command
          </h1>
          <p className="mt-2 text-sm text-foreground-muted max-w-2xl">
            Live AI-mediated camera operations across the Pune pilot theatre —
            Hinjewadi to Camp, expressway to Satara Road. Real-time detections,
            violation alerts, and forensic evidence chains feed one console.
          </p>
        </div>

        {/* Stats */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <TacticalStat
            label="Live cams"
            value={stats.live.toString()}
            sub={`of ${cameras.length}`}
            tone="sage"
            icon={<Circle className="h-3 w-3" />}
          />
          <TacticalStat
            label="Faults"
            value={stats.fault.toString()}
            sub={stats.fault === 0 ? "none" : "needs attn."}
            tone={stats.fault > 0 ? "peach" : "neutral"}
          />
          <TacticalStat
            label="Reads /min"
            value={stats.rate.toFixed(1)}
            sub="last 5 min"
            tone="bronze"
            icon={<Eye className="h-3 w-3" />}
          />
          <TacticalStat
            label="Alerts"
            value={stats.violations.toString()}
            sub="recent stream"
            tone={stats.violations > 0 ? "peach" : "neutral"}
            icon={<Sparkles className="h-3 w-3" />}
          />
        </dl>
      </div>
    </section>
  );
}

function TacticalStat({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "sage" | "peach" | "bronze" | "neutral";
  icon?: React.ReactNode;
}) {
  const toneClass = {
    sage:    "border-sage-200   bg-sage-50/70   dark:border-sage-700/50   dark:bg-sage-900/30",
    peach:   "border-peach-200  bg-peach-50/70  dark:border-peach-700/50  dark:bg-peach-900/25",
    bronze:  "border-bronze-200 bg-bronze-50/70 dark:border-bronze-700/50 dark:bg-bronze-900/25",
    neutral: "border-border     bg-surface/70",
  }[tone];
  const accent = {
    sage:    "text-sage-800 dark:text-sage-300",
    peach:   "text-peach-800 dark:text-peach-300",
    bronze:  "text-bronze-800 dark:text-bronze-300",
    neutral: "text-foreground",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-3 py-2.5 backdrop-blur-[1px]", toneClass)}>
      <div className="flex items-center justify-between">
        <dt className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
          {label}
        </dt>
        {icon && <span className={accent}>{icon}</span>}
      </div>
      <dd className={cn("mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight", accent)}>
        {value}
      </dd>
      <dd className="text-2xs text-foreground-subtle">{sub}</dd>
    </div>
  );
}
