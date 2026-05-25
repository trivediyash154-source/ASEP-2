"use client";

import { Maximize2, MapPin } from "lucide-react";

import { cn, formatCompact, timeAgo } from "@/lib/utils";
import { useCamerasStore } from "@/lib/stores/cameras.store";
import { CameraFeedCanvas } from "./primitives/CameraFeedCanvas";
import { LiveStatusChip } from "./primitives/LiveStatusChip";
import { FeedTelemetry } from "./primitives/FeedTelemetry";
import type { Camera } from "@/lib/types";

type StatusVariant = "live" | "maintenance" | "error" | "offline";

function toVariant(status: Camera["status"]): StatusVariant {
  if (status === "active") return "live";
  if (status === "maintenance") return "maintenance";
  if (status === "error") return "error";
  return "offline";
}

interface Props {
  camera: Camera;
  /** Marks this card as the active hero — adds a sage focus ring */
  active?: boolean;
  /** When true, click anywhere on the surface picks this camera */
  selectable?: boolean;
  density?: "compact" | "comfortable";
  className?: string;
}

/**
 * One camera tile in the cluster grid. Wraps the feed canvas with
 * status chrome, location, live event count, and quick actions.
 */
export function SurveillanceCard({
  camera,
  active = false,
  selectable = true,
  density = "comfortable",
  className,
}: Props) {
  const select = useCamerasStore((s) => s.selectCamera);
  const setFullscreen = useCamerasStore((s) => s.setFullscreen);
  const events = useCamerasStore((s) => s.eventsByCamera[camera.id] ?? []);
  const liveCount = events.length;
  const latest = events[0];
  const variant = toVariant(camera.status);
  const isOnline = camera.status === "active";

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-surface",
        "transition-[box-shadow,border-color,transform] duration-200 ease-out-quart",
        active
          ? "border-sage-500 shadow-[0_0_0_3px_hsl(90_12%_42%/0.18),0_8px_20px_-6px_hsl(45_15%_25%/0.18)]"
          : "border-border hover:border-border-strong hover:shadow-card-md",
        className
      )}
      onClick={selectable ? () => select(camera.id) : undefined}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onKeyDown={
        selectable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                select(camera.id);
              }
            }
          : undefined
      }
    >
      {/* ─── Feed ─────────────────────────────────────────── */}
      <CameraFeedCanvas
        cameraId={camera.id}
        cameraCode={camera.camera_id}
        density={density === "compact" ? "compact" : "comfortable"}
        online={isOnline}
        hud="full"
      />

      {/* ─── Top overlay: status + actions ────────────────── */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none">
        <LiveStatusChip variant={variant} />
        <button
          type="button"
          aria-label="Open camera in fullscreen wall"
          onClick={(ev) => {
            ev.stopPropagation();
            select(camera.id);
            setFullscreen(true);
          }}
          className="pointer-events-auto inline-flex items-center justify-center h-6 w-6 rounded-md bg-stone-900/55 backdrop-blur-[2px] border border-stone-100/10 text-stone-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-stone-900/80"
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      </div>

      {/* ─── Bottom overlay: telemetry ────────────────────── */}
      <div className="absolute left-2 right-2 bottom-2 flex items-end justify-between gap-2 pointer-events-none">
        <FeedTelemetry
          online={isOnline}
          latencyMs={latest?.processing_time_ms}
        />
      </div>

      {/* ─── Chrome footer: identity + counts ─────────────── */}
      <footer className="px-3.5 py-3 border-t border-border bg-stone-50/40">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-foreground tracking-tight truncate">
              {camera.name}
            </p>
            <p className="mt-0.5 text-2xs text-foreground-subtle flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {camera.location}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-sm font-semibold tabular-nums text-foreground">
              {formatCompact(camera.total_detections)}
            </p>
            <p className="text-2xs text-foreground-subtle uppercase tracking-[0.12em] font-medium">
              reads
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-2xs">
          <span className="text-foreground-subtle font-mono">
            {latest ? `${timeAgo(latest.timestamp)} · ${liveCount} live` : "awaiting"}
          </span>
          {camera.error_count > 0 && (
            <span className="text-peach-700 font-mono">{camera.error_count} faults</span>
          )}
        </div>
      </footer>
    </article>
  );
}
