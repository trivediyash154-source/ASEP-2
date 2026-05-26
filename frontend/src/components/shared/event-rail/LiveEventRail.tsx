"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertOctagon, AlertTriangle, Camera, FileText, Fingerprint,
  Radio, ShieldAlert, Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useNotificationsStore,
  type NotificationKind,
  type NotificationSeverity,
  type OperationalEvent,
} from "@/lib/stores/notifications.store";

/**
 * Live intelligence rail — a compact horizontal strip of the most recent
 * operational events. Sits just below the TopBar on dashboard / demo pages.
 * Each card is clickable: if there's a detection_id, it deep-links into
 * the evidence panel. Empty state is treated as a feature, not a bug —
 * "All quiet — system nominal" reads better in front of judges than nothing.
 */

const MAX_CARDS = 8;

const KIND_ICON: Record<NotificationKind, typeof Radio> = {
  detection:       Radio,
  challan_issued:  FileText,
  blacklist_hit:   ShieldAlert,
  repeat_offender: AlertTriangle,
  stolen_match:    AlertOctagon,
  ocr_recovery:    Sparkles,
  camera_offline:  Camera,
  system_warning:  AlertTriangle,
  system_error:    AlertOctagon,
};

const SEV_TINT: Record<NotificationSeverity, { ring: string; accent: string; chip: string }> = {
  info:     { ring: "ring-sage-400/35",     accent: "text-sage-700 dark:text-sage-200",   chip: "bg-sage-500/15 text-sage-800 dark:text-sage-100" },
  low:      { ring: "ring-peach-400/35",    accent: "text-peach-700 dark:text-peach-200", chip: "bg-peach-500/15 text-peach-800 dark:text-peach-100" },
  medium:   { ring: "ring-peach-500/55",    accent: "text-peach-800 dark:text-peach-100", chip: "bg-peach-500/22 text-peach-900 dark:text-peach-100" },
  high:     { ring: "ring-[#bd8658]/60",    accent: "text-[#7a4a28] dark:text-[#fcc99a]", chip: "bg-[#bd8658]/20 text-[#7a4a28] dark:text-[#fcc99a]" },
  critical: { ring: "ring-status-danger/70", accent: "text-status-danger",                chip: "bg-status-danger/15 text-status-danger" },
  system:   { ring: "ring-border",          accent: "text-foreground-muted",              chip: "bg-stone-500/15 text-foreground-muted" },
};

export function LiveEventRail() {
  const router = useRouter();
  const events = useNotificationsStore((s) => s.events);

  const recent = useMemo(() => events.slice(0, MAX_CARDS), [events]);

  if (recent.length === 0) {
    return <RailEmpty />;
  }

  return (
    <section
      aria-label="Live intelligence rail"
      className="relative w-full"
    >
      {/* Top-row band */}
      <div className="flex items-center justify-between px-1 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-status-success opacity-60 animate-ping" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-status-success" />
          </span>
          <span className="text-2xs font-bold uppercase tracking-[0.18em] text-foreground-subtle">
            Live intelligence rail
          </span>
          <span className="text-2xs font-mono text-foreground-subtle/70">
            · {events.length} event{events.length === 1 ? "" : "s"} buffered
          </span>
        </div>
        <div className="hidden sm:block text-2xs font-mono uppercase tracking-[0.14em] text-foreground-subtle/70">
          Sliding window · 200
        </div>
      </div>

      {/* Scrolling strip */}
      <div className="relative overflow-x-auto overflow-y-hidden -mx-1 px-1 pb-1 scrollbar-thin">
        <div className="flex items-stretch gap-2 min-w-max">
          <AnimatePresence initial={false}>
            {recent.map((e) => (
              <RailCard
                key={e.id}
                event={e}
                onClick={() => {
                  if (e.detection_id) {
                    router.push(`/evidence?detection=${e.detection_id}`);
                  }
                }}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Edge fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 left-0  w-8  bg-gradient-to-r from-background to-transparent" />
      </div>
    </section>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────

function RailCard({ event, onClick }: { event: OperationalEvent; onClick?: () => void }) {
  const Icon = KIND_ICON[event.kind];
  const tint = SEV_TINT[event.severity];
  const clickable = Boolean(event.detection_id);

  return (
    <motion.button
      layout
      type="button"
      disabled={!clickable}
      onClick={onClick}
      initial={{ opacity: 0, x: -16, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 16, scale: 0.96 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      whileHover={clickable ? { y: -2 } : undefined}
      className={cn(
        "shrink-0 w-[260px] text-left rounded-xl border border-border bg-surface px-3 py-2.5 ring-1",
        tint.ring,
        clickable
          ? "hover:border-border-strong hover:shadow-card-md cursor-pointer"
          : "cursor-default opacity-95",
        "transition-[transform,box-shadow,border-color] duration-200",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60", tint.accent)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn("inline-flex h-4 px-1 rounded text-[9px] font-bold uppercase tracking-[0.14em]", tint.chip)}>
              {event.severity}
            </span>
            <span className="text-2xs font-mono text-foreground-subtle truncate">
              {formatDistanceToNowStrict(new Date(event.receivedAt))} ago
            </span>
          </div>
          <p className="text-xs font-semibold text-foreground leading-tight truncate">
            {event.title}
          </p>
          <div className="mt-1 flex items-center gap-2 text-2xs font-mono text-foreground-subtle">
            {event.plate && <span className="font-bold tracking-wider text-foreground">{event.plate}</span>}
            {event.district && (
              <span className="truncate min-w-0">{event.district}</span>
            )}
          </div>
          {typeof event.threat_score === "number" && (
            <div className="mt-1.5 relative h-1 rounded-full bg-stone-200/40 dark:bg-stone-800/50 overflow-hidden">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  event.severity === "critical" ? "bg-status-danger" :
                  event.severity === "high"     ? "bg-[#bd8658]" :
                  event.severity === "medium"   ? "bg-peach-500" :
                  event.severity === "low"      ? "bg-peach-400" :
                                                   "bg-sage-500"
                )}
                style={{ width: `${Math.max(4, Math.min(100, event.threat_score))}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────

function RailEmpty() {
  return (
    <section
      aria-label="Live intelligence rail · idle"
      className="w-full"
    >
      <div className="flex items-center justify-between px-1 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground-subtle/40" />
          <span className="text-2xs font-bold uppercase tracking-[0.18em] text-foreground-subtle">
            Intelligence rail
          </span>
          <span className="text-2xs font-mono text-foreground-subtle/70">· standby</span>
        </div>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-surface/60 px-3.5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 text-foreground-subtle">
            <Radio className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">All quiet — system nominal</p>
            <p className="mt-0.5 text-2xs text-foreground-subtle">
              Events from live cameras and Controlled-Replay sessions surface here in real time.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
