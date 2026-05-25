"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight, Camera, Cpu, Radio } from "lucide-react";

import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { cn, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DetectionEvent {
  id: string;
  type: "detection" | string;
  camera_code?: string;
  camera_name?: string;
  camera_location?: string;
  plate?: string;
  ocr_confidence?: number;
  vehicle_confidence?: number;
  vehicle_category?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  is_violation?: boolean;
  violation_type?: string;
  processing_time_ms?: number;
  timestamp: string;
}

const MAX_ITEMS = 24;

function confidencePill(c?: number) {
  if (c === undefined) return null;
  const pct = (c * 100).toFixed(1);
  if (c >= 0.9) return <Badge variant="sage" size="sm">{pct}%</Badge>;
  if (c >= 0.75) return <Badge variant="bronze" size="sm">{pct}%</Badge>;
  return <Badge variant="peach" size="sm">{pct}%</Badge>;
}

export function LiveActivityStream() {
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [totalSeen, setTotalSeen] = useState(0);

  const handleMessage = useCallback((data: unknown) => {
    const d = data as DetectionEvent;
    if (!d || d.type !== "detection" || !d.id) return;
    setEvents((prev) => [d, ...prev].slice(0, MAX_ITEMS));
    setTotalSeen((n) => n + 1);
  }, []);

  const { status } = useWebSocket("/ws/detections", {
    onMessage: handleMessage,
    autoReconnect: true,
  });

  const liveBanner = useMemo(() => {
    if (status === "connected")
      return { label: "Live", variant: "sage" as const, dot: true, pulse: true };
    if (status === "connecting" || status === "disconnected")
      return { label: "Reconnecting", variant: "bronze" as const, dot: true, pulse: true };
    return { label: "Offline", variant: "danger" as const, dot: true, pulse: false };
  }, [status]);

  return (
    <section className="surface-panel flex flex-col h-[560px]">
      <header className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-border">
        <div>
          <p className="section-eyebrow">Real-time stream</p>
          <h3 className="font-display text-base font-semibold text-foreground tracking-tight mt-0.5">
            Live AI activity
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={liveBanner.variant} withDot pulse={liveBanner.pulse} size="md">
            {liveBanner.label}
          </Badge>
          <Badge variant="neutral" size="md" className="tabular-nums">
            <Radio className="h-3 w-3 mr-0.5" />
            {totalSeen.toLocaleString("en-IN")}
          </Badge>
        </div>
      </header>

      <ScrollArea className="flex-1">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <div className="h-11 w-11 rounded-full bg-stone-100 border border-border flex items-center justify-center text-foreground-subtle">
              <Cpu className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">Awaiting detections</p>
            <p className="mt-1 text-xs text-foreground-subtle max-w-xs">
              The activity stream populates the moment cameras report new ANPR reads.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: -8, backgroundColor: "rgba(169,179,148,0.18)" }}
                  animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="px-5 sm:px-6 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "shrink-0 h-9 w-9 rounded-lg flex items-center justify-center",
                        e.is_violation
                          ? "bg-peach-100 text-peach-700 ring-1 ring-peach-200"
                          : "bg-sage-100 text-sage-700 ring-1 ring-sage-200"
                      )}
                    >
                      {e.is_violation ? <AlertTriangle className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="plate-chip">{e.plate ?? "—"}</span>
                        {e.is_violation && (
                          <Badge variant="peach" size="sm">{e.violation_type ?? "Violation"}</Badge>
                        )}
                        {confidencePill(e.ocr_confidence)}
                      </div>
                      <p className="mt-1 text-xs text-foreground-muted truncate">
                        <span className="text-foreground">{e.vehicle_make ?? ""} {e.vehicle_model ?? ""}</span>
                        {(e.vehicle_make || e.vehicle_model) && e.camera_location && (
                          <span className="text-foreground-subtle"> · </span>
                        )}
                        <span className="text-foreground-subtle">{e.camera_location ?? e.camera_name ?? ""}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xs font-mono text-foreground-subtle tabular-nums">
                        {timeAgo(e.timestamp)}
                      </p>
                      {e.processing_time_ms !== undefined && (
                        <p className="text-2xs font-mono text-foreground-subtle tabular-nums mt-0.5">
                          {e.processing_time_ms}ms
                        </p>
                      )}
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </ScrollArea>

      <footer className="px-5 sm:px-6 py-3 border-t border-border bg-stone-50/60 rounded-b-xl">
        <a
          href="/detections"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-sage-700 hover:text-sage-900 transition-colors"
        >
          Open detection inspector
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </footer>
    </section>
  );
}
