"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FileText,
  Fingerprint,
  HelpCircle,
  Keyboard,
  Radio,
  Search,
  ShieldAlert,
  Sparkles,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { useAuthStore } from "@/lib/stores/auth.store";
import {
  useNotificationsStore,
  selectFilteredEvents,
  selectUnreadCount,
  type NotificationKind,
  type NotificationSeverity,
  type OperationalEvent,
} from "@/lib/stores/notifications.store";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNowStrict } from "date-fns";
import { OPEN_PALETTE_EVENT } from "@/components/shared/CommandPalette";

interface TopBarProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}

/* ── Notification visual config ──────────────────────────────────────── */

const KIND_CFG: Record<NotificationKind, { icon: React.ElementType; label: string }> = {
  detection:       { icon: Radio,       label: "Detection" },
  challan_issued:  { icon: FileText,    label: "Challan issued" },
  blacklist_hit:   { icon: ShieldAlert, label: "Blacklist hit" },
  repeat_offender: { icon: AlertTriangle, label: "Repeat offender" },
  stolen_match:    { icon: AlertOctagon, label: "BOLO match" },
  ocr_recovery:    { icon: Sparkles,    label: "OCR recovery" },
  camera_offline:  { icon: Camera,      label: "Camera offline" },
  system_warning:  { icon: Cpu,         label: "System warning" },
  system_error:    { icon: AlertOctagon, label: "System error" },
};

const SEVERITY_CFG: Record<NotificationSeverity, {
  badge: string;       // tailwind background + border for the icon block
  iconClass: string;   // icon color
  chip: string;        // chip color for severity label
  glow: string;        // outer glow (used by unread + critical events)
  label: string;
}> = {
  info:     { badge: "bg-sage-100 dark:bg-sage-800/30 border border-sage-300/40", iconClass: "text-sage-700 dark:text-sage-200",
              chip: "bg-sage-500/15 text-sage-800 dark:text-sage-200",
              glow: "shadow-[0_0_0_1px_rgba(127,136,118,0.18)]", label: "INFO" },
  low:      { badge: "bg-peach-100 dark:bg-peach-900/30 border border-peach-300/40", iconClass: "text-peach-700 dark:text-peach-200",
              chip: "bg-peach-500/15 text-peach-800 dark:text-peach-100",
              glow: "shadow-[0_0_0_1px_rgba(237,159,126,0.18)]", label: "LOW" },
  medium:   { badge: "bg-peach-200/60 dark:bg-peach-900/40 border border-peach-400/50", iconClass: "text-peach-800 dark:text-peach-100",
              chip: "bg-peach-500/22 text-peach-800 dark:text-peach-100",
              glow: "shadow-[0_0_0_1px_rgba(237,159,126,0.28)]", label: "MED" },
  high:     { badge: "bg-[#bd8658]/15 border border-[#bd8658]/40", iconClass: "text-[#7a4a28] dark:text-[#fcc99a]",
              chip: "bg-[#bd8658]/20 text-[#7a4a28] dark:text-[#fcc99a]",
              glow: "shadow-[0_0_0_1px_rgba(189,134,88,0.34)]", label: "HIGH" },
  critical: { badge: "bg-status-danger/15 border border-status-danger/40", iconClass: "text-status-danger",
              chip: "bg-status-danger/15 text-status-danger",
              glow: "shadow-[0_0_18px_-6px_var(--status-danger,#d23a3a)]", label: "CRIT" },
  system:   { badge: "bg-stone-100 dark:bg-stone-800/40 border border-border", iconClass: "text-foreground-muted",
              chip: "bg-stone-500/15 text-foreground-muted",
              glow: "", label: "SYS" },
};

const SEVERITY_FILTER_OPTIONS: Array<{ id: NotificationSeverity[] | "all"; label: string }> = [
  { id: "all",                          label: "All" },
  { id: ["critical", "high"],           label: "High risk" },
  { id: ["medium"],                     label: "Medium" },
  { id: ["info", "low", "ocr_recovery" as never] as NotificationSeverity[], label: "Info" },
];

const SHORTCUTS = [
  { key: "F",     desc: "Toggle tactical fullscreen wall" },
  { key: "1–9",   desc: "Focus camera by position" },
  { key: "Esc",   desc: "Close evidence drawer / panel" },
  { key: "⌘ K",   desc: "Global search" },
];

const PIPELINE_STATUS = [
  { label: "YOLOv8n Detection",   ok: true  },
  { label: "EasyOCR Engine",      ok: true  },
  { label: "Celery Workers",      ok: true  },
  { label: "PostgreSQL",          ok: true  },
  { label: "WebSocket Bus",       ok: true  },
  { label: "Evidence Storage",    ok: true  },
];

/* ── Notification Center ────────────────────────────────────────────── */

function severityMatches(target: NotificationSeverity[] | "all", s: NotificationSeverity): boolean {
  if (target === "all") return true;
  return target.includes(s);
}

function NotificationCenter({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const events       = useNotificationsStore(selectFilteredEvents);
  const total        = useNotificationsStore((s) => s.events.length);
  const filterSev    = useNotificationsStore((s) => s.filterSeverity);
  const filterDist   = useNotificationsStore((s) => s.filterDistrict);
  const markRead     = useNotificationsStore((s) => s.markRead);
  const markAllRead  = useNotificationsStore((s) => s.markAllRead);
  const dismiss      = useNotificationsStore((s) => s.dismiss);
  const clearAll     = useNotificationsStore((s) => s.clearAll);
  const setFilterSev = useNotificationsStore((s) => s.setFilterSeverity);
  const setFilterDist = useNotificationsStore((s) => s.setFilterDistrict);

  const unread = useNotificationsStore(selectUnreadCount);

  const districts = useMemo(() => {
    const counts = new Map<string, number>();
    useNotificationsStore.getState().events.forEach((e) => {
      if (e.district) counts.set(e.district, (counts.get(e.district) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [total]);

  function openEvidence(e: OperationalEvent) {
    if (!e.detection_id) return;
    router.push(`/evidence?detection=${e.detection_id}`);
    markRead(e.id);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "absolute right-0 top-full mt-2 w-[440px] max-w-[94vw] z-50",
        "bg-surface border border-border rounded-xl shadow-popover overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-foreground-muted" />
            <span className="text-sm font-semibold text-foreground">Intelligence feed</span>
            {unread > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-peach-500 text-white text-2xs font-bold px-1.5">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center h-6 px-1.5 rounded text-2xs font-semibold text-sage-700 dark:text-sage-300 hover:bg-sage-500/10 transition-colors"
              >
                Mark all read
              </button>
            )}
            {total > 0 && (
              <button
                onClick={clearAll}
                className="inline-flex items-center h-6 px-1.5 rounded text-2xs font-semibold text-foreground-subtle hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                Clear
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-md text-foreground-subtle hover:text-foreground hover:bg-muted transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Severity filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto -mx-0.5 pb-0.5">
          {SEVERITY_FILTER_OPTIONS.map((opt) => {
            const active =
              (opt.id === "all" && filterSev === "all") ||
              (Array.isArray(opt.id) && Array.isArray(filterSev) &&
                opt.id.length === filterSev.length &&
                opt.id.every((x) => (filterSev as NotificationSeverity[]).includes(x)));
            return (
              <button
                key={opt.label}
                onClick={() => setFilterSev(opt.id)}
                className={cn(
                  "shrink-0 h-6 px-2 rounded-md text-2xs font-bold uppercase tracking-[0.12em] transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted/50 text-foreground-muted hover:bg-muted hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            );
          })}
          {districts.length > 0 && (
            <>
              <span className="mx-1 h-3 w-px bg-border" />
              {districts.map(([d, count]) => {
                const active = filterDist === d;
                return (
                  <button
                    key={d}
                    onClick={() => setFilterDist(active ? "" : d)}
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-md text-2xs font-medium transition-colors",
                      active
                        ? "bg-sage-600 text-white"
                        : "bg-muted/50 text-foreground-muted hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className="truncate max-w-[120px]">{d}</span>
                    <span className="text-2xs opacity-80 font-mono">{count}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Notifications list */}
      <div className="max-h-[460px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const kindCfg = KIND_CFG[e.kind];
            const sevCfg = SEVERITY_CFG[e.severity];
            const Icon = kindCfg.icon;
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "group relative px-4 py-3 border-b border-border/60 transition-colors",
                  !e.read ? "bg-muted/40" : "hover:bg-muted/20",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    sevCfg.badge,
                    e.severity === "critical" && sevCfg.glow,
                  )}>
                    <Icon className={cn("h-4 w-4", sevCfg.iconClass)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className={cn(
                        "inline-flex items-center h-4 px-1 rounded text-[9px] font-bold uppercase tracking-[0.14em]",
                        sevCfg.chip,
                      )}>
                        {sevCfg.label}
                      </span>
                      <span className="text-2xs font-mono uppercase tracking-[0.10em] text-foreground-subtle">
                        {kindCfg.label}
                      </span>
                      {!e.read && <span className="h-1.5 w-1.5 rounded-full bg-peach-500" />}
                    </div>
                    <p className={cn(
                      "text-xs font-semibold leading-snug truncate",
                      !e.read ? "text-foreground" : "text-foreground-muted",
                    )}>
                      {e.title}
                    </p>
                    <p className="text-2xs text-foreground-muted mt-0.5 leading-snug">{e.detail}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-2xs text-foreground-subtle font-mono">
                      <span>{formatDistanceToNowStrict(new Date(e.receivedAt))} ago</span>
                      {e.district && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[140px]">{e.district}</span>
                        </>
                      )}
                      {typeof e.threat_score === "number" && (
                        <>
                          <span>·</span>
                          <span>threat {e.threat_score}/100</span>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {e.detection_id && (
                        <button
                          onClick={() => openEvidence(e)}
                          className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md border border-border bg-surface text-2xs font-semibold text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          Evidence
                        </button>
                      )}
                      {e.detection_id && (
                        <button
                          onClick={() => openEvidence(e)}
                          className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md border border-border bg-surface text-2xs font-semibold text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
                        >
                          <Fingerprint className="h-3 w-3" />
                          Dossier
                        </button>
                      )}
                      {!e.read && (
                        <button
                          onClick={() => markRead(e.id)}
                          className="inline-flex items-center h-6 px-1.5 rounded-md text-2xs font-semibold text-foreground-muted hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => dismiss(e.id)}
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded text-foreground-subtle hover:text-foreground transition-all"
                    aria-label="Dismiss"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {events.length === 0 && (
          <div className="py-12 text-center px-6">
            <CheckCircle2 className="h-6 w-6 text-sage-500 mx-auto mb-2" />
            <p className="text-sm text-foreground-muted font-medium">
              {total === 0 ? "No events yet" : "No events match the current filters"}
            </p>
            <p className="mt-1 text-2xs text-foreground-subtle">
              {total === 0
                ? "The intelligence bus is live — events from /demo replays and live cameras will land here."
                : "Adjust the severity or district filters above."}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
        <span className="text-2xs text-foreground-subtle font-mono uppercase tracking-[0.1em]">
          Realtime · VAAHAN AI event bus
        </span>
        <span className="text-2xs text-foreground-subtle font-mono tabular-nums">
          {events.length}/{total} shown
        </span>
      </div>
    </motion.div>
  );
}

/* ── Help Panel ─────────────────────────────────────────────────────── */
function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "absolute right-0 top-full mt-2 w-[380px] z-50",
        "bg-surface border border-border rounded-xl shadow-popover overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-foreground-muted" />
          <span className="text-sm font-semibold text-foreground">Operational Guide</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-md text-foreground-subtle hover:text-foreground hover:bg-muted transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-5 space-y-5 max-h-[480px] overflow-y-auto">

        {/* Keyboard shortcuts */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Keyboard className="h-3.5 w-3.5 text-foreground-subtle" />
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">Keyboard Shortcuts</p>
          </div>
          <div className="space-y-2">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">{s.desc}</span>
                <span className="font-mono text-2xs font-semibold bg-stone-100 dark:bg-stone-800 border border-border text-foreground-muted px-2 py-0.5 rounded shrink-0">
                  {s.key}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline status */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-3.5 w-3.5 text-foreground-subtle" />
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">AI Pipeline Diagnostics</p>
          </div>
          <div className="space-y-1.5">
            {PIPELINE_STATUS.map((p) => (
              <div key={p.label} className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">{p.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", p.ok ? "bg-status-success" : "bg-status-danger")} />
                  <span className={cn("text-2xs font-semibold font-mono", p.ok ? "text-sage-600 dark:text-sage-400" : "text-peach-600")}>
                    {p.ok ? "OK" : "ERR"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* OCR confidence guide */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-3.5 w-3.5 text-foreground-subtle" />
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">OCR Confidence Levels</p>
          </div>
          <div className="space-y-1.5">
            {[
              { range: "≥ 85%", label: "High confidence — plate verified", color: "text-sage-700 dark:text-sage-400" },
              { range: "65–84%", label: "Medium confidence — manual review advised", color: "text-bronze-700 dark:text-bronze-400" },
              { range: "< 65%", label: "Low confidence — re-capture recommended", color: "text-peach-700 dark:text-peach-400" },
            ].map((r) => (
              <div key={r.range} className="flex items-start gap-2">
                <span className={cn("font-mono text-2xs font-bold shrink-0 mt-0.5", r.color)}>{r.range}</span>
                <span className="text-2xs text-foreground-subtle">{r.label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="px-5 py-2.5 border-t border-border bg-muted/30">
        <p className="text-2xs text-foreground-subtle font-mono text-center uppercase tracking-[0.1em]">
          VAAHAN AI · Pune Regional Surveillance Network
        </p>
      </div>
    </motion.div>
  );
}

/* ── TopBar ─────────────────────────────────────────────────────────── */
export function TopBar({ title, subtitle, eyebrow, actions }: TopBarProps) {
  // Liveness signal: piggyback on the same WS that the global notification
  // bus uses — but here we only care about connection status, not payloads.
  // The actual event ingestion is owned by useNotificationBus, mounted once
  // at the dashboard layout root. No new socket is opened here.
  const { status } = useWebSocket("/ws/metrics", { autoReconnect: true });
  const { user, logout } = useAuthStore();
  const unreadNotifications = useNotificationsStore(selectUnreadCount);
  const [time, setTime] = useState<Date | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const helpRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close panels on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (helpRef.current  && !helpRef.current.contains(e.target as Node))  setShowHelp(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isLive = status === "connected";

  return (
    <header className={cn("sticky top-0 z-30 h-16 shrink-0 glass-warm border-b border-border")}>
      <div className="flex h-full items-center justify-between gap-4 px-6">

        {/* Title block */}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-foreground-subtle leading-none">
              {eyebrow}
            </p>
          )}
          <h1 className={cn(
            "font-display font-semibold text-foreground tracking-tight truncate",
            eyebrow ? "mt-1 text-base" : "text-base"
          )}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-foreground-subtle truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1.5">

          {/* Search → opens the global command palette */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
            className="hidden lg:flex items-center gap-2 h-9 w-64 px-3 rounded-lg
                       bg-surface border border-border hover:border-border-strong transition-colors
                       text-left cursor-pointer group"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5 text-foreground-subtle shrink-0" />
            <span className="flex-1 text-sm text-foreground-subtle/70 group-hover:text-foreground-subtle truncate">
              Jump to… plates, pages
            </span>
            <Kbd>⌘K</Kbd>
          </button>

          {/* Live status */}
          <div className={cn(
            "hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-2xs font-semibold tracking-[0.04em]",
            isLive
              ? "bg-sage-50 border-sage-200 text-sage-800 dark:bg-sage-900/30 dark:border-sage-700/50 dark:text-sage-300"
              : "bg-peach-50 border-peach-200 text-peach-800 dark:bg-peach-900/30 dark:border-peach-700/50 dark:text-peach-300"
          )}>
            {isLive ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-status-success opacity-60 animate-ping" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-status-success" />
                </span>
                <span className="uppercase tracking-[0.12em]">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span className="uppercase tracking-[0.12em]">Offline</span>
              </>
            )}
          </div>

          {/* Clock */}
          <div className="hidden xl:flex flex-col items-end leading-tight h-9 justify-center px-3 border-l border-border min-w-[88px]">
            <span className="font-mono text-xs font-semibold text-foreground tabular-nums signal-live">
              {time ? time.toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--"}
            </span>
            <span className="font-mono text-2xs text-foreground-subtle tabular-nums">
              {time ? time.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
            </span>
          </div>

          {/* Actions slot */}
          {actions}

          {/* Help */}
          <div ref={helpRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Operational guide"
              onClick={() => { setShowHelp(v => !v); setShowNotifs(false); }}
              className={cn(showHelp && "bg-muted text-foreground")}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <AnimatePresence>
              {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
            </AnimatePresence>
          </div>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => { setShowNotifs(v => !v); setShowHelp(false); }}
              className={cn("relative", showNotifs && "bg-muted text-foreground")}
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 480, damping: 22 }}
                  className="absolute top-0.5 right-0.5 h-4 min-w-4 px-1 rounded-full bg-peach-500 ring-2 ring-surface inline-flex items-center justify-center text-[9px] font-bold text-white tabular-nums"
                >
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </motion.span>
              )}
            </Button>
            <AnimatePresence>
              {showNotifs && <NotificationCenter onClose={() => setShowNotifs(false)} />}
            </AnimatePresence>
          </div>

          {/* User chip */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  "hidden md:flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-lg",
                  "border border-border bg-surface hover:bg-muted hover:border-border-strong",
                  "transition-colors duration-150"
                )}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sage-100 dark:bg-sage-800/50 text-sage-800 dark:text-sage-200 text-xs font-semibold">
                    {user.full_name?.charAt(0)?.toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {user.full_name?.split(" ")[0]}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-foreground-subtle" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{user.full_name}</DropdownMenuLabel>
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Preferences</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={logout}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
