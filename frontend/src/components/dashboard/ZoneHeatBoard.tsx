"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";
import { PUNE_ZONES, PUNE_TOTALS } from "./PuneIntelMap";

const RISK_HEAT: Record<string, { cls: string; bg: string }> = {
  critical: { cls: "text-threat-critical", bg: "hsl(var(--threat-critical) / 0.12)" },
  high:     { cls: "text-threat-high",     bg: "hsl(var(--threat-high) / 0.10)" },
  medium:   { cls: "text-threat-medium",   bg: "hsl(var(--threat-medium) / 0.08)" },
  low:      { cls: "text-threat-low",      bg: "hsl(var(--threat-low) / 0.06)" },
  clear:    { cls: "text-threat-clear",    bg: "transparent" },
};

/**
 * Violation heat across the Pune zones — the deeper-intelligence
 * companion to the theatre map. Every cell is one enforcement zone:
 * heat intensity tracks violation load.
 */
export function ZoneHeatBoard({ className }: { className?: string }) {
  const maxViol = Math.max(...PUNE_ZONES.map((z) => z.violations));
  const sorted = [...PUNE_ZONES].sort((a, b) => b.violations - a.violations);

  return (
    <section className={cn("op-surface flex flex-col", className)} aria-label="Zone violation heat">
      <header className="ops-header shrink-0">
        <span className="ops-title">Violation Heat · Zones</span>
        <span className="ops-meta flex items-center gap-1.5">
          <Flame className="h-3 w-3" /> {PUNE_TOTALS.violations} flagged
        </span>
      </header>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1.5 flex-1 content-start">
        {sorted.map((z, i) => {
          const heat = RISK_HEAT[z.risk];
          const pct = Math.round((z.violations / maxViol) * 100);
          return (
            <motion.div
              key={z.code}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-md border border-border/70 px-2.5 py-2"
              style={{ background: heat.bg }}
              title={`${z.name} · ${z.corridor} · ${z.cameras} cameras`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-2xs font-semibold text-foreground truncate">{z.code}</span>
                <span className={cn("font-mono text-2xs font-bold tabular-nums", heat.cls)}>{z.violations}</span>
              </div>
              <p className="text-2xs text-foreground-subtle truncate">{z.name}</p>
              <div className="mt-1 h-[3px] rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: i * 0.04 + 0.25, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className={cn("h-full rounded-full", heat.cls)}
                  style={{ background: "currentColor" }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
