"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Compass,
  Crosshair,
  Expand,
  MapPin,
  ShieldCheck,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState } from "react";

import { camerasApi } from "@/lib/api/endpoints";
import { unlockAudio } from "@/lib/audio/alertChime";
import { useDetectionFx } from "@/lib/hooks/useDetectionFx";
import { useCamerasStore, type LiveDetectionEvent } from "@/lib/stores/cameras.store";
import { cn, formatCompact, formatNumber, timeAgo } from "@/lib/utils";

import { CameraFeedCanvas } from "./primitives/CameraFeedCanvas";
import { DetectionPulse } from "./primitives/DetectionPulse";
import { LiveClock } from "./primitives/LiveClock";
import { LiveStatusChip } from "./primitives/LiveStatusChip";
import { FeedTelemetry } from "./primitives/FeedTelemetry";
import { AIConfidenceBadge } from "./primitives/AIConfidenceBadge";
import { InFeedDossier } from "./InFeedDossier";
import { ChallanCeremony } from "./ChallanCeremony";

import type { Camera } from "@/lib/types";

interface Props {
  camera: Camera;
}

/**
 * The large primary feed at the top of the surveillance wall.
 * Wraps CameraFeedCanvas with full operational chrome, live AI summary,
 * and a side mini-stream of this camera's most recent detections.
 */
export function HeroFeed({ camera }: Props) {
  const select = useCamerasStore((s) => s.selectDetection);
  const setFullscreen = useCamerasStore((s) => s.setFullscreen);
  const events = useCamerasStore((s) => s.eventsByCamera[camera.id] ?? []);
  const [audio, setAudio] = useState(false);

  const isOnline = camera.status === "active";
  const latest = events[0];

  // Detection ceremony — fires on every new event for the focused camera.
  // Suppressed when audio is muted, but flash + pulse + dossier still fire.
  const { flashKey, pulseKey, lastEvent } = useDetectionFx(camera.id, { audio });

  const toggleAudio = async () => {
    if (!audio) await unlockAudio();
    setAudio((v) => !v);
  };

  // Backfill — when a camera is first focused, hydrate with its recent
  // history from the API so the side rail isn't empty.
  const { data: recent } = useQuery({
    queryKey: ["detections", "recent-for-camera", camera.id],
    queryFn: () =>
      camerasApi
        .get(camera.id)
        .then(() => fetch(`/api/v1/detections/recent?limit=8&camera_id=${camera.id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` },
        }))
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    staleTime: 15_000,
    refetchOnMount: "always",
  });

  // Merge live events with the backfill, dedup by id, newest first
  const sideStream = useDedupedStream(events, (recent ?? []) as LiveDetectionEventFromApi[]);

  return (
    <section className="surface-panel overflow-hidden">
      {/* ── Title bar ────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-2xs uppercase tracking-[0.18em] text-foreground-subtle">
            {camera.camera_id}
          </span>
          <span className="h-3 w-px bg-border" />
          <h2 className="font-display text-base font-semibold text-foreground tracking-tight truncate">
            {camera.name}
          </h2>
          <span className="hidden md:inline-flex items-center gap-1 text-2xs text-foreground-subtle ml-1">
            <MapPin className="h-3 w-3" />
            {camera.location}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-stone-50 dark:bg-stone-900/60 border border-border font-mono text-2xs text-foreground-muted">
            <Compass className="h-3 w-3" />
            {camera.latitude?.toFixed(4)}°N · {camera.longitude?.toFixed(4)}°E
          </span>
          <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-stone-50 dark:bg-stone-900/60 border border-border font-mono text-2xs text-foreground-muted">
            <LiveClock />
          </span>
          <button
            type="button"
            onClick={toggleAudio}
            aria-label={audio ? "Mute alert tones" : "Enable alert tones"}
            title={audio ? "Mute alert tones" : "Enable alert tones"}
            className={cn(
              "inline-flex items-center justify-center h-7 w-7 rounded-md border bg-surface hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors",
              audio
                ? "border-sage-400 text-sage-700 ring-1 ring-sage-200"
                : "border-border text-foreground-muted"
            )}
          >
            {audio ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            aria-label="Enter tactical wall"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-sage-500 bg-sage-600 text-white text-2xs font-semibold uppercase tracking-[0.12em] hover:bg-sage-700"
          >
            <Expand className="h-3 w-3" />
            Tactical
          </button>
        </div>
      </header>

      {/* ── Feed + side stream ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,320px)]">
        {/* Hero feed canvas */}
        <div className="relative bg-stone-950">
          <CameraFeedCanvas
            cameraId={camera.id}
            cameraCode={camera.camera_id}
            density="hero"
            online={isOnline}
            onDetectionClick={(e) => select(e.id)}
            aspectRatio="16 / 9"
            flashKey={flashKey}
          >
            {/* Detection ceremony — radial pulse + auto-popup intelligence
                dossier + challan ceremony, all clipped to the feed's bounds */}
            <DetectionPulse event={lastEvent} triggerKey={pulseKey} />
            <InFeedDossier event={lastEvent} triggerKey={pulseKey} />
            <ChallanCeremony event={lastEvent} triggerKey={pulseKey} />
          </CameraFeedCanvas>

          {/* HUD overlays */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
            <LiveStatusChip variant={isOnline ? "live" : camera.status === "error" ? "error" : "offline"} />
            <FeedTelemetry online={isOnline} latencyMs={latest?.processing_time_ms} />
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 pointer-events-none">
            <div className="flex items-center gap-1.5 px-2 h-7 rounded-md bg-stone-900/65 backdrop-blur-[2px] border border-stone-100/10">
              <Crosshair className="h-3 w-3 text-sage-300" />
              <span className="font-mono text-2xs tracking-[0.12em] uppercase text-stone-200">
                AI ANPR · YOLOv8n · EasyOCR
              </span>
            </div>
            <StreamQualityHUD camera={camera} online={isOnline} lastDetectionTs={latest?.timestamp} />
          </div>
        </div>

        {/* Side stream */}
        <aside className="border-t lg:border-t-0 lg:border-l border-border bg-stone-50/30 dark:bg-stone-900/20 flex flex-col">
          <header className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="section-eyebrow">This camera</p>
            <span className="font-mono text-2xs text-foreground-subtle tabular-nums">
              {formatNumber(sideStream.length)} · last 50
            </span>
          </header>
          <ul className="flex-1 overflow-y-auto divide-y divide-border/60 max-h-[360px] lg:max-h-none">
            {sideStream.length === 0 ? (
              <li className="px-4 py-8 text-center text-xs text-foreground-subtle">
                Awaiting detections…
              </li>
            ) : (
              sideStream.slice(0, 18).map((e) => (
                <li
                  key={e.id}
                  className="px-4 py-2.5 hover:bg-surface cursor-pointer transition-colors"
                  onClick={() => select(e.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="plate-chip text-[0.6875rem]">{e.plate ?? "—"}</span>
                    {e.is_violation ? (
                      <span className="inline-flex items-center gap-1 text-2xs text-peach-700 font-semibold">
                        <AlertTriangle className="h-3 w-3" />
                        {e.violation_type ?? "Violation"}
                      </span>
                    ) : (
                      <ShieldCheck className="h-3 w-3 text-sage-600" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <AIConfidenceBadge
                      value={e.ocr_confidence}
                      label="OCR"
                      surface="light"
                      size="xs"
                    />
                    <span className="font-mono text-2xs text-foreground-subtle tabular-nums">
                      {timeAgo(e.timestamp)}
                    </span>
                  </div>
                </li>
              ))
            )}
          </ul>
          <footer className="px-4 py-2.5 border-t border-border flex items-center justify-between text-2xs text-foreground-subtle font-mono">
            <span>{formatCompact(camera.total_detections)} all-time</span>
            <span>{camera.error_count} faults</span>
          </footer>
        </aside>
      </div>
    </section>
  );
}

/**
 * Stream-quality readout pinned to the feed's bottom-right: signal
 * strength, capture format, and time since the last AI detection.
 */
function StreamQualityHUD({ camera, online, lastDetectionTs }: {
  camera: Camera;
  online: boolean;
  lastDetectionTs?: string;
}) {
  const bars = !online ? 0 : camera.error_count > 5 ? 1 : camera.error_count > 0 ? 2 : 3;
  const res = camera.resolution_height ? `${camera.resolution_height}p` : null;
  const fps = camera.fps ? `${camera.fps}fps` : null;

  return (
    <div className="flex items-center gap-2.5 px-2.5 h-7 rounded-md bg-stone-900/65 backdrop-blur-[2px] border border-stone-100/10 font-mono text-2xs uppercase tracking-[0.1em]">
      <span className="flex items-center gap-1.5">
        <span className={cn("flex items-end gap-[2px] h-3", online ? "text-sage-300" : "text-stone-500")} aria-hidden>
          {[1, 2, 3].map((b) => (
            <span
              key={b}
              className={cn(
                "w-[2.5px] rounded-sm",
                b === 1 ? "h-1" : b === 2 ? "h-2" : "h-3",
                b <= bars ? "bg-current" : "bg-current opacity-20"
              )}
            />
          ))}
        </span>
        <span className={online ? "text-stone-200" : "text-stone-500"}>
          {online ? "SIG OK" : "NO SIG"}
        </span>
      </span>
      {(res || fps) && (
        <>
          <span className="h-3 w-px bg-stone-100/15" />
          <span className="text-stone-300">{[res, fps].filter(Boolean).join(" · ")}</span>
        </>
      )}
      <span className="h-3 w-px bg-stone-100/15" />
      <span className="text-stone-300">
        DET {lastDetectionTs ? timeAgo(lastDetectionTs) : "—"}
      </span>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────

interface LiveDetectionEventFromApi {
  id: string;
  detected_plate?: string;
  ocr_confidence?: number;
  vehicle_confidence?: number;
  is_violation?: boolean;
  violation_type?: string | null;
  timestamp: string;
  processing_time_ms?: number;
}

function useDedupedStream(
  live: LiveDetectionEvent[],
  backfill: LiveDetectionEventFromApi[]
): Array<LiveDetectionEvent | NormalizedBackfill> {
  // Normalize backfill rows to the same key shape used by the live stream.
  const normalized: NormalizedBackfill[] = backfill.map((r) => ({
    id: r.id,
    type: "detection",
    camera_id: "",
    plate: r.detected_plate,
    ocr_confidence: r.ocr_confidence,
    vehicle_confidence: r.vehicle_confidence,
    is_violation: r.is_violation ?? false,
    violation_type: r.violation_type ?? undefined,
    timestamp: r.timestamp,
    processing_time_ms: r.processing_time_ms,
    receivedAt: 0,
  }));

  const seen = new Set<string>();
  const out: Array<LiveDetectionEvent | NormalizedBackfill> = [];
  for (const e of [...live, ...normalized]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  out.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return out;
}

type NormalizedBackfill = Pick<
  LiveDetectionEvent,
  "id" | "type" | "camera_id" | "plate" | "ocr_confidence" | "vehicle_confidence" | "is_violation" | "violation_type" | "timestamp" | "processing_time_ms" | "receivedAt"
>;
