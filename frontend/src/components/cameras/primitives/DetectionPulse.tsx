"use client";

import { motion } from "framer-motion";

import type { LiveDetectionEvent } from "@/lib/stores/cameras.store";

interface Props {
  event: LiveDetectionEvent | null;
  /** Bump to force-replay the animation even when the event reference is stable */
  triggerKey: number;
  frameWidth?: number;
  frameHeight?: number;
}

const FRAME_W = 1920;
const FRAME_H = 1080;

/**
 * Two concentric pulse rings that emanate from the centre of the most
 * recent detection bounding box. Re-mounts on every `triggerKey` change so
 * each new detection re-fires the animation cleanly.
 */
export function DetectionPulse({ event, triggerKey, frameWidth, frameHeight }: Props) {
  if (!event?.bounding_box || triggerKey === 0) return null;

  const b = event.bounding_box;
  const fw = event.frame_width ?? frameWidth ?? FRAME_W;
  const fh = event.frame_height ?? frameHeight ?? FRAME_H;

  const cx = ((b.x1 + b.x2) / 2 / fw) * 100;
  const cy = ((b.y1 + b.y2) / 2 / fh) * 100;
  const widthPct = Math.max(((b.x2 - b.x1) / fw) * 100, 8);

  const accent = event.is_violation
    ? "rgba(237,159,126,0.70)"
    : "rgba(169,179,148,0.62)";

  return (
    <div
      key={triggerKey}
      aria-hidden
      className="absolute pointer-events-none"
      style={{
        left: `${cx}%`,
        top: `${cy}%`,
        width: `${widthPct}%`,
        aspectRatio: "1 / 1",
        transform: "translate(-50%, -50%)",
      }}
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          border: `2px solid ${accent}`,
          boxShadow: `0 0 32px ${accent}`,
        }}
        initial={{ scale: 0.5, opacity: 0.92 }}
        animate={{ scale: 2.6, opacity: 0 }}
        transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ border: `1px solid ${accent}` }}
        initial={{ scale: 0.7, opacity: 0.75 }}
        animate={{ scale: 3.6, opacity: 0 }}
        transition={{ duration: 1.45, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Crosshair dot at centre */}
      <motion.span
        className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full"
        style={{
          background: accent,
          boxShadow: `0 0 10px ${accent}`,
          transform: "translate(-50%, -50%)",
        }}
        initial={{ opacity: 0.95, scale: 1 }}
        animate={{ opacity: 0, scale: 1.6 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
