"use client";

import { useEffect, useState, useRef } from "react";
import {
  AlertTriangle,
  Bell,
  Camera,
  CheckCircle2,
  ChevronDown,
  Cpu,
  HelpCircle,
  Keyboard,
  Radio,
  Search,
  ShieldAlert,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { useAuthStore } from "@/lib/stores/auth.store";
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
import { format } from "date-fns";

interface TopBarProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}

/* ── Notification data ──────────────────────────────────────────────── */
type NotifKind = "detection" | "violation" | "camera" | "system" | "challan";

interface Notif {
  id: string;
  kind: NotifKind;
  title: string;
  detail: string;
  ts: Date;
  read: boolean;
}

const SEED_NOTIFS: Notif[] = [
  { id: "n1", kind: "violation",  title: "CRITICAL: MH12AB1234",      detail: "Expired insurance — challan auto-generated",   ts: new Date(Date.now() - 1000 * 60 * 2),  read: false },
  { id: "n2", kind: "detection",  title: "High-confidence detection",  detail: "Plate MH14CD5678 — OCR 97% — Thane NH-3",     ts: new Date(Date.now() - 1000 * 60 * 5),  read: false },
  { id: "n3", kind: "challan",    title: "Challan CH-0842 issued",     detail: "₹2,000 · Expired permit · MH04EF9012",         ts: new Date(Date.now() - 1000 * 60 * 11), read: false },
  { id: "n4", kind: "camera",     title: "Camera CAM-003 degraded",    detail: "Stream quality dropped below threshold",        ts: new Date(Date.now() - 1000 * 60 * 22), read: true  },
  { id: "n5", kind: "system",     title: "AI pipeline latency spike",  detail: "Processing time +38ms vs baseline",             ts: new Date(Date.now() - 1000 * 60 * 35), read: true  },
  { id: "n6", kind: "violation",  title: "Repeat offender flagged",    detail: "MH20GH3456 — 4th violation this month",         ts: new Date(Date.now() - 1000 * 60 * 58), read: true  },
];

const NOTIF_CFG: Record<NotifKind, { icon: React.ElementType; color: string; badge: string }> = {
  detection: { icon: Radio,       color: "text-sage-600 dark:text-sage-400",   badge: "bg-sage-100 dark:bg-sage-800/40" },
  violation: { icon: ShieldAlert, color: "text-peach-600 dark:text-peach-400", badge: "bg-peach-50 dark:bg-peach-900/30" },
  camera:    { icon: Camera,      color: "text-bronze-600 dark:text-bronze-400", badge: "bg-bronze-50 dark:bg-bronze-900/30" },
  system:    { icon: Cpu,         color: "text-foreground-muted",               badge: "bg-muted" },
  challan:   { icon: CheckCircle2, color: "text-sage-700 dark:text-sage-400",   badge: "bg-sage-50 dark:bg-sage-900/20" },
};

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
function NotificationCenter({ onClose }: { onClose: () => void }) {
  const [notifs, setNotifs] = useState(SEED_NOTIFS);
  const unread = notifs.filter(n => !n.read).length;

  const markAll = () => setNotifs(n => n.map(x => ({ ...x, read: true })));
  const dismiss = (id: string) => setNotifs(n => n.filter(x => x.id !== id));

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "absolute right-0 top-full mt-2 w-[400px] z-50",
        "bg-surface border border-border rounded-xl shadow-popover overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-foreground-muted" />
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unread > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-peach-500 text-white text-2xs font-bold px-1.5">
              {unread}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={markAll}
              className="text-2xs text-sage-600 dark:text-sage-400 hover:underline font-semibold"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded-md text-foreground-subtle hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60">
        <AnimatePresence initial={false}>
          {notifs.map((n) => {
            const cfg = NOTIF_CFG[n.kind];
            const Icon = cfg.icon;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex items-start gap-3 px-5 py-3.5 transition-colors group",
                  !n.read ? "bg-muted/60" : "hover:bg-muted/30"
                )}
              >
                <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", cfg.badge)}>
                  <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-xs font-semibold leading-snug truncate", !n.read ? "text-foreground" : "text-foreground-muted")}>
                      {n.title}
                    </p>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-peach-500 shrink-0 mt-1" />}
                  </div>
                  <p className="text-2xs text-foreground-subtle mt-0.5 leading-snug">{n.detail}</p>
                  <p className="text-2xs text-foreground-subtle/60 font-mono mt-1">
                    {format(n.ts, "HH:mm · dd MMM")}
                  </p>
                </div>
                <button
                  onClick={() => dismiss(n.id)}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded text-foreground-subtle hover:text-foreground transition-all"
                  aria-label="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {notifs.length === 0 && (
          <div className="py-10 text-center">
            <CheckCircle2 className="h-6 w-6 text-sage-500 mx-auto mb-2" />
            <p className="text-sm text-foreground-muted font-medium">All caught up</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-border bg-muted/30 text-center">
        <span className="text-2xs text-foreground-subtle font-mono uppercase tracking-[0.1em]">
          Realtime · VAAHAN AI Event Bus
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
          VAAHAN AI · Maharashtra Traffic Enforcement
        </p>
      </div>
    </motion.div>
  );
}

/* ── TopBar ─────────────────────────────────────────────────────────── */
export function TopBar({ title, subtitle, eyebrow, actions }: TopBarProps) {
  const { status } = useWebSocket("/ws/detections", { autoReconnect: true });
  const { user, logout } = useAuthStore();
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
  const UNREAD_COUNT = SEED_NOTIFS.filter(n => !n.read).length;

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

          {/* Search */}
          <div className="hidden lg:flex items-center gap-2 h-9 w-64 px-3 rounded-lg
                          bg-surface border border-border hover:border-border-strong transition-colors">
            <Search className="h-3.5 w-3.5 text-foreground-subtle shrink-0" />
            <input
              type="text"
              placeholder="Search plates, challans…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle/60 outline-none"
            />
            <Kbd>⌘K</Kbd>
          </div>

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
              {UNREAD_COUNT > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-peach-500 ring-2 ring-surface" />
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
