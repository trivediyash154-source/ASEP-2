"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, CheckCircle, Clock, Eye, ShieldAlert, WifiOff,
} from "lucide-react";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import type { DetectionEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const MAX = 12;

function isValid(d: unknown): d is DetectionEvent {
  if (!d || typeof d !== "object") return false;
  const o = d as Record<string, unknown>;
  return o["event_type"] === "detection_event" &&
    typeof (o["detection"] as any)?.["detection_id"] === "string";
}

export function LiveDetectionFeed() {
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [counts, setCounts] = useState({ total: 0, violations: 0 });
  const seen = useRef(new Set<string>());

  const onMessage = useCallback((data: unknown) => {
    if (!isValid(data)) return;
    const id = data.detection.detection_id;
    if (seen.current.has(id)) return;
    seen.current.add(id);
    if (seen.current.size > 500) seen.current.delete(seen.current.values().next().value!);
    setEvents((p) => [data, ...p].slice(0, MAX));
    setCounts((c) => ({
      total: c.total + 1,
      violations: c.violations + (data.detection.is_violation ? 1 : 0),
    }));
  }, []);

  const { status } = useWebSocket("/ws/detections", { onMessage, autoReconnect: true });
  const isLive = status === "connected";

  return (
    <div className="op-surface flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn("status-dot", isLive ? "status-dot-live" : "status-dot-error")} />
            <p className="text-sm font-semibold text-foreground">Live Detections</p>
          </div>
          <p className="text-2xs text-foreground-subtle font-mono tabular-nums">
            {counts.total} detected ·{" "}
            <span className="text-peach-600 dark:text-peach-400">{counts.violations} violations</span>
          </p>
        </div>
        {!isLive && (
          <div className="flex items-center gap-1.5 text-peach-600 dark:text-peach-400 text-2xs font-mono">
            <WifiOff className="h-3.5 w-3.5" />
            <span className="uppercase tracking-[0.1em]">Reconnecting</span>
          </div>
        )}
        {isLive && (
          <span className="text-2xs font-mono uppercase tracking-[0.1em] text-sage-600 dark:text-sage-400 bg-sage-50 dark:bg-sage-900/30 px-2 py-0.5 rounded border border-sage-200 dark:border-sage-700">
            WebSocket
          </span>
        )}
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/50">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Eye className="h-8 w-8 text-foreground-subtle/40 mb-3" />
            <p className="text-sm text-foreground-muted font-medium">No detections yet</p>
            <p className="text-2xs text-foreground-subtle mt-1">Awaiting live vehicle events…</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((e, i) => (
              <FeedRow key={e.detection.detection_id} event={e} isNew={i === 0} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-5 py-2.5 border-t border-border flex items-center justify-between text-2xs font-mono text-foreground-subtle bg-muted/40">
        <span className="uppercase tracking-[0.1em]">Session Total</span>
        <span className="tabular-nums text-foreground font-semibold">{counts.total.toLocaleString()}</span>
      </div>
    </div>
  );
}

function FeedRow({ event, isNew }: { event: DetectionEvent; isNew: boolean }) {
  const det = event.detection;
  const viol = det.is_violation;
  const conf = Math.round(det.vehicle_confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors duration-150",
        isNew && viol  ? "bg-peach-50/60 dark:bg-peach-900/15" :
        isNew          ? "bg-sage-50/40 dark:bg-sage-900/10" :
                         "hover:bg-muted/50"
      )}
    >
      <div className="mt-0.5 shrink-0">
        {viol
          ? <ShieldAlert className="h-4 w-4 text-peach-600 dark:text-peach-400" />
          : det.plate_number
            ? <CheckCircle className="h-4 w-4 text-sage-600 dark:text-sage-400" />
            : <Eye className="h-4 w-4 text-foreground-subtle" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "font-mono text-sm font-bold",
            det.plate_number ? "text-foreground" : "text-foreground-subtle italic text-xs"
          )}>
            {det.plate_number ?? "Unread"}
          </span>
          <span className="text-2xs text-foreground-subtle capitalize">{det.vehicle_type}</span>
          {viol && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs font-semibold bg-peach-50 border border-peach-200 text-peach-700 dark:bg-peach-900/30 dark:border-peach-700/40 dark:text-peach-300">
              <AlertTriangle className="h-2.5 w-2.5" />
              {det.violation_type?.replace(/_/g, " ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-2xs text-foreground-subtle font-mono tabular-nums">
          <span>VEH {conf}%</span>
          {det.ocr_confidence != null && det.ocr_confidence > 0 &&
            <span>OCR {Math.round(det.ocr_confidence * 100)}%</span>}
          <span>{det.processing_time_ms}ms</span>
        </div>
        {viol && det.violations && det.violations.length > 0 && (
          <p className="text-2xs text-peach-600 dark:text-peach-400 mt-1 flex items-center gap-1 truncate">
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
            {det.violations[0].description}
            {det.total_fine ? ` — ₹${det.total_fine.toLocaleString()}` : ""}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        <div className="flex items-center gap-1 text-2xs text-foreground-subtle font-mono tabular-nums">
          <Clock className="h-2.5 w-2.5" />
          {format(new Date(event.timestamp), "HH:mm:ss")}
        </div>
      </div>
    </motion.div>
  );
}
