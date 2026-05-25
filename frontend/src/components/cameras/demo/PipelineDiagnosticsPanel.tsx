"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Cpu, Database,
  Eye, Layers, RefreshCw, ShieldAlert, ShieldCheck,
} from "lucide-react";

import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

// ── Shape mirrors demo_pipelines.diagnostics() output ────────────────────────

interface StreamDiag {
  open: boolean;
  source: string | null;
  metrics: {
    fps: number;
    health: string;
    frames_read: number;
    reconnects: number;
    last_frame_at: number;
  } | null;
}

interface PipelineStats {
  frames_processed: number;
  yolo_runs: number;
  vehicles_seen: number;
  ocr_attempts: number;
  ocr_reliable: number;
  detections_persisted: number;
  detections_deduped: number;
  challans_issued: number;
  evidence_saved: number;
  last_yolo_ms: number;
  last_ocr_ms: number;
  last_loop_ms: number;
  last_plate: string | null;
  last_plate_age_s: number | null;
  last_error: string | null;
}

interface ActiveTrack {
  track_id: number;
  frames: number;
  stable_frames: number;
  ocr_done: boolean;
  locked_plate: string | null;
  locked_quality: number;
  age_s: number;
}

interface RecentPlate {
  plate: string;
  age_s: number;
}

interface DiagnosticsData {
  camera_id: string;
  running: boolean;
  stream: StreamDiag;
  models: {
    yolo_loaded: boolean;
    ocr_engines: string[];
  };
  pipeline: PipelineStats | null;
  active_tracks: ActiveTrack[];
  recent_plates: RecentPlate[];
}

interface Props {
  cameraId: string;
  connected: boolean;
}

export function PipelineDiagnosticsPanel({ cameraId, connected }: Props) {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [age, setAge] = useState(0);

  useEffect(() => {
    if (!connected) {
      setData(null);
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const r = await apiClient.get(`/cameras/demo/${cameraId}/diagnostics`);
        if (!cancelled) {
          setData(r.data as DiagnosticsData);
          setError(null);
          setAge(0);
        }
      } catch {
        if (!cancelled) setError("Could not reach diagnostics endpoint");
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    const ageInterval = setInterval(() => setAge((a) => a + 1), 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(ageInterval);
    };
  }, [cameraId, connected]);

  if (!connected) return null;

  return (
    <div className="surface-panel p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-eyebrow">Pipeline diagnostics</p>
          <h3 className="mt-0.5 font-display text-sm font-semibold text-foreground tracking-tight">
            Live AI engine state
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-2xs text-foreground-subtle font-mono">
          <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: "3s" }} />
          auto · {age}s ago
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-2xs text-peach-700 bg-peach-50 border border-peach-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* Model status */}
          <section>
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle mb-2">
              AI models
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ModelChip
                label="YOLOv8 detector"
                loaded={data.models.yolo_loaded}
              />
              <ModelChip
                label={data.models.ocr_engines.length ? data.models.ocr_engines.join(" + ") : "No OCR engine"}
                loaded={data.models.ocr_engines.length > 0}
              />
            </div>
          </section>

          {/* Pipeline counters */}
          {data.pipeline && (
            <section>
              <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle mb-2">
                Cumulative counters
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs font-mono">
                <Counter icon={<Cpu />} label="Frames" value={data.pipeline.frames_processed} />
                <Counter icon={<Eye />} label="OCR attempts" value={data.pipeline.ocr_attempts} />
                <Counter icon={<CheckCircle2 />} label="Reliable reads" value={data.pipeline.ocr_reliable} />
                <Counter icon={<Database />} label="Persisted" value={data.pipeline.detections_persisted} />
                <Counter icon={<Layers />} label="Vehicles seen" value={data.pipeline.vehicles_seen} />
                <Counter icon={<RefreshCw />} label="Deduped" value={data.pipeline.detections_deduped} />
                <Counter icon={<ShieldAlert />} label="Challans" value={data.pipeline.challans_issued} />
                <Counter icon={<Database />} label="Evidence" value={data.pipeline.evidence_saved} />
              </div>
              {data.pipeline.last_error && (
                <p className="mt-2 text-2xs text-peach-700 font-mono bg-peach-50 border border-peach-200 rounded px-2 py-1 break-all">
                  Last error: {data.pipeline.last_error}
                </p>
              )}
              {data.pipeline.last_plate && (
                <p className="mt-2 text-2xs text-sage-700 font-mono bg-sage-50 border border-sage-200 rounded px-2 py-1">
                  Last plate: <span className="font-bold">{data.pipeline.last_plate}</span>
                  {data.pipeline.last_plate_age_s !== null && (
                    <span className="text-sage-500 ml-2">{data.pipeline.last_plate_age_s}s ago</span>
                  )}
                </p>
              )}
            </section>
          )}

          {/* Active tracks */}
          {data.active_tracks.length > 0 && (
            <section>
              <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle mb-2">
                Active tracks ({data.active_tracks.length})
              </p>
              <div className="space-y-1">
                {data.active_tracks.map((t) => (
                  <div
                    key={t.track_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-2xs font-mono"
                  >
                    <span className="text-stone-500 w-6 shrink-0">#{t.track_id}</span>
                    <div className="flex-1 min-w-0">
                      {t.locked_plate ? (
                        <span className="font-bold text-sage-700">{t.locked_plate}</span>
                      ) : (
                        <span className="text-stone-400 italic">OCR pending…</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-stone-400">
                      {t.ocr_done
                        ? <ShieldCheck className="h-3 w-3 text-sage-500" />
                        : <Clock className="h-3 w-3" />
                      }
                      <span>{t.stable_frames}/{t.frames} stable</span>
                      <span>{t.age_s}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent plates */}
          {data.recent_plates.length > 0 && (
            <section>
              <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle mb-2">
                Recent plates (dedupe cache)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.recent_plates.slice(-12).reverse().map((p) => (
                  <span
                    key={`${p.plate}-${p.age_s}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-stone-200 bg-stone-50 text-2xs font-mono text-stone-700"
                  >
                    {p.plate}
                    <span className="text-stone-400">{p.age_s}s</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ModelChip({ label, loaded }: { label: string; loaded: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border px-3 py-2",
      loaded ? "border-sage-200 bg-sage-50" : "border-peach-200 bg-peach-50"
    )}>
      {loaded
        ? <CheckCircle2 className="h-3.5 w-3.5 text-sage-700 shrink-0" />
        : <AlertTriangle className="h-3.5 w-3.5 text-peach-700 shrink-0" />
      }
      <span className={cn("text-2xs font-semibold truncate", loaded ? "text-sage-900" : "text-peach-900")}>
        {label}
      </span>
    </div>
  );
}

function Counter({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-stone-200 bg-stone-50">
      <span className="[&_svg]:h-3 [&_svg]:w-3 text-stone-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-stone-400 uppercase tracking-[0.10em]" style={{ fontSize: "0.6rem" }}>{label}</p>
        <p className="font-display text-sm font-semibold tabular-nums text-stone-800">{value.toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
}
