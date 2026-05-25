"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";

export interface StreamDetection {
  bbox: [number, number, number, number]; // x1, y1, x2, y2 in frame coords
  confidence: number;
  class_name: string;
  plate_bbox?: [number, number, number, number] | null;
  plate_confidence?: number | null;
}

export interface StreamPlateRead {
  id?: string | null;
  plate_text: string | null;
  ocr_confidence?: number | null;
  plate_confidence?: number | null;
  compliance?: {
    risk_score?: number;
    risk_band?: string;
    enforcement_action?: string;
    vehicle?: { make?: string | null; model?: string | null };
  } | null;
}

export interface StreamFramePayload {
  type: "stream_frame" | "heartbeat" | "subscribed" | "stream_state";
  camera_id: string;
  status?: string;
  frame_dimensions?: { width: number; height: number };
  telemetry?: Record<string, unknown>;
  detections?: StreamDetection[];
  plate_read?: StreamPlateRead | null;
  timestamp?: string;
}

interface Props {
  mjpegUrl: string | null;
  payload: StreamFramePayload | null;
  flashKey: number;
  state: "idle" | "connecting" | "live" | "offline" | "reconnecting";
  className?: string;
  /** Bump on every ocr_attempt WS event to trigger OCR-active overlay */
  ocrAttemptKey?: number;
  /** Reconnect attempt counter — shown in the recovery overlay. */
  reconnectAttempt?: number;
  /** Operator-initiated full reset (close WS + reopen) */
  onManualReconnect?: () => void;
  /** Operator-initiated source disconnect — graceful shutdown of the pipeline. */
  onAbandon?: () => void;
}

/**
 * The visual centerpiece for /demo:
 *   • `<img>` streams MJPEG from the camera endpoint
 *   • `<canvas>` overlays vehicle + plate bounding boxes from WS payload
 *   • `EnhancedFlash` — colored tint (sage/bronze/peach) + scan-line sweep on evidence capture
 *   • `AiStageChip` — live "ANALYZING / OCR EXTRACTING / PLATE LOCKED" indicator
 *   • `PlateReadHUD` — typewriter plate text + animated OCR confidence bar
 */
export function LiveStreamCanvas({
  mjpegUrl,
  payload,
  flashKey,
  state,
  className,
  ocrAttemptKey = 0,
  reconnectAttempt = 0,
  onManualReconnect,
  onAbandon,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgError, setImgError] = useState(false);
  // MJPEG auto-reload: when the upstream stream drops, the <img> errors out
  // and stays broken. We force a reload by bumping a cache-buster query.
  // Capped retries so we don't hammer a permanently-dead endpoint.
  const [reloadKey, setReloadKey] = useState(0);
  const reloadAttemptsRef = useRef(0);
  const MAX_IMG_RELOADS = 5;

  const isFrame = payload?.type === "stream_frame";
  const plateText = isFrame ? (payload.plate_read?.plate_text ?? null) : null;
  const risk = payload?.plate_read?.compliance?.risk_score ?? 0;
  const ocrConf = payload?.plate_read?.ocr_confidence ?? null;
  const hasDetections = isFrame && (payload.detections?.length ?? 0) > 0;

  // ── Keep canvas pixel buffer sized to rendered viewport ──────────
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const cv = canvasRef.current;
      const wrap = containerRef.current;
      if (!cv || !wrap) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      const ctx = cv.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setImgError(false);
    reloadAttemptsRef.current = 0;
    setReloadKey(0);
  }, [mjpegUrl]);

  // When the stream re-enters "live" after a "reconnecting" gap, recycle the
  // <img> so the browser picks up the new MJPEG endpoint cleanly.
  useEffect(() => {
    if (state === "live" && imgError && reloadAttemptsRef.current < MAX_IMG_RELOADS) {
      const t = setTimeout(() => {
        reloadAttemptsRef.current += 1;
        setReloadKey((k) => k + 1);
        setImgError(false);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [state, imgError]);

  // ── Draw overlays whenever payload changes ───────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const cssW = parseFloat(cv.style.width || "0");
    const cssH = parseFloat(cv.style.height || "0");
    ctx.clearRect(0, 0, cssW, cssH);

    if (!payload || payload.type !== "stream_frame") return;
    const dims = payload.frame_dimensions;
    const dets = payload.detections;
    if (!dims || !dets || dets.length === 0) return;

    const sx = cssW / dims.width;
    const sy = cssH / dims.height;

    const pText = payload.plate_read?.plate_text ?? null;
    const riskVal = payload.plate_read?.compliance?.risk_score ?? 0;
    const isViolation = riskVal >= 30;

    const strokeMain = isViolation ? "#ED9F7E" : "#A9B394";
    const strokeGlow1 = isViolation ? "rgba(237,159,126,0.35)" : "rgba(169,179,148,0.30)";
    const strokeGlow2 = isViolation ? "rgba(237,159,126,0.12)" : "rgba(169,179,148,0.10)";

    for (const det of dets) {
      const [x1, y1, x2, y2] = det.bbox;
      const X = x1 * sx, Y = y1 * sy;
      const W = (x2 - x1) * sx, H = (y2 - y1) * sy;

      // Outermost diffuse halo (violations get extra size)
      const haloInset = isViolation ? -6 : -3;
      ctx.lineWidth = isViolation ? 8 : 6;
      ctx.strokeStyle = strokeGlow2;
      ctx.strokeRect(X + haloInset, Y + haloInset, W - haloInset * 2, H - haloInset * 2);

      // Mid glow ring
      ctx.lineWidth = 4;
      ctx.strokeStyle = strokeGlow1;
      ctx.strokeRect(X - 1.5, Y - 1.5, W + 3, H + 3);

      // Primary stroke
      ctx.lineWidth = isViolation ? 2.5 : 1.5;
      ctx.strokeStyle = strokeMain;
      ctx.strokeRect(X, Y, W, H);

      // Corner tics — sharper for violations
      const tic = Math.max(10, Math.min(W, H) * 0.09);
      ctx.lineWidth = isViolation ? 3.5 : 2.5;
      ctx.strokeStyle = strokeMain;
      ctx.beginPath();
      ctx.moveTo(X, Y + tic); ctx.lineTo(X, Y); ctx.lineTo(X + tic, Y);
      ctx.moveTo(X + W - tic, Y); ctx.lineTo(X + W, Y); ctx.lineTo(X + W, Y + tic);
      ctx.moveTo(X + W, Y + H - tic); ctx.lineTo(X + W, Y + H); ctx.lineTo(X + W - tic, Y + H);
      ctx.moveTo(X + tic, Y + H); ctx.lineTo(X, Y + H); ctx.lineTo(X, Y + H - tic);
      ctx.stroke();

      // Plate bbox — solid bright stroke + faint fill
      if (det.plate_bbox) {
        const [px1, py1, px2, py2] = det.plate_bbox;
        const PX = px1 * sx, PY = py1 * sy;
        const PW = (px2 - px1) * sx, PH = (py2 - py1) * sy;

        // Fill tint
        ctx.fillStyle = isViolation ? "rgba(237,159,126,0.08)" : "rgba(169,179,148,0.08)";
        ctx.fillRect(PX, PY, PW, PH);

        // Bright solid stroke
        ctx.lineWidth = 2;
        ctx.strokeStyle = pText
          ? (isViolation ? "#ED9F7E" : "#A9B394")
          : "rgba(169,179,148,0.5)";
        ctx.setLineDash([]);
        ctx.strokeRect(PX, PY, PW, PH);

        // Inner corner tics on plate bbox
        const pTic = Math.max(4, Math.min(PW, PH) * 0.15);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PX, PY + pTic); ctx.lineTo(PX, PY); ctx.lineTo(PX + pTic, PY);
        ctx.moveTo(PX + PW - pTic, PY); ctx.lineTo(PX + PW, PY); ctx.lineTo(PX + PW, PY + pTic);
        ctx.moveTo(PX + PW, PY + PH - pTic); ctx.lineTo(PX + PW, PY + PH); ctx.lineTo(PX + PW - pTic, PY + PH);
        ctx.moveTo(PX + pTic, PY + PH); ctx.lineTo(PX, PY + PH); ctx.lineTo(PX, PY + PH - pTic);
        ctx.stroke();
      }

      // Label below the vehicle box
      const conf = det.plate_confidence ?? det.confidence;
      const label = pText
        ? `${pText}  ${Math.round((payload.plate_read?.ocr_confidence ?? conf) * 100)}%`
        : `${det.class_name.toUpperCase()}  ${Math.round(det.confidence * 100)}%`;

      ctx.font = '600 12px "JetBrains Mono", ui-monospace, monospace';
      const padding = 7;
      const metrics = ctx.measureText(label);
      const labelW = metrics.width + padding * 2;
      const labelH = 22;
      const labelY = Math.min(Y + H + 5, cssH - labelH - 2);

      // Label pill background — rounded via clip path approximation
      ctx.fillStyle = isViolation ? "rgba(237,159,126,0.92)" : "rgba(169,179,148,0.88)";
      ctx.fillRect(X, labelY, labelW, labelH);
      ctx.fillStyle = isViolation ? "#3d1408" : "#131810";
      ctx.fillText(label, X + padding, labelY + 15);

      // Top-right risk band tag
      if (isViolation && payload.plate_read?.compliance?.risk_band) {
        const tag = payload.plate_read.compliance.risk_band;
        ctx.font = '700 10px "JetBrains Mono", ui-monospace, monospace';
        const tw = ctx.measureText(tag).width + 12;
        ctx.fillStyle = riskVal >= 80 ? "#B95C5C" : "#BD8658";
        ctx.fillRect(X + W - tw, Y - 20, tw, 17);
        ctx.fillStyle = "white";
        ctx.fillText(tag, X + W - tw + 6, Y - 7);
      }
    }
  }, [payload]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-stone-950 select-none",
        className
      )}
      style={{ aspectRatio: "16 / 9" }}
    >
      {mjpegUrl && !imgError && (
        <img
          key={reloadKey}
          ref={imgRef}
          src={reloadKey === 0 ? mjpegUrl : `${mjpegUrl}${mjpegUrl.includes("?") ? "&" : "?"}_r=${reloadKey}`}
          alt="Live camera feed"
          onError={() => setImgError(true)}
          className={cn(
            "absolute inset-0 w-full h-full object-cover",
            state === "live" ? "opacity-100" : "opacity-40"
          )}
          draggable={false}
        />
      )}

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Evidence capture flash */}
      <EnhancedFlash flashKey={flashKey} risk={risk} />

      {/* AI pipeline stage chip (top-left, only when live) */}
      {state === "live" && (
        <AiStageChip
          hasDetections={hasDetections}
          plateText={plateText}
          risk={risk}
          ocrAttemptKey={ocrAttemptKey}
        />
      )}

      {/* Plate read HUD — typewriter + confidence bar */}
      <AnimatePresence>
        {plateText && state === "live" && (
          <PlateReadHUD
            key={plateText}
            plateText={plateText}
            risk={risk}
            ocrConf={ocrConf}
          />
        )}
      </AnimatePresence>

      <StateBanner state={state} />

      {/* Recovery overlay: shows on reconnecting/offline with countdown + actions */}
      {(state === "reconnecting" || state === "offline") && (
        <RecoveryOverlay
          state={state}
          attempt={reconnectAttempt}
          onReconnect={onManualReconnect}
          onAbandon={onAbandon}
        />
      )}

      {!mjpegUrl && state !== "reconnecting" && state !== "offline" && <NoFeedScrim />}

      <Corner pos="tl" />
      <Corner pos="tr" />
      <Corner pos="bl" />
      <Corner pos="br" />
    </div>
  );
}

// ── AI Stage Chip ─────────────────────────────────────────────────────────────

type AiStage = "analyzing" | "ocr_active" | "plate_locked";

function AiStageChip({
  hasDetections,
  plateText,
  risk,
  ocrAttemptKey,
}: {
  hasDetections: boolean;
  plateText: string | null;
  risk: number;
  ocrAttemptKey: number;
}) {
  const [ocrActive, setOcrActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ocrAttemptKey === 0) return;
    setOcrActive(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOcrActive(false), 1400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [ocrAttemptKey]);

  const stage: AiStage | null = ocrActive
    ? "ocr_active"
    : plateText
    ? "plate_locked"
    : hasDetections
    ? "analyzing"
    : null;

  if (!stage) return null;

  const isViolation = risk >= 30;

  const cfg: Record<AiStage, { label: string; dot: string; text: string; border: string; bg: string }> = {
    analyzing: {
      label: "ANALYZING",
      dot: "bg-stone-400 animate-pulse",
      text: "text-stone-300",
      border: "border-stone-600/40",
      bg: "bg-stone-950/85",
    },
    ocr_active: {
      label: "OCR EXTRACTING",
      dot: "bg-bronze-400",
      text: "text-bronze-300",
      border: "border-bronze-400/35",
      bg: "bg-stone-950/88",
    },
    plate_locked: {
      label: isViolation ? "VIOLATION FLAGGED" : "PLATE CLEAR",
      dot: isViolation ? "bg-peach-400 animate-pulse" : "bg-sage-400",
      text: isViolation ? "text-peach-300" : "text-sage-300",
      border: isViolation ? "border-peach-400/35" : "border-sage-400/35",
      bg: "bg-stone-950/88",
    },
  };

  const c = cfg[stage];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stage}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -6 }}
        transition={{ duration: 0.15 }}
        className="absolute top-3 left-4 pointer-events-none z-10"
      >
        <span
          className={cn(
            "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md border",
            "font-mono text-2xs font-semibold tracking-[0.16em] backdrop-blur-sm",
            c.bg, c.text, c.border
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full shrink-0 animate-pulse", c.dot)}
          />
          {c.label}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Plate Read HUD ─────────────────────────────────────────────────────────────

function PlateReadHUD({
  plateText,
  risk,
  ocrConf,
}: {
  plateText: string;
  risk: number;
  ocrConf: number | null;
}) {
  const [displayed, setDisplayed] = useState("");
  const [confVal, setConfVal] = useState(0);

  const isViolation = risk >= 30;
  const targetConf = Math.round((ocrConf ?? 0) * 100);

  useEffect(() => {
    setDisplayed("");
    setConfVal(0);
    const len = plateText.length;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(plateText.slice(0, i));
      setConfVal(Math.round((i / len) * targetConf));
      if (i >= len) clearInterval(id);
    }, 42);
    return () => clearInterval(id);
  }, [plateText, targetConf]);

  const accentBar = isViolation ? "bg-peach-500" : "bg-sage-500";
  const accentText = isViolation ? "text-peach-400" : "text-sage-400";
  const borderColor = isViolation ? "border-peach-500/25" : "border-sage-500/25";
  const riskLabel = risk >= 80 ? "CRITICAL" : risk >= 55 ? "HIGH" : risk >= 30 ? "MODERATE" : "CLEAR";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none z-10"
    >
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border px-5 py-3",
          "bg-stone-950/88 backdrop-blur-md",
          borderColor
        )}
      >
        {/* Plate text with typewriter cursor */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl font-bold tracking-[0.22em] text-white leading-none">
            {displayed}
            {displayed.length < plateText.length && (
              <span className="ml-0.5 inline-block w-[3px] h-6 align-[-5px] bg-white animate-pulse" />
            )}
          </span>
          <span
            className={cn(
              "text-2xs font-mono font-bold tracking-[0.14em] px-1.5 py-0.5 rounded border",
              isViolation
                ? "text-peach-300 border-peach-500/30 bg-peach-900/30"
                : "text-sage-300 border-sage-500/30 bg-sage-900/30"
            )}
          >
            {riskLabel}
          </span>
        </div>

        {/* OCR confidence bar */}
        <div className="flex items-center gap-2 w-full min-w-[200px]">
          <span className="text-2xs font-mono text-stone-500 shrink-0 w-7">OCR</span>
          <div className="flex-1 h-1 rounded-full bg-stone-800">
            <motion.div
              className={cn("h-full rounded-full", accentBar)}
              initial={{ width: "0%" }}
              animate={{ width: `${confVal}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
          <span className={cn("text-2xs font-mono font-semibold shrink-0 w-8 text-right tabular-nums", accentText)}>
            {confVal}%
          </span>
        </div>

        {/* Risk score */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-2xs font-mono text-stone-500 shrink-0 w-7">RISK</span>
          <div className="flex-1 h-1 rounded-full bg-stone-800">
            <div
              className={cn("h-full rounded-full", isViolation ? "bg-peach-600" : "bg-sage-600")}
              style={{ width: `${risk}%` }}
            />
          </div>
          <span className={cn("text-2xs font-mono font-semibold shrink-0 w-8 text-right tabular-nums", accentText)}>
            {risk}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Enhanced Evidence Capture Flash ──────────────────────────────────────────

function EnhancedFlash({ flashKey, risk }: { flashKey: number; risk: number }) {
  const tintColor =
    risk >= 80 ? "rgba(185,92,92,0.45)"
    : risk >= 30 ? "rgba(189,134,88,0.40)"
    : "rgba(127,136,118,0.38)";

  const scanColor = risk >= 30 ? "rgba(237,159,126,0.55)" : "rgba(169,179,148,0.50)";
  const scanGradient = `linear-gradient(to bottom, transparent 0%, ${scanColor} 50%, transparent 100%)`;

  return (
    <AnimatePresence>
      {flashKey > 0 && (
        <motion.div
          key={flashKey}
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {/* Primary white flash */}
          <motion.div
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 bg-white mix-blend-screen"
          />
          {/* Colored tint */}
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
            className="absolute inset-0"
            style={{ background: tintColor }}
          />
          {/* Scan line — starts above container, sweeps to well below it */}
          <motion.div
            initial={{ y: -60, opacity: 1 }}
            animate={{ y: 900, opacity: 0.15 }}
            transition={{ duration: 0.55, ease: "linear" }}
            className="absolute inset-x-0"
            style={{ height: 60, background: scanGradient }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Connection State Banner ───────────────────────────────────────────────────

function StateBanner({ state }: { state: Props["state"] }) {
  if (state === "live") return null;
  const cfg = {
    idle:         { color: "bg-stone-800/80 text-stone-200 border-stone-700",        label: "STREAM IDLE — connect a source to begin" },
    connecting:   { color: "bg-bronze-500/15 text-bronze-200 border-bronze-300/30",  label: "OPENING STREAM…" },
    reconnecting: { color: "bg-bronze-500/15 text-bronze-200 border-bronze-300/30",  label: "CONNECTIVITY DROPPED — INITIATING HANDSHAKE RETRY" },
    offline:      { color: "bg-peach-500/15 text-peach-200 border-peach-300/30",     label: "STREAM OFFLINE" },
  }[state];
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
      <span
        className={cn(
          "inline-flex items-center gap-2 h-7 px-3 rounded-md border backdrop-blur-[2px]",
          "font-mono text-2xs font-semibold tracking-[0.18em] uppercase",
          cfg.color
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90 animate-pulse" />
        {cfg.label}
      </span>
    </div>
  );
}

// ── Recovery overlay ───────────────────────────────────────────────────────────
//
// Replaces the dead/white space when the stream drops. Shows a heartbeat-style
// pulse, the current retry attempt, and offers manual recovery actions.

function RecoveryOverlay({
  state,
  attempt,
  onReconnect,
  onAbandon,
}: {
  state: "reconnecting" | "offline";
  attempt: number;
  onReconnect?: () => void;
  onAbandon?: () => void;
}) {
  const reconnecting = state === "reconnecting";
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
      {/* Backdrop scrim so the (possibly-stale) MJPEG frame fades back */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(15,14,12,0.55) 0%, rgba(15,14,12,0.88) 100%)",
        }}
      />
      <div className="relative z-10 pointer-events-auto w-[min(420px,86%)] bg-stone-950/85 backdrop-blur-md border border-stone-700/60 rounded-xl px-5 py-4 text-center shadow-popover">
        <div className="flex items-center justify-center gap-2.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full animate-pulse",
              reconnecting ? "bg-bronze-400" : "bg-peach-400"
            )}
          />
          <p className="font-mono text-2xs tracking-[0.22em] uppercase text-stone-300 font-semibold">
            {reconnecting ? "RECONNECTING TO SOURCE" : "STREAM OFFLINE"}
          </p>
        </div>
        <p className="mt-2 text-2xs font-mono text-stone-400 leading-relaxed">
          {reconnecting
            ? "Connection dropped. Attempting handshake with the phone — keep the IP Webcam app open and the screen on."
            : "We exhausted the automatic retries. Re-open the source from the phone, then trigger a manual reconnect."}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-2xs font-mono">
          <div className="rounded-md border border-stone-700/60 bg-stone-900/60 px-2 py-1.5">
            <p className="text-stone-500 tracking-[0.14em] uppercase">Attempt</p>
            <p className="mt-0.5 text-stone-200 tabular-nums">{attempt || 0}</p>
          </div>
          <div className="rounded-md border border-stone-700/60 bg-stone-900/60 px-2 py-1.5">
            <p className="text-stone-500 tracking-[0.14em] uppercase">State</p>
            <p className="mt-0.5 text-stone-200">{reconnecting ? "RETRY" : "FAILED"}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          {onReconnect && (
            <button
              onClick={onReconnect}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-sage-600 hover:bg-sage-700 text-white text-2xs font-mono font-semibold tracking-[0.14em] uppercase transition-colors"
            >
              Force reconnect
            </button>
          )}
          {onAbandon && (
            <button
              onClick={onAbandon}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-stone-700 hover:border-stone-500 text-stone-300 hover:text-white text-2xs font-mono font-semibold tracking-[0.14em] uppercase transition-colors"
            >
              Abandon stream
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── No-feed Scrim ─────────────────────────────────────────────────────────────

function NoFeedScrim() {
  return (
    <div aria-hidden className="absolute inset-0 flex items-center justify-center">
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, hsl(90 12% 12%) 0%, hsl(40 14% 6%) 70%, hsl(0 0% 3%) 100%)" }}
      />
      <div className="relative z-10 text-center">
        <p className="font-mono text-2xs tracking-[0.24em] uppercase text-stone-500">
          Awaiting stream source
        </p>
        <p className="mt-1 text-2xs text-stone-600">
          Connect a mobile camera, RTSP feed, or local webcam
        </p>
      </div>
    </div>
  );
}

// ── Corner Brackets ───────────────────────────────────────────────────────────

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map = {
    tl: "top-3 left-3 border-l border-t",
    tr: "top-3 right-3 border-r border-t",
    bl: "bottom-3 left-3 border-l border-b",
    br: "bottom-3 right-3 border-r border-b",
  } as const;
  return (
    <span
      aria-hidden
      className={cn("absolute w-3 h-3 border-sage-200/60 pointer-events-none", map[pos])}
    />
  );
}
