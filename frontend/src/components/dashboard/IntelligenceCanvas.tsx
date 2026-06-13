"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AlertTriangle, Radio, ShieldCheck } from "lucide-react";

import { analyticsApi, detectionsApi } from "@/lib/api/endpoints";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { cn } from "@/lib/utils";
import type { Detection } from "@/lib/types";

import { PuneIntelMap, PUNE_TOTALS } from "./PuneIntelMap";

interface BucketRow {
  hour: string;
  total: number;
  violations: number;
}

interface TickerEvent {
  id: string;
  type: string;
  plate?: string;
  is_violation?: boolean;
  violation_type?: string;
  camera_location?: string;
  camera_name?: string;
  ocr_confidence?: number;
}

const OCR_TAPE_LEN = 9;

/**
 * Center zone of the command center — the live intelligence layer.
 * Statewide theatre map on top, the most recent AI read as a ticker,
 * and the 24-hour activity pulse along the bottom.
 */
export function IntelligenceCanvas({ className }: { className?: string }) {
  const [latest, setLatest] = useState<TickerEvent | null>(null);
  const [tape, setTape] = useState<TickerEvent[]>([]);

  const handleMessage = useCallback((data: unknown) => {
    const d = data as TickerEvent;
    if (!d || d.type !== "detection" || !d.id) return;
    setLatest(d);
    if (d.plate) setTape((prev) => [d, ...prev].slice(0, OCR_TAPE_LEN));
  }, []);
  useWebSocket("/ws/detections", { onMessage: handleMessage, autoReconnect: true });

  const { data: timeline } = useQuery({
    queryKey: ["analytics", "timeline", 24],
    queryFn: () => analyticsApi.timeline(24).then((r) => r.data as BucketRow[]),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Memory seed — the tape and ticker start from the evidence archive
  // instead of sitting blank until the first live read arrives.
  const { data: seed } = useQuery({
    queryKey: ["detections", "canvas-seed"],
    queryFn: () => detectionsApi.recent(OCR_TAPE_LEN).then((r) => r.data as Detection[]),
    staleTime: 60_000,
  });
  const seedEvents: TickerEvent[] = (seed ?? [])
    .filter((d) => d.detected_plate)
    .map((d) => ({
      id: d.id,
      type: "detection",
      plate: d.detected_plate,
      is_violation: d.is_violation,
      violation_type: d.violation_type,
      ocr_confidence: d.ocr_confidence,
      camera_location: "evidence archive",
    }));
  const shownLatest = latest ?? seedEvents[0] ?? null;
  const shownTape = tape.length > 0 ? tape : seedEvents;

  const rows = (timeline ?? []).map((r) => ({
    label: new Date(r.hour).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    compliant: Math.max(0, r.total - r.violations),
    violations: r.violations,
  }));

  return (
    <section className={cn("op-surface flex flex-col min-h-0", className)} aria-label="Live intelligence">
      <header className="ops-header shrink-0">
        <span className="ops-title">Live Intelligence · Pune Regional Network</span>
        <span className="ops-meta flex items-center gap-1.5">
          <Radio className="h-3 w-3 text-status-success animate-pulse-soft" />
          {PUNE_TOTALS.zones} zones · {PUNE_TOTALS.cameras} cams
        </span>
      </header>

      {/* Theatre map */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col">
        <PuneIntelMap embedded />
      </div>

      {/* Latest AI read ticker */}
      <div className="shrink-0 border-t border-border px-4 py-2 min-h-[44px] flex items-center overflow-hidden">
        <AnimatePresence mode="wait">
          {shownLatest ? (
            <motion.div
              key={shownLatest.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 min-w-0 w-full"
            >
              {shownLatest.is_violation
                ? <AlertTriangle className="h-3.5 w-3.5 text-threat-high shrink-0" />
                : <ShieldCheck className="h-3.5 w-3.5 text-threat-clear shrink-0" />}
              <span className="plate-chip text-[0.6875rem] py-0 shrink-0">{shownLatest.plate ?? "—"}</span>
              <span className={cn(
                "font-mono text-2xs font-semibold uppercase tracking-[0.08em] shrink-0",
                shownLatest.is_violation ? "text-threat-high" : "text-threat-clear"
              )}>
                {shownLatest.is_violation ? (shownLatest.violation_type ?? "violation").replace(/_/g, " ") : "clear"}
              </span>
              <span className="font-mono text-2xs text-foreground-subtle truncate flex-1">
                {shownLatest.camera_location ?? shownLatest.camera_name ?? ""}
              </span>
              {shownLatest.ocr_confidence != null && (
                <span className="font-mono text-2xs text-foreground-subtle tabular-nums shrink-0">
                  OCR {Math.round(shownLatest.ocr_confidence * 100)}%
                </span>
              )}
            </motion.div>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-mono text-2xs uppercase tracking-[0.16em] text-foreground-subtle"
            >
              Awaiting next AI read…
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* OCR tape — every plate the engine resolves rolls across here */}
      <div className="shrink-0 border-t border-border px-4 py-1.5 flex items-center gap-2 overflow-hidden min-h-[34px]">
        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle shrink-0">
          OCR Tape
        </span>
        <span className="h-3 w-px bg-border shrink-0" aria-hidden />
        {shownTape.length === 0 ? (
          <span className="font-mono text-2xs text-foreground-subtle/60">— — —</span>
        ) : (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <AnimatePresence initial={false}>
              {shownTape.map((t, i) => (
                <motion.span
                  key={t.id}
                  layout="position"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: i === 0 ? 1 : 0.85 - i * 0.07, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "shrink-0 font-mono text-2xs font-semibold tracking-wider px-1.5 py-0.5 rounded border tabular-nums",
                    t.is_violation
                      ? "border-peach-300/60 text-peach-700 dark:border-peach-700/50 dark:text-peach-300"
                      : "border-border text-foreground-muted"
                  )}
                >
                  {t.plate}
                  {t.ocr_confidence != null && (
                    <span className="ml-1 opacity-60">{Math.round(t.ocr_confidence * 100)}</span>
                  )}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 24h activity pulse */}
      <div className="shrink-0 border-t border-border px-2 pt-2 pb-1 h-[104px]">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
            Activity Pulse · 24h
          </span>
          <span className="font-mono text-2xs text-foreground-subtle tabular-nums">
            {rows.reduce((a, r) => a + r.compliant + r.violations, 0).toLocaleString("en-IN")} reads
          </span>
        </div>
        <ResponsiveContainer width="100%" height={68}>
          <AreaChart data={rows} margin={{ top: 2, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="pulse-compliant" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7F8876" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#7F8876" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="pulse-violation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ED9F7E" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#ED9F7E" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <Tooltip
              cursor={{ stroke: "#A9B394", strokeDasharray: "3 3" }}
              formatter={(v: number, name: string) => [v.toLocaleString("en-IN"), name === "compliant" ? "Compliant" : "Violations"]}
            />
            <Area type="monotone" dataKey="compliant" stackId="1" stroke="#969D87" strokeWidth={1.5} fill="url(#pulse-compliant)" />
            <Area type="monotone" dataKey="violations" stackId="1" stroke="#ED9F7E" strokeWidth={1.5} fill="url(#pulse-violation)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
