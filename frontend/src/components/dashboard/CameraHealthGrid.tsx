"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Camera as CameraIcon, MapPin, Wrench } from "lucide-react";

import { analyticsApi } from "@/lib/api/endpoints";
import { cn, formatCompact, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Status = "active" | "inactive" | "error" | "maintenance";

interface CameraAnalyticsRow {
  camera_id: string;
  name: string;
  status: Status;
  total_detections: number;
  error_count: number;
  last_seen: string | null;
}

const statusToBadge: Record<Status, { variant: "sage" | "bronze" | "peach" | "neutral"; label: string }> = {
  active:      { variant: "sage",    label: "Streaming" },
  maintenance: { variant: "bronze",  label: "Maintenance" },
  error:       { variant: "peach",   label: "Stream error" },
  inactive:    { variant: "neutral", label: "Offline" },
};

export function CameraHealthGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "cameras"],
    queryFn: () => analyticsApi.cameras().then((r) => r.data as CameraAnalyticsRow[]),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const rows = data ?? [];

  return (
    <section className="surface-panel">
      <header className="flex items-end justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-border">
        <div>
          <p className="section-eyebrow">Network health</p>
          <h3 className="font-display text-base font-semibold text-foreground tracking-tight mt-0.5">
            Camera fleet
          </h3>
        </div>
        <a
          href="/cameras"
          className="inline-flex items-center gap-1 text-xs font-medium text-sage-700 hover:text-sage-900 transition-colors"
        >
          Surveillance wall <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </header>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-foreground-subtle py-8 text-center">No cameras provisioned yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((row) => {
              const badge = statusToBadge[row.status];
              return (
                <div
                  key={row.camera_id}
                  className={cn(
                    "group relative rounded-xl border bg-surface p-3.5",
                    "transition-[box-shadow,border-color] duration-200 hover:shadow-card-md hover:border-border-strong",
                    row.status === "error" ? "border-peach-200" : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-2xs uppercase tracking-[0.16em] text-foreground-subtle">
                        {row.camera_id}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground tracking-tight truncate">
                        {row.name}
                      </p>
                    </div>
                    <Badge variant={badge.variant} withDot pulse={row.status === "active"} size="sm">
                      {badge.label}
                    </Badge>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <dt className="text-[0.625rem] uppercase tracking-wider text-foreground-subtle font-semibold">
                        Reads
                      </dt>
                      <dd className="mt-0.5 font-display text-sm font-semibold text-foreground tabular-nums">
                        {formatCompact(row.total_detections)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.625rem] uppercase tracking-wider text-foreground-subtle font-semibold">
                        Errors
                      </dt>
                      <dd
                        className={cn(
                          "mt-0.5 font-display text-sm font-semibold tabular-nums",
                          row.error_count > 0 ? "text-peach-700" : "text-foreground"
                        )}
                      >
                        {row.error_count}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.625rem] uppercase tracking-wider text-foreground-subtle font-semibold">
                        Last seen
                      </dt>
                      <dd className="mt-0.5 text-2xs font-mono text-foreground tabular-nums truncate">
                        {row.last_seen ? timeAgo(row.last_seen) : "—"}
                      </dd>
                    </div>
                  </dl>

                  {row.status === "maintenance" && (
                    <div className="absolute right-3 bottom-3 text-bronze-600">
                      <Wrench className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
