"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Wrench } from "lucide-react";

import { analyticsApi } from "@/lib/api/endpoints";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCompact, timeAgo } from "@/lib/utils";

type Status = "active" | "inactive" | "error" | "maintenance";

interface CameraAnalyticsRow {
  camera_id: string;
  name: string;
  status: Status;
  total_detections: number;
  error_count: number;
  last_seen: string | null;
}

const STATUS_CFG: Record<Status, { label: string; cls: string; bars: number }> = {
  active:      { label: "LIVE",  cls: "text-threat-clear",         bars: 3 },
  maintenance: { label: "MAINT", cls: "text-threat-medium",        bars: 2 },
  error:       { label: "FAULT", cls: "text-threat-high",          bars: 1 },
  inactive:    { label: "OFF",   cls: "text-foreground-subtle/70", bars: 0 },
};

/**
 * Bottom zone of the command center — the camera network as a single
 * horizontal status board: every node visible at once, airport style.
 */
export function CameraNetworkStrip({ className }: { className?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "cameras"],
    queryFn: () => analyticsApi.cameras().then((r) => r.data as CameraAnalyticsRow[]),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const rows = data ?? [];
  const online = rows.filter((r) => r.status === "active").length;

  return (
    <section className={cn("op-surface shrink-0", className)} aria-label="Camera network status">
      <div className="flex items-stretch">
        {/* Zone label */}
        <div className="shrink-0 flex flex-col justify-center gap-0.5 px-4 py-3 border-r border-border min-w-[136px]">
          <span className="ops-title">Camera Network</span>
          <span className="ops-meta">{isLoading ? "—" : `${online}/${rows.length} online`}</span>
        </div>

        {/* Node board */}
        <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {isLoading ? (
            <div className="flex gap-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-44 shrink-0" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
              No cameras provisioned
            </p>
          ) : (
            <div className="flex divide-x divide-border/60">
              {rows.map((row) => {
                const cfg = STATUS_CFG[row.status];
                return (
                  <Link
                    key={row.camera_id}
                    href="/cameras"
                    className={cn(
                      "shrink-0 w-44 px-3.5 py-2.5 hover:bg-muted/40 transition-colors",
                      row.status === "error" && "bg-[hsl(var(--threat-high)/0.05)]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-2xs uppercase tracking-[0.12em] text-foreground-subtle truncate">
                        {row.camera_id}
                      </span>
                      <span className={cn("flex items-center gap-1 font-mono text-2xs font-semibold", cfg.cls)}>
                        <SignalGlyph bars={cfg.bars} />
                        {row.status === "maintenance" ? <Wrench className="h-2.5 w-2.5" /> : cfg.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-foreground truncate">{row.name}</p>
                    <p className="mt-0.5 font-mono text-2xs text-foreground-subtle tabular-nums truncate">
                      {formatCompact(row.total_detections)} reads · {row.last_seen ? timeAgo(row.last_seen) : "—"}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SignalGlyph({ bars }: { bars: number }) {
  return (
    <span className="flex items-end gap-[1.5px] h-2.5" aria-hidden>
      {[1, 2, 3].map((b) => (
        <span
          key={b}
          className={cn(
            "w-[2px] rounded-sm",
            b === 1 ? "h-1" : b === 2 ? "h-[7px]" : "h-2.5",
            b <= bars ? "bg-current" : "bg-current opacity-15"
          )}
        />
      ))}
    </span>
  );
}
