"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileImage, ShieldCheck } from "lucide-react";

import { detectionsApi } from "@/lib/api/endpoints";
import { getApiUrl } from "@/lib/api/client";
import { useCamerasStore } from "@/lib/stores/cameras.store";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Detection } from "@/lib/types";

/**
 * Bottom band of the surveillance theatre — a filmstrip of the most
 * recent evidence captures across the whole network. Clicking a frame
 * opens the forensic evidence drawer (deep-fetched by detection id).
 */
export function EvidenceStrip() {
  const select = useCamerasStore((s) => s.selectDetection);

  const { data, isLoading } = useQuery({
    queryKey: ["detections", "evidence-strip"],
    queryFn: () => detectionsApi.recent(16).then((r) => r.data),
    refetchInterval: 12_000,
    staleTime: 6_000,
  });

  const items: Detection[] = data ?? [];

  return (
    <section className="op-surface shrink-0" aria-label="Evidence capture strip">
      <div className="flex items-stretch">
        <div className="shrink-0 flex flex-col justify-center gap-0.5 px-4 py-3 border-r border-border min-w-[136px]">
          <span className="ops-title">Evidence Strip</span>
          <span className="ops-meta">last {items.length || "—"} captures</span>
        </div>

        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {isLoading ? (
            <div className="flex gap-2 p-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-[120px] shrink-0" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-7 font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
              No captures yet — start a stream
            </p>
          ) : (
            <div className="flex gap-2 p-2.5">
              {items.map((d) => {
                const url = d.frame_path ? `${getApiUrl()}/uploads/${d.frame_path}` : null;
                return (
                  <button
                    key={d.id}
                    onClick={() => select(d.id)}
                    title={`${d.detected_plate ?? "Unread"} · ${format(new Date(d.timestamp), "HH:mm:ss")}`}
                    className={cn(
                      "group relative h-[72px] w-[120px] shrink-0 rounded-lg overflow-hidden",
                      "bg-stone-950 border transition-all duration-150",
                      "hover:-translate-y-0.5 hover:shadow-card-md focus-visible:ring-2 focus-visible:ring-sage-400",
                      d.is_violation
                        ? "border-peach-500/50"
                        : "border-stone-700/40"
                    )}
                  >
                    {url ? (
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <FileImage className="h-5 w-5 text-stone-600 absolute inset-0 m-auto" />
                    )}

                    {/* Violation strip */}
                    {d.is_violation && (
                      <span className="absolute top-0 inset-x-0 h-[2.5px] bg-peach-500" aria-hidden />
                    )}

                    {/* Plate ribbon */}
                    <span className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-stone-950/80 backdrop-blur-[2px] flex items-center justify-between gap-1">
                      <span className={cn(
                        "font-mono text-[0.625rem] font-bold tracking-wider truncate",
                        d.detected_plate ? "text-stone-100" : "text-stone-500 italic"
                      )}>
                        {d.detected_plate ?? "UNREAD"}
                      </span>
                      {d.is_violation
                        ? <AlertTriangle className="h-2.5 w-2.5 text-peach-400 shrink-0" />
                        : <ShieldCheck className="h-2.5 w-2.5 text-sage-400 shrink-0" />}
                    </span>

                    {/* Timestamp on hover */}
                    <span className="absolute top-1 right-1 px-1 py-px rounded bg-stone-950/80 font-mono text-[0.5625rem] text-stone-300 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                      {format(new Date(d.timestamp), "HH:mm:ss")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
