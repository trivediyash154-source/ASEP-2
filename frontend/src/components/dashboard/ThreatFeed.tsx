"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, ShieldCheck } from "lucide-react";

import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { cn, timeAgo } from "@/lib/utils";

interface DetectionEvent {
  id: string;
  type: "detection" | string;
  camera_code?: string;
  camera_name?: string;
  camera_location?: string;
  plate?: string;
  ocr_confidence?: number;
  vehicle_confidence?: number;
  is_violation?: boolean;
  violation_type?: string;
  timestamp: string;
}

const MAX_ITEMS = 40;

/**
 * Left zone of the command center — the live threat feed. Violations
 * arrive as full alert rows with threat colouring; compliant passes
 * print as dim one-line wire entries so the operator keeps ambient
 * awareness without alert fatigue.
 */
export function ThreatFeed({ className }: { className?: string }) {
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [alertCount, setAlertCount] = useState(0);

  const handleMessage = useCallback((data: unknown) => {
    const d = data as DetectionEvent;
    if (!d || d.type !== "detection" || !d.id) return;
    setEvents((prev) => [d, ...prev].slice(0, MAX_ITEMS));
    if (d.is_violation) setAlertCount((n) => n + 1);
  }, []);

  const { status } = useWebSocket("/ws/detections", {
    onMessage: handleMessage,
    autoReconnect: true,
  });
  const live = status === "connected";

  const compliancePct =
    events.length >= 3
      ? (events.filter((e) => !e.is_violation).length / events.length) * 100
      : null;

  return (
    <section className={cn("op-surface flex flex-col min-h-0", className)} aria-label="Threat feed">
      <header className="ops-header shrink-0">
        <span className="ops-title">Threat Feed</span>
        <span className="ops-meta flex items-center gap-2">
          <span className={cn(
            "h-1.5 w-1.5 rounded-full",
            live ? "bg-status-success animate-pulse-soft" : "bg-status-danger"
          )} />
          {alertCount} alerts
        </span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center">
            <span className="font-mono text-2xs uppercase tracking-[0.16em] text-foreground-subtle">
              {live ? "Monitoring · no incidents" : "Reconnecting to stream…"}
            </span>
          </div>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {events.map((e) =>
                e.is_violation ? (
                  <motion.li
                    key={e.id}
                    layout="position"
                    initial={{ opacity: 0, x: -10, backgroundColor: "rgba(237,159,126,0.16)" }}
                    animate={{ opacity: 1, x: 0, backgroundColor: "rgba(0,0,0,0)" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="relative px-4 py-2.5 border-b border-border/60"
                  >
                    <span className="severity-rail-high" aria-hidden />
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <AlertTriangle className="h-3 w-3 text-threat-high shrink-0" />
                        <span className="plate-chip text-[0.6875rem] py-0">{e.plate ?? "—"}</span>
                      </span>
                      <span className="font-mono text-2xs text-foreground-subtle tabular-nums shrink-0">
                        {timeAgo(e.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-2xs font-semibold text-threat-high uppercase tracking-[0.08em] font-mono truncate">
                      {(e.violation_type ?? "violation").replace(/_/g, " ")}
                    </p>
                    <p className="mt-0.5 font-mono text-2xs text-foreground-subtle truncate">
                      {e.camera_code ?? ""} · {e.camera_location ?? e.camera_name ?? "—"}
                    </p>
                  </motion.li>
                ) : (
                  <motion.li
                    key={e.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-4 py-1.5 border-b border-border/40 flex items-center gap-2"
                  >
                    <ShieldCheck className="h-2.5 w-2.5 text-threat-clear/70 shrink-0" />
                    <span className="font-mono text-2xs text-foreground-subtle truncate flex-1">
                      {e.plate ?? "—"} · clear
                    </span>
                    <span className="font-mono text-2xs text-foreground-subtle/60 tabular-nums shrink-0">
                      {timeAgo(e.timestamp)}
                    </span>
                  </motion.li>
                )
              )}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Compliance pulse — live ratio of the current stream window */}
      <footer className="shrink-0 border-t border-border bg-muted/30">
        <div className="px-4 pt-2 pb-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
              Compliance Pulse
            </span>
            <span className={cn(
              "font-mono text-2xs font-semibold tabular-nums",
              compliancePct == null ? "text-foreground-subtle"
                : compliancePct >= 90 ? "text-threat-clear"
                : compliancePct >= 75 ? "text-threat-medium" : "text-threat-high"
            )}>
              {compliancePct != null ? `${compliancePct.toFixed(0)}%` : "—"}
            </span>
          </div>
          <div className="h-1 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-700 ease-out",
                compliancePct == null ? "bg-stone-300"
                  : compliancePct >= 90 ? "bg-sage-500"
                  : compliancePct >= 75 ? "bg-bronze-400" : "bg-peach-500"
              )}
              style={{ width: `${compliancePct ?? 0}%` }}
            />
          </div>
        </div>
        <div className="px-4 pb-2">
          <a
            href="/detections"
            className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.1em] text-sage-700 dark:text-sage-400 hover:text-sage-900 dark:hover:text-sage-300 transition-colors"
          >
            Full detection log <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </section>
  );
}
