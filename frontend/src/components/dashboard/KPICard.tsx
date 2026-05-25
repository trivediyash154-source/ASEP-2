"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Trend { value: number; label: string }

type Variant = "sage" | "peach" | "bronze" | "stone" | "success" | "danger" | "warning" | "indigo" | "blue" | "default";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: Trend;
  variant?: Variant;
  loading?: boolean;
  className?: string;
  delay?: number;
  live?: boolean;
}

const VARIANTS: Record<Variant, {
  surface: string;
  icon: string;
  accent: string;
  value: string;
  trend: string;
  border: string;
}> = {
  sage: {
    surface: "bg-sage-50/60 dark:bg-sage-900/20",
    icon:    "bg-sage-100 text-sage-700 dark:bg-sage-800/40 dark:text-sage-300",
    accent:  "bg-sage-500",
    value:   "text-sage-900 dark:text-sage-100",
    trend:   "text-sage-600 dark:text-sage-400",
    border:  "border-sage-200/80 dark:border-sage-700/40",
  },
  peach: {
    surface: "bg-peach-50/60 dark:bg-peach-900/20",
    icon:    "bg-peach-100 text-peach-700 dark:bg-peach-800/30 dark:text-peach-300",
    accent:  "bg-peach-500",
    value:   "text-peach-900 dark:text-peach-100",
    trend:   "text-peach-600 dark:text-peach-400",
    border:  "border-peach-200/80 dark:border-peach-700/40",
  },
  bronze: {
    surface: "bg-bronze-50/60 dark:bg-bronze-900/20",
    icon:    "bg-bronze-100 text-bronze-700 dark:bg-bronze-800/30 dark:text-bronze-300",
    accent:  "bg-bronze-500",
    value:   "text-bronze-900 dark:text-bronze-100",
    trend:   "text-bronze-600 dark:text-bronze-400",
    border:  "border-bronze-200/80 dark:border-bronze-700/40",
  },
  stone: {
    surface: "bg-stone-50/80 dark:bg-stone-800/20",
    icon:    "bg-stone-100 text-stone-600 dark:bg-stone-700/40 dark:text-stone-300",
    accent:  "bg-stone-400",
    value:   "text-foreground",
    trend:   "text-foreground-muted",
    border:  "border-border",
  },
  success: {
    surface: "bg-sage-50/60 dark:bg-sage-900/20",
    icon:    "bg-sage-100 text-sage-700 dark:bg-sage-800/40 dark:text-sage-300",
    accent:  "bg-sage-500",
    value:   "text-sage-900 dark:text-sage-100",
    trend:   "text-sage-600 dark:text-sage-400",
    border:  "border-sage-200/80 dark:border-sage-700/40",
  },
  danger: {
    surface: "bg-peach-50/60 dark:bg-peach-900/20",
    icon:    "bg-peach-100 text-peach-700 dark:bg-peach-800/30 dark:text-peach-300",
    accent:  "bg-peach-500",
    value:   "text-peach-900 dark:text-peach-100",
    trend:   "text-peach-600 dark:text-peach-400",
    border:  "border-peach-200/80 dark:border-peach-700/40",
  },
  warning: {
    surface: "bg-bronze-50/60 dark:bg-bronze-900/20",
    icon:    "bg-bronze-100 text-bronze-700 dark:bg-bronze-800/30 dark:text-bronze-300",
    accent:  "bg-bronze-400",
    value:   "text-bronze-900 dark:text-bronze-100",
    trend:   "text-bronze-600 dark:text-bronze-400",
    border:  "border-bronze-200/80 dark:border-bronze-700/40",
  },
  indigo: {
    surface: "bg-sage-50/60 dark:bg-sage-900/20",
    icon:    "bg-sage-100 text-sage-700 dark:bg-sage-800/40 dark:text-sage-300",
    accent:  "bg-sage-600",
    value:   "text-sage-900 dark:text-sage-100",
    trend:   "text-sage-600 dark:text-sage-400",
    border:  "border-sage-200/80 dark:border-sage-700/40",
  },
  blue: {
    surface: "bg-stone-50/80 dark:bg-stone-800/20",
    icon:    "bg-stone-100 text-stone-600 dark:bg-stone-700/40 dark:text-stone-300",
    accent:  "bg-stone-500",
    value:   "text-foreground",
    trend:   "text-foreground-muted",
    border:  "border-border",
  },
  default: {
    surface: "bg-stone-50/80 dark:bg-stone-800/20",
    icon:    "bg-stone-100 text-stone-600 dark:bg-stone-700/40 dark:text-stone-300",
    accent:  "bg-stone-400",
    value:   "text-foreground",
    trend:   "text-foreground-muted",
    border:  "border-border",
  },
};

export function KPICard({
  title, value, subtitle, icon: Icon, trend, variant = "default",
  loading = false, className, delay = 0, live = false,
}: KPICardProps) {
  const v = VARIANTS[variant];

  if (loading) {
    return (
      <div className={cn(
        "rounded-xl border p-5 overflow-hidden",
        "bg-surface shadow-card",
        className
      )}>
        <div className="skeleton h-2.5 w-20 mb-4 rounded" />
        <div className="skeleton h-7 w-14 rounded mb-2" />
        <div className="skeleton h-2.5 w-28 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative rounded-xl border overflow-hidden p-5",
        "bg-surface shadow-card hover:shadow-card-md",
        "transition-shadow duration-300",
        v.border,
        className
      )}
    >
      {/* Accent bar top */}
      <div className={cn("absolute top-0 inset-x-0 h-[2px]", v.accent)} />

      {/* Subtle tinted background */}
      <div className={cn("absolute inset-0 pointer-events-none", v.surface)} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Label */}
          <div className="flex items-center gap-2 mb-2">
            <p className="data-label leading-none">{title}</p>
            {live && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inset-0 rounded-full bg-status-success opacity-60 animate-ping" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-status-success" />
              </span>
            )}
          </div>

          {/* Value */}
          <p className={cn(
            "text-2xl font-display font-semibold tracking-tight tabular-nums leading-none mb-1",
            v.value
          )}>
            {value}
          </p>

          {/* Subtitle */}
          {subtitle && (
            <p className="text-2xs text-foreground-subtle mt-1 leading-snug">{subtitle}</p>
          )}

          {/* Trend */}
          {trend && (
            <div className="flex items-center gap-1.5 mt-2.5">
              {trend.value >= 0
                ? <TrendingUp className="h-3 w-3 text-sage-600 dark:text-sage-400" />
                : <TrendingDown className="h-3 w-3 text-peach-600 dark:text-peach-400" />
              }
              <span className={cn(
                "text-2xs font-semibold tabular-nums",
                trend.value >= 0
                  ? "text-sage-600 dark:text-sage-400"
                  : "text-peach-600 dark:text-peach-400"
              )}>
                {trend.value >= 0 ? "+" : ""}{trend.value}%
              </span>
              <span className="text-2xs text-foreground-subtle">{trend.label}</span>
            </div>
          )}
        </div>

        {/* Icon */}
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          "transition-transform duration-300 group-hover:scale-105",
          v.icon
        )}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </div>
      </div>
    </motion.div>
  );
}
