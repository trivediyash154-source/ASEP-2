"use client";

import { useMemo, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useCamerasStore, type LiveDetectionEvent } from "@/lib/stores/cameras.store";

interface Props {
  cameraId: string;
  cameraCode?: string;
  /** Whether to render the lower-left LOC + upper-right time HUD chrome */
  hud?: "minimal" | "full" | "none";
  /** Whether AI overlay should render (off in disconnected/error states) */
  online?: boolean;
  /** Size hint — drives overlay font/box stroke weight */
  density?: "compact" | "comfortable" | "hero";
  /** Aspect ratio of the feed window. Default 16:9. */
  aspectRatio?: string;
  className?: string;
  /** Optional click handler that fires when a bounding box is clicked */
  onDetectionClick?: (event: LiveDetectionEvent) => void;
  /** Monotonic key that triggers a white evidence-capture flash inside the
   *  feed viewport. Bump on every new detection for the framed camera. */
  flashKey?: number;
  /** Extra overlay layers (pulse, dossier, ceremony) rendered inside the
   *  feed's clipped bounds so they obey the rounded corners. */
  children?: ReactNode;
}

const FRAME_W = 1920;
const FRAME_H = 1080;
const OVERLAY_LIFETIME_MS = 4200;

/**
 * The visual centerpiece of the surveillance module.
 *
 * Renders a dark, low-light "CCTV" canvas built from layered gradients,
 * tactical corner brackets, a drifting scanline, and animated AI overlays
 * driven by real detection events from the cameras store. The "video"
 * itself is stylised — we don't have RTSP/HLS bridges in dev — but every
 * piece of overlay data (bbox coords, plate, confidence, time) is real.
 */
export function CameraFeedCanvas({
  cameraId,
  cameraCode,
  hud = "full",
  online = true,
  density = "comfortable",
  aspectRatio = "16 / 9",
  className,
  onDetectionClick,
  flashKey,
  children,
}: Props) {
  const events = useCamerasStore((s) => s.eventsByCamera[cameraId] ?? []);

  // Active overlays = events received in the last OVERLAY_LIFETIME_MS
  const now = Date.now();
  const active = events.filter((e) => now - e.receivedAt < OVERLAY_LIFETIME_MS).slice(0, 3);

  const stroke = density === "hero" ? 2.5 : density === "compact" ? 1.25 : 1.75;
  const tickSize = density === "hero" ? 12 : density === "compact" ? 5 : 8;
  const plateFontSize = density === "hero" ? "0.8125rem" : density === "compact" ? "0.625rem" : "0.75rem";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg",
        "bg-stone-950 select-none",
        online ? "" : "grayscale brightness-[0.4]",
        className
      )}
      style={{ aspectRatio }}
    >
      {/* ── Layered "low-light street scene" backdrop ───────────────────── */}
      <FeedBackdrop seed={cameraId} />

      {/* ── Drifting scanline ───────────────────────────────────────────── */}
      {online && (
        <motion.div
          aria-hidden
          className="absolute inset-x-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(169,179,148,0.42) 50%, transparent)",
            filter: "blur(0.5px)",
          }}
          animate={{ y: ["0%", "100%"] }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* ── Tactical corner brackets ────────────────────────────────────── */}
      <Corner pos="tl" size={tickSize} />
      <Corner pos="tr" size={tickSize} />
      <Corner pos="bl" size={tickSize} />
      <Corner pos="br" size={tickSize} />

      {/* ── Crosshair (only on hero) ────────────────────────────────────── */}
      {density === "hero" && online && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-1/2 left-0 right-0 h-px bg-sage-300/10" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-sage-300/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 border border-sage-300/25 rounded-full" />
        </div>
      )}

      {/* ── HUD chrome ──────────────────────────────────────────────────── */}
      {hud !== "none" && (
        <div className="absolute inset-x-2 top-2 flex items-start justify-between text-stone-300/80 font-mono text-[0.625rem] tracking-[0.16em] uppercase pointer-events-none">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30" />
            REC · {cameraCode ?? "—"}
          </span>
          {hud === "full" && (
            <span className="tabular-nums">{`${FRAME_W}×${FRAME_H}`}</span>
          )}
        </div>
      )}

      {/* ── AI detection overlays ───────────────────────────────────────── */}
      <AnimatePresence>
        {online &&
          active.map((e, i) => (
            <DetectionOverlay
              key={e.id}
              event={e}
              stroke={stroke}
              fontSize={plateFontSize}
              z={active.length - i}
              onClick={onDetectionClick}
            />
          ))}
      </AnimatePresence>

      {/* ── Offline state ───────────────────────────────────────────────── */}
      {!online && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-mono text-[0.625rem] tracking-[0.22em] uppercase text-stone-400">
            No signal
          </p>
        </div>
      )}

      {/* ── Evidence capture flash ──────────────────────────────────────── */}
      <AnimatePresence>
        {flashKey !== undefined && flashKey > 0 && (
          <motion.div
            key={flashKey}
            aria-hidden
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 bg-white pointer-events-none mix-blend-screen"
          />
        )}
      </AnimatePresence>

      {/* ── External overlay slot (pulse, dossier, ceremony, …) ─────────── */}
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Internal pieces
// ════════════════════════════════════════════════════════════════════

function Corner({ pos, size }: { pos: "tl" | "tr" | "bl" | "br"; size: number }) {
  const base = "absolute border-sage-200/60";
  const map = {
    tl: "top-1.5 left-1.5 border-l border-t",
    tr: "top-1.5 right-1.5 border-r border-t",
    bl: "bottom-1.5 left-1.5 border-l border-b",
    br: "bottom-1.5 right-1.5 border-r border-b",
  } as const;
  return <span aria-hidden className={cn(base, map[pos])} style={{ width: size, height: size }} />;
}

function DetectionOverlay({
  event,
  stroke,
  fontSize,
  z,
  onClick,
}: {
  event: LiveDetectionEvent;
  stroke: number;
  fontSize: string;
  z: number;
  onClick?: (event: LiveDetectionEvent) => void;
}) {
  const b = event.bounding_box;
  if (!b) return null;

  const fw = event.frame_width ?? FRAME_W;
  const fh = event.frame_height ?? FRAME_H;

  const left = (b.x1 / fw) * 100;
  const top = (b.y1 / fh) * 100;
  const width = ((b.x2 - b.x1) / fw) * 100;
  const height = ((b.y2 - b.y1) / fh) * 100;

  const isViolation = event.is_violation;
  const accent = isViolation ? "#ED9F7E" : "#A9B394";

  return (
    <motion.button
      type="button"
      onClick={onClick ? () => onClick(event) : undefined}
      initial={{ opacity: 0, scale: 1.08 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "absolute group/box rounded-sm focus-visible:outline-none",
        onClick ? "cursor-pointer" : "cursor-default pointer-events-none"
      )}
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
        outline: `${stroke}px solid ${accent}`,
        outlineOffset: 0,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.5), 0 0 20px ${accent}33`,
        zIndex: z,
      }}
    >
      {/* Inner corner tics */}
      {(["tl", "tr", "bl", "br"] as const).map((p) => (
        <span
          key={p}
          aria-hidden
          className="absolute"
          style={{
            background: accent,
            width: stroke * 4,
            height: stroke,
            transform:
              p === "tl"
                ? `translate(-${stroke}px, -${stroke}px)`
                : p === "tr"
                ? `translate(0, -${stroke}px)`
                : p === "bl"
                ? `translate(-${stroke}px, ${stroke}px)`
                : `translate(0, ${stroke}px)`,
            top: p.startsWith("t") ? 0 : "auto",
            bottom: p.startsWith("b") ? 0 : "auto",
            left: p.endsWith("l") ? 0 : "auto",
            right: p.endsWith("r") ? 0 : "auto",
          }}
        />
      ))}

      {/* Plate label below the box */}
      <span
        className={cn(
          "absolute left-0 top-full mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-mono font-semibold tracking-[0.06em]",
          "whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        )}
        style={{
          background: accent,
          color: isViolation ? "#451f10" : "#1d2418",
          fontSize,
        }}
      >
        {event.plate ?? "—"}
        {event.ocr_confidence !== undefined && (
          <span className="opacity-70 ml-0.5">{Math.round(event.ocr_confidence * 100)}%</span>
        )}
      </span>

      {/* Violation tag, above the box */}
      {isViolation && event.violation_type && (
        <span
          className="absolute right-0 -top-5 px-1.5 py-0.5 rounded-sm font-mono text-[0.625rem] font-semibold tracking-[0.06em] uppercase shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          style={{ background: "#B95C5C", color: "white" }}
        >
          {event.violation_type}
        </span>
      )}
    </motion.button>
  );
}

/**
 * Deterministic-per-camera dark backdrop suggesting a low-light street scene.
 * Same `seed` produces the same pattern, so a given camera always looks the
 * same between mounts.
 */
function FeedBackdrop({ seed }: { seed: string }) {
  const { hueA, hueB, x1, y1, x2, y2, x3, y3, horizon } = useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const r = (n: number) => {
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      return (h % n) / n;
    };
    return {
      hueA: 28 + Math.floor(r(1) * 20),         // warm sand/bronze range
      hueB: 90 + Math.floor(r(1) * 20),         // cool sage range
      x1: 20 + r(1) * 35,
      y1: 25 + r(1) * 25,
      x2: 55 + r(1) * 35,
      y2: 50 + r(1) * 30,
      x3: 10 + r(1) * 80,
      y3: 70 + r(1) * 20,
      horizon: 52 + r(1) * 10,
    };
  }, [seed]);

  return (
    <div aria-hidden className="absolute inset-0">
      {/* Sky → ground gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            hsl(${hueB} 12% 11%) 0%,
            hsl(${hueB} 10% 8%) ${horizon - 6}%,
            hsl(${hueA} 14% 6%) ${horizon}%,
            hsl(${hueA} 12% 4%) 100%)`,
        }}
      />
      {/* Soft warm street light */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at ${x1}% ${y1}%, hsla(${hueA}, 60%, 50%, 0.10) 0%, transparent 35%),
                       radial-gradient(ellipse at ${x2}% ${y2}%, hsla(${hueB}, 30%, 55%, 0.08) 0%, transparent 40%),
                       radial-gradient(ellipse at ${x3}% ${y3}%, hsla(20, 60%, 50%, 0.07) 0%, transparent 30%)`,
          mixBlendMode: "screen",
        }}
      />
      {/* Horizon line — very subtle */}
      <div
        className="absolute inset-x-0 h-px"
        style={{
          top: `${horizon}%`,
          background: "linear-gradient(90deg, transparent, rgba(169,179,148,0.10) 50%, transparent)",
        }}
      />
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />
    </div>
  );
}
