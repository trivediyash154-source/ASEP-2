import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ── Number formatting ─────────────────────────────────────────── */
export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatPercent(n: number, fractionDigits = 1): string {
  return `${(n * 100).toFixed(fractionDigits)}%`;
}

export function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

/* ── Domain-specific accents ───────────────────────────────────── */
/**
 * Tonal accent for ANPR / model confidence levels. Returns a Tailwind class
 * tuned to the sage/peach/bronze palette — never neon, never pure red.
 */
export function getConfidenceTone(confidence: number): {
  text: string;
  bg: string;
  ring: string;
  label: "high" | "medium" | "low";
} {
  if (confidence >= 0.9) {
    return { text: "text-sage-700", bg: "bg-sage-100", ring: "ring-sage-300", label: "high" };
  }
  if (confidence >= 0.7) {
    return { text: "text-bronze-700", bg: "bg-bronze-50", ring: "ring-bronze-200", label: "medium" };
  }
  return { text: "text-peach-700", bg: "bg-peach-50", ring: "ring-peach-200", label: "low" };
}

export type ChallanStatus = "issued" | "paid" | "overdue" | "disputed" | "cancelled";

export function getChallanStatusTone(status: string): {
  variant: "default" | "success" | "warning" | "danger" | "neutral" | "info";
  label: string;
} {
  const map: Record<string, { variant: "default" | "success" | "warning" | "danger" | "neutral" | "info"; label: string }> = {
    issued:    { variant: "info",    label: "Issued" },
    paid:      { variant: "success", label: "Paid" },
    overdue:   { variant: "danger",  label: "Overdue" },
    disputed:  { variant: "warning", label: "Disputed" },
    cancelled: { variant: "neutral", label: "Cancelled" },
  };
  return map[status] ?? { variant: "default", label: status };
}

/* ── Time helpers ──────────────────────────────────────────────── */
export function timeAgo(input: string | Date | number): string {
  const date = typeof input === "string" || typeof input === "number" ? new Date(input) : input;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
