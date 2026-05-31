"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, PlugZap, PowerOff, Radio, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getAccessToken, getApiUrl, getWsUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { playChime, unlockAudio } from "@/lib/audio/alertChime";
import { useEvidenceFlash } from "@/lib/hooks/useEvidenceFlash";
import { log } from "@/lib/diagnostics/logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  LiveStreamCanvas,
  type StreamFramePayload,
} from "./LiveStreamCanvas";
import { TelemetryHUD, type Telemetry } from "./TelemetryHUD";
import { EnforcementStack, type EnforcementCard } from "./EnforcementStack";
import { MobileCameraConnect } from "./MobileCameraConnect";
import { PipelineDiagnosticsPanel } from "./PipelineDiagnosticsPanel";
import { PipelineRail } from "./PipelineRail";

const DEMO_CAMERA_ID = "demo-primary";
const MAX_OCR_ACTIVITY = 30;

interface OcrAttempt {
  id: string;
  text: string | null;
  confidence: number;
  quality_score: number;
  engine: string | null;
  reliable: boolean;
  timestamp: string;
}

/**
 * Orchestrates the live demo experience:
 *
 *   1. Opens a WS to /api/v1/cameras/demo/{id}/stream for structured events
 *   2. Renders MJPEG from /api/v1/cameras/demo/{id}/mjpeg via <img>
 *   3. Overlays bbox + plate labels on a synced canvas
 *   4. Handles ocr_attempt events — live activity feed of every OCR attempt
 *   5. Flashes + dings on every confirmed plate read
 *   6. Pushes enforcement cards into the right-side queue
 *   7. Shows diagnostics panel polling /diagnostics endpoint
 */
export function DemoSurveillanceConsole() {
  const API_URL = getApiUrl();
  const WS_URL = getWsUrl();
  const [connected, setConnected] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [payload, setPayload] = useState<StreamFramePayload | null>(null);
  const [cards, setCards] = useState<EnforcementCard[]>([]);
  const [ocrActivity, setOcrActivity] = useState<OcrAttempt[]>([]);
  const [wsState, setWsState] = useState<"idle" | "connecting" | "live" | "offline" | "reconnecting">("idle");
  const lastReadId = useRef<string | null>(null);

  const { active: flashing, pulseKey, trigger: triggerFlash } = useEvidenceFlash(360);

  // ── Build the MJPEG URL with the access token ─────────────────
  const mjpegUrl = useMemo(() => {
    if (!connected) return null;
    const t = getAccessToken();
    return `${API_URL}/api/v1/cameras/demo/${DEMO_CAMERA_ID}/mjpeg${t ? `?token=${encodeURIComponent(t)}` : ""}`;
  }, [connected, API_URL]);

  // ── Connect WS once, reconnect with bounded backoff ───────────
  // Hardening: exponential backoff with jitter, max 10 attempts, abandons
  // after auth-rejected (4001/4003) so a stale token doesn't burn the CPU.
  const [wsAttempts, setWsAttempts] = useState(0);
  const wsRetryRef = useRef<{ retry: () => void }>({ retry: () => {} });
  const MAX_WS_ATTEMPTS = 10;
  const WS_BASE_DELAY = 1500;
  const WS_MAX_DELAY = 12_000;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function scheduleRetry() {
      attempt += 1;
      setWsAttempts(attempt);
      if (attempt > MAX_WS_ATTEMPTS) {
        log.error("stream", "demo_ws_max_attempts", { attempt });
        setWsState("offline");
        return;
      }
      const base = Math.min(WS_MAX_DELAY, Math.floor(WS_BASE_DELAY * Math.pow(1.5, attempt - 1)));
      const delay = Math.floor(base * (0.5 + Math.random() * 0.5));
      log.info("stream", "demo_ws_retry_scheduled", { attempt, delay });
      retryTimer = setTimeout(open, delay);
    }

    function open() {
      if (cancelled) return;
      const t = getAccessToken();
      const url = `${WS_URL}/api/v1/cameras/demo/${DEMO_CAMERA_ID}/stream${t ? `?token=${encodeURIComponent(t)}` : ""}`;
      setWsState((s) => (s === "live" ? "reconnecting" : "connecting"));
      log.info("stream", "demo_ws_connect", { attempt: attempt + 1 });

      try {
        ws = new WebSocket(url);
      } catch (err) {
        log.error("stream", "demo_ws_construct_failed", { error: (err as Error)?.message });
        scheduleRetry();
        return;
      }

      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setWsAttempts(0);
        // Don't read `connected` from closure — the WS open just means the socket is up;
        // whether the stream is live depends on the first stream_frame message.
        setWsState((prev) => prev === "live" ? "live" : "connecting");
        log.info("stream", "demo_ws_open");
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(ev.data as string) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = data.type as string;

        if (type === "stream_state") {
          const running = !!(data as { running?: boolean }).running;
          const streamDead = !!(data as { stream_dead?: boolean }).stream_dead;
          const fatal = (data as { fatal_error?: string }).fatal_error;
          setConnected(running);
          setPayload(data as unknown as StreamFramePayload);
          if (fatal) {
            log.error("stream", "demo_fatal_error_from_server", { fatal });
            setWsState("offline");
            toast.error("Stream pipeline failed", { description: fatal });
          } else if (streamDead) {
            log.warn("stream", "demo_stream_dead_signal");
            setWsState("reconnecting");
          } else if (running) {
            setWsState("live");
          }
          return;
        }

        if (type === "heartbeat" || type === "subscribed") {
          setPayload(data as unknown as StreamFramePayload);
          return;
        }

        // ── ocr_attempt: broadcast on every OCR pass regardless of reliability ──
        if (type === "ocr_attempt") {
          const attempt: OcrAttempt = {
            id: `${Date.now()}-${Math.random()}`,
            text: (data.text as string | null) ?? null,
            confidence: (data.confidence as number) ?? 0,
            quality_score: (data.quality_score as number) ?? 0,
            engine: (data.engine as string | null) ?? null,
            reliable: !!(data.reliable),
            timestamp: (data.timestamp as string) ?? new Date().toISOString(),
          };
          setOcrActivity((prev) => [attempt, ...prev].slice(0, MAX_OCR_ACTIVITY));
          return;
        }

        // ── evidence_saved: attach image paths to the matching enforcement card ──
        if (type === "evidence_saved") {
          const detectionId = data.detection_id as string | null;
          const framePath = data.frame_path as string | null;
          const plateCropPath = data.plate_crop_path as string | null;
          if (detectionId) {
            setCards((prev) =>
              prev.map((card) =>
                card.id === detectionId
                  ? { ...card, framePath: framePath ?? card.framePath, plateCropPath: plateCropPath ?? card.plateCropPath }
                  : card
              )
            );
          }
          return;
        }

        if (type === "stream_frame") {
          const frame = data as unknown as StreamFramePayload;
          setConnected(true);
          setWsState("live");
          setPayload(frame);

          const read = frame.plate_read;
          if (read?.id && read.id !== lastReadId.current) {
            lastReadId.current = read.id;
            const risk = read.compliance?.risk_score ?? 0;
            const isViolation = risk >= 30;

            if (read.plate_text) {
              triggerFlash();
              if (isViolation) {
                void playChime(risk >= 80 ? "alert" : "violation");
              } else {
                void playChime("scan");
              }
            }
            if (read.plate_text && read.compliance) {
              setCards((prev) => [
                {
                  id: read.id ?? `${Date.now()}-${Math.random()}`,
                  receivedAt: Date.now(),
                  plate: read.plate_text!,
                  ocrConfidence: read.ocr_confidence ?? undefined,
                  compliance: read.compliance!,
                  framePath: null,
                  plateCropPath: null,
                },
                ...prev,
              ].slice(0, 30));
            }
          }
        }
      };

      ws.onclose = (ev) => {
        if (cancelled) return;
        log.info("stream", "demo_ws_close", {
          code: ev.code, reason: ev.reason, wasClean: ev.wasClean,
        });
        // Auth-rejected — stop retrying, the operator must re-login.
        if (ev.code === 4001 || ev.code === 4003) {
          setWsState("offline");
          return;
        }
        setWsState((s) => (s === "live" ? "reconnecting" : "offline"));
        scheduleRetry();
      };
      ws.onerror = () => {
        if (!cancelled) {
          log.warn("stream", "demo_ws_error");
          setWsState("reconnecting");
        }
      };
    }

    wsRetryRef.current.retry = () => {
      attempt = 0;
      setWsAttempts(0);
      log.info("stream", "demo_ws_manual_retry");
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      try { ws?.close(); } catch { /* */ }
      open();
    };

    open();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        if (ws) {
          ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
          ws.close(1000, "unmount");
        }
      } catch { /* */ }
    };
  // Intentionally only runs once — the effect is self-contained with retries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initial status sync ────────────────────────────────────────
  // Short timeout — this is best-effort. If the backend is unreachable
  // we fall back to "no source" and let the user act, rather than
  // gating the page on a slow round-trip.
  useEffect(() => {
    apiClient
      .get(`/cameras/demo/${DEMO_CAMERA_ID}/status`, { timeout: 4000 })
      .then((r) => {
        const d = r.data as { running: boolean };
        if (d.running) {
          setConnected(true);
          setWsState("live");
          log.info("camera", "demo_status_sync_running");
        }
      })
      .catch((err) => {
        log.warn("camera", "demo_status_sync_failed", { error: (err as Error)?.message });
      });
  }, []);

  // ── Audio unlock on first user gesture ─────────────────────────
  useEffect(() => {
    const handler = () => {
      void unlockAudio();
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("click", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  async function disconnect() {
    // Reset client-side state FIRST so the UI is always recoverable, even
    // if the backend is unreachable. The disconnect POST is best-effort —
    // a backend that's already in the wedged state we're trying to recover
    // from might never respond.
    setConnected(false);
    setPayload(null);
    lastReadId.current = null;
    setOcrActivity([]);
    log.info("camera", "demo_disconnect_initiated");
    try {
      await apiClient.post(`/cameras/demo/${DEMO_CAMERA_ID}/disconnect`, null, { timeout: 5000 });
      log.info("camera", "demo_disconnect_acked");
      toast.success("Stream disconnected");
    } catch (err) {
      log.warn("camera", "demo_disconnect_backend_failed", {
        error: (err as Error)?.message,
      });
      // Don't bother the operator — UI is already in the desired state.
      toast.message("Stream disconnected locally", {
        description: "Backend did not acknowledge — it may be restarting.",
      });
    }
  }

  const canvasState =
    !connected ? (wsState === "connecting" ? "connecting" : "idle")
    : wsState === "live" ? "live"
    : wsState === "reconnecting" ? "reconnecting"
    : "offline";

  const telemetry = payload?.telemetry as Telemetry | undefined;

  return (
    <div className="page-shell page-enter space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="surface-panel p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="section-eyebrow flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            Live demo theatre
          </p>
          <h1 className="mt-2 font-display text-2xl sm:text-3xl font-semibold tracking-tightest leading-[1.05]">
            Connect your phone. Watch the AI work.
          </h1>
          <p className="mt-2 text-sm text-foreground-muted max-w-2xl">
            Point a phone at any license plate. Frames stream over Wi-Fi into the
            ANPR pipeline; YOLO + EasyOCR resolve the plate, four registry
            checks run concurrently, and a risk-graded enforcement card slides
            into the queue — all under 250ms end-to-end.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={connected ? "sage" : "neutral"} withDot pulse={connected} size="md">
            <Radio className="h-3 w-3 mr-0.5" />
            {connected ? "Source live" : "No source"}
          </Badge>
          {connected ? (
            <Button variant="outline" size="md" onClick={disconnect} leadingIcon={<PowerOff className="h-3.5 w-3.5" />}>
              Disconnect
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={() => setConnectOpen(true)} leadingIcon={<PlugZap className="h-3.5 w-3.5" />}>
              Connect mobile camera
            </Button>
          )}
        </div>
      </header>

      {/* ── Live pipeline rail: DECODE → DETECT → OCR → COMPLIANCE → CHALLAN ── */}
      <PipelineRail state={canvasState} payload={payload} ocrAttemptKey={ocrActivity.length} />

      {/* ── Main grid: video + enforcement stack ───────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(340px,400px)] gap-6 items-start">
        <div className="space-y-5 min-w-0">
          <LiveStreamCanvas
            mjpegUrl={mjpegUrl}
            payload={payload}
            flashKey={pulseKey}
            state={canvasState}
            ocrAttemptKey={ocrActivity.length}
            reconnectAttempt={wsAttempts}
            onManualReconnect={() => wsRetryRef.current.retry()}
            onAbandon={disconnect}
          />
          <TelemetryHUD
            telemetry={telemetry ?? null}
            status={(payload?.status as string) ?? "OFFLINE"}
          />
          {/* OCR activity feed — shows every attempt the AI makes */}
          {ocrActivity.length > 0 && (
            <OcrActivityFeed items={ocrActivity} />
          )}
        </div>

        <div className="space-y-5">
          <EnforcementStack cards={cards} />
          <PipelineDiagnosticsPanel cameraId={DEMO_CAMERA_ID} connected={connected} />
        </div>
      </div>

      <MobileCameraConnect
        open={connectOpen}
        cameraId={DEMO_CAMERA_ID}
        onClose={() => setConnectOpen(false)}
        onConnected={() => {
          setConnected(true);
          setWsState("connecting");
        }}
      />
    </div>
  );
}

// ── OCR Activity Feed ─────────────────────────────────────────────────────────

function OcrActivityFeed({ items }: { items: OcrAttempt[] }) {
  return (
    <div className="surface-panel p-4 sm:p-5">
      <p className="section-eyebrow mb-3">OCR activity feed</p>
      <p className="text-xs text-foreground-muted mb-3">
        Every plate recognition attempt, including unreliable reads — proof the AI is working.
      </p>
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {items.map((a) => (
          <div
            key={a.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg border text-2xs font-mono",
              a.reliable
                ? "border-sage-200 bg-sage-50"
                : "border-stone-200 bg-stone-50"
            )}
          >
            {/* Result chip */}
            <span className={cn(
              "shrink-0 font-bold tracking-[0.06em]",
              a.reliable ? "text-sage-700" : "text-stone-400 italic"
            )}>
              {a.text ?? "—"}
            </span>

            {/* Confidence bar */}
            <div className="flex-1 h-1 rounded-full bg-stone-200 overflow-hidden">
              <div
                className={cn("h-full rounded-full", a.reliable ? "bg-sage-400" : "bg-stone-300")}
                style={{ width: `${Math.round((a.quality_score ?? 0) * 100)}%` }}
              />
            </div>

            {/* Stats */}
            <span className="shrink-0 text-stone-400">
              {Math.round((a.confidence ?? 0) * 100)}%
            </span>
            <span className="shrink-0 text-stone-400 hidden sm:inline">
              {a.engine ?? "—"}
            </span>
            <span className={cn("shrink-0 font-semibold", a.reliable ? "text-sage-600" : "text-stone-400")}>
              {a.reliable ? "✓ LOCK" : "skip"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
