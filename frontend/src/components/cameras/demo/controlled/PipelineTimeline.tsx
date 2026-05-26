"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DemoStage } from "@/lib/api/endpoints";

interface Props {
  stages: DemoStage[];
  /** index of the stage currently in flight (inclusive). -1 = idle. */
  activeIndex: number;
  /** index of the last stage that has completed (inclusive). -1 = none. */
  doneIndex: number;
}

/**
 * Vertical animated pipeline timeline.
 *
 * Each stage shows: a status node (queued → in-flight → done), the stage
 * label, a one-line technical detail, and the latency budget. As stages
 * tick over (driven by the parent's setTimeout loop) the rail fills in
 * with a smooth gradient, and the in-flight node spins.
 */
export function PipelineTimeline({ stages, activeIndex, doneIndex }: Props) {
  return (
    <ol className="relative space-y-0">
      {stages.map((stage, idx) => {
        const isDone = idx <= doneIndex;
        const isActive = idx === activeIndex && !isDone;
        const isQueued = idx > activeIndex && !isDone;

        return (
          <li key={stage.key} className="relative pl-9 pb-3.5 last:pb-0">
            {/* Connector rail */}
            {idx < stages.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[14px] top-7 bottom-0 w-px transition-colors duration-300",
                  isDone ? "bg-sage-500" : "bg-border-strong/50",
                )}
              />
            )}

            {/* Status node */}
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300",
                isDone &&
                  "border-sage-500 bg-sage-500 text-white shadow-[0_0_0_4px_rgba(127,136,118,0.18)]",
                isActive &&
                  "border-peach-500 bg-peach-500/15 text-peach-700 dark:text-peach-200 shadow-[0_0_0_4px_rgba(237,159,126,0.25)]",
                isQueued && "border-border-strong/60 bg-surface text-foreground-subtle",
              )}
            >
              {isDone ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
              ) : (
                <span className="block h-1.5 w-1.5 rounded-full bg-foreground-subtle/70" />
              )}
            </span>

            <div className="min-h-[28px]">
              <div className="flex items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "text-sm font-semibold tracking-tight transition-colors duration-200",
                    isDone && "text-foreground",
                    isActive && "text-foreground",
                    isQueued && "text-foreground-subtle/85",
                  )}
                >
                  {stage.label}
                </p>
                <span
                  className={cn(
                    "font-mono text-2xs tabular-nums tracking-[0.08em]",
                    isDone && "text-sage-700 dark:text-sage-200",
                    isActive && "text-peach-700 dark:text-peach-200",
                    isQueued && "text-foreground-subtle/60",
                  )}
                >
                  {stage.latency_ms} ms
                </span>
              </div>
              <AnimatePresence>
                {(isActive || isDone) && (
                  <motion.p
                    key="detail"
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="mt-0.5 text-2xs text-foreground-muted font-mono tracking-[0.02em]"
                  >
                    {stage.detail}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
