"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, formatCompact } from "@/lib/utils";

export interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number | string;
  format?: "number" | "compact" | "currency" | "percent" | "raw";
  delta?: number; // percentage change e.g. 0.124 = +12.4%
  deltaLabel?: string;
  icon?: React.ReactNode;
  tone?: "neutral" | "sage" | "peach" | "bronze";
  loading?: boolean;
  sparkline?: React.ReactNode;
  hint?: string;
}

const toneToBar: Record<NonNullable<StatProps["tone"]>, string> = {
  neutral: "bg-stone-300",
  sage:    "bg-sage-500",
  peach:   "bg-peach-400",
  bronze:  "bg-bronze-500",
};

function renderValue(value: StatProps["value"], format: StatProps["format"]): string {
  if (typeof value === "string") return value;
  if (format === "compact")  return formatCompact(value);
  if (format === "currency") return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  if (format === "percent")  return `${(value * 100).toFixed(1)}%`;
  if (format === "raw")      return String(value);
  return new Intl.NumberFormat("en-IN").format(value);
}

export function Stat({
  label,
  value,
  format = "number",
  delta,
  deltaLabel,
  icon,
  tone = "neutral",
  loading,
  sparkline,
  hint,
  className,
  ...props
}: StatProps) {
  const deltaSign = delta === undefined ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "bg-surface border border-border rounded-xl",
        "shadow-card hover:shadow-card-md transition-shadow duration-250",
        "p-5",
        className
      )}
      {...props}
    >
      {/* Tone accent bar */}
      <span className={cn("absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full", toneToBar[tone])} />

      <div className="flex items-start justify-between gap-3 pl-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle">
              {label}
            </span>
            {icon && (
              <span className="text-foreground-subtle [&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
            )}
          </div>

          {loading ? (
            <div className="skeleton h-8 w-24 mt-3" />
          ) : (
            <div className="mt-2.5 data-value text-3xl font-semibold leading-none">
              {renderValue(value, format)}
            </div>
          )}

          {(deltaSign !== null || hint) && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              {deltaSign && delta !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-semibold tabular-nums",
                    deltaSign === "up" && "text-status-success",
                    deltaSign === "down" && "text-status-danger",
                    deltaSign === "flat" && "text-foreground-subtle"
                  )}
                >
                  {deltaSign === "up" && <ArrowUpRight className="h-3.5 w-3.5" />}
                  {deltaSign === "down" && <ArrowDownRight className="h-3.5 w-3.5" />}
                  {deltaSign === "flat" && <Minus className="h-3.5 w-3.5" />}
                  {`${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`}
                </span>
              )}
              {(deltaLabel || hint) && (
                <span className="text-foreground-subtle">{deltaLabel ?? hint}</span>
              )}
            </div>
          )}
        </div>

        {sparkline && <div className="h-10 w-24 shrink-0 opacity-90">{sparkline}</div>}
      </div>
    </div>
  );
}
