"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Camera as CameraIcon, Radio, ShieldCheck } from "lucide-react";

import { cn, timeAgo } from "@/lib/utils";
import { useCamerasStore } from "@/lib/stores/cameras.store";
import { Badge } from "@/components/ui/badge";

type Filter = "all" | "violations";

/**
 * Right-rail live incident stream. Mirrors the dashboard activity feed
 * but tuned for the surveillance wall — denser, with a violations-only
 * filter and clickable rows that open the evidence drawer.
 */
export function IncidentRail() {
  const events = useCamerasStore((s) => s.events);
  const select = useCamerasStore((s) => s.selectDetection);
  const selectCamera = useCamerasStore((s) => s.selectCamera);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = filter === "violations" ? events.filter((e) => e.is_violation) : events;
  const violationCount = events.filter((e) => e.is_violation).length;

  return (
    <aside className="surface-panel flex flex-col h-full min-h-[640px]">
      <header className="px-4 sm:px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-eyebrow">Intelligence rail</p>
            <h3 className="font-display text-sm font-semibold text-foreground tracking-tight mt-0.5">
              Live incident feed
            </h3>
          </div>
          <Badge variant="sage" withDot pulse size="sm">
            <Radio className="h-3 w-3 mr-0.5" />
            Live
          </Badge>
        </div>
        <div className="mt-3 inline-flex items-center gap-1 rounded-md border border-border bg-stone-50 p-0.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "h-6 px-2.5 rounded-[5px] text-2xs font-semibold uppercase tracking-[0.12em] transition-colors",
              filter === "all" ? "bg-surface text-foreground shadow-xs" : "text-foreground-subtle"
            )}
          >
            All · {events.length}
          </button>
          <button
            type="button"
            onClick={() => setFilter("violations")}
            className={cn(
              "h-6 px-2.5 rounded-[5px] text-2xs font-semibold uppercase tracking-[0.12em] transition-colors",
              filter === "violations"
                ? "bg-surface text-peach-800 shadow-xs"
                : "text-foreground-subtle hover:text-foreground"
            )}
          >
            Alerts · {violationCount}
          </button>
        </div>
      </header>

      <ol className="flex-1 overflow-y-auto divide-y divide-border/60">
        {visible.length === 0 ? (
          <li className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="h-10 w-10 rounded-full bg-stone-100 border border-border flex items-center justify-center text-foreground-subtle">
              <Radio className="h-4 w-4" />
            </div>
            <p className="mt-3 text-xs font-medium text-foreground">No incidents</p>
            <p className="mt-1 text-2xs text-foreground-subtle max-w-[200px]">
              Detections will populate here as cameras stream events.
            </p>
          </li>
        ) : (
          <AnimatePresence initial={false}>
            {visible.slice(0, 40).map((e) => (
              <motion.li
                key={e.id}
                layout="position"
                initial={{ opacity: 0, x: 12, backgroundColor: "rgba(237,159,126,0.10)" }}
                animate={{ opacity: 1, x: 0, backgroundColor: "rgba(0,0,0,0)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="px-4 sm:px-5 py-2.5 cursor-pointer hover:bg-stone-50/70 transition-colors"
                onClick={() => {
                  selectCamera(e.camera_id);
                  select(e.id);
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "shrink-0 h-8 w-8 rounded-md flex items-center justify-center",
                      e.is_violation
                        ? "bg-peach-100 text-peach-700 ring-1 ring-peach-200"
                        : "bg-sage-100 text-sage-700 ring-1 ring-sage-200"
                    )}
                  >
                    {e.is_violation ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <CameraIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="plate-chip text-[0.6875rem] py-0">{e.plate ?? "—"}</span>
                      {e.is_violation && (
                        <span className="text-2xs font-semibold text-peach-700">
                          {e.violation_type ?? "Violation"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-2xs text-foreground-subtle truncate font-mono">
                      {e.camera_code} · {e.camera_location ?? e.camera_name ?? ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xs font-mono text-foreground-subtle tabular-nums">
                      {timeAgo(e.timestamp)}
                    </p>
                    {e.ocr_confidence !== undefined && (
                      <p className="text-2xs font-mono text-foreground-subtle tabular-nums mt-0.5">
                        OCR {Math.round(e.ocr_confidence * 100)}%
                      </p>
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        )}
      </ol>

      <footer className="px-4 sm:px-5 py-2.5 border-t border-border bg-stone-50/60 rounded-b-xl flex items-center justify-between text-2xs text-foreground-subtle font-mono">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-sage-600" />
          Audit-logged
        </span>
        <span>Click row → evidence</span>
      </footer>
    </aside>
  );
}
