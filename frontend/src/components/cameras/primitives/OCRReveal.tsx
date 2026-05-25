"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface Props {
  text: string;
  /** Bump to force replay even when text is unchanged */
  triggerKey?: number;
  /** Total reveal duration in ms */
  duration?: number;
  className?: string;
}

const POOL = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

/**
 * Cinematic OCR reveal — scrambles each character independently and locks
 * them left-to-right over `duration` ms. Preserves horizontal width so the
 * layout never shifts mid-reveal. Whitespace and dashes are passed through
 * unchanged so plate formats like "MH 12 AB 1234" still read correctly.
 */
export function OCRReveal({ text, triggerKey = 0, duration = 460, className }: Props) {
  const [display, setDisplay] = useState(text);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    const chars = text.split("");
    if (chars.length === 0) {
      setDisplay("");
      return;
    }
    const lockedAt = chars.map(
      (_, i) => duration * (0.30 + (0.65 * (i + 1)) / chars.length)
    );
    const start = performance.now();

    const tick = () => {
      const elapsed = performance.now() - start;
      let allLocked = true;
      const out = chars.map((c, i) => {
        if (c === " " || c === "-") return c;
        if (elapsed >= lockedAt[i]) return c;
        allLocked = false;
        return POOL[Math.floor(Math.random() * POOL.length)];
      });
      setDisplay(out.join(""));
      if (!allLocked) {
        raf.current = requestAnimationFrame(tick);
      } else {
        raf.current = null;
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [text, triggerKey, duration]);

  return (
    <span className={cn("tabular-nums", className)} aria-label={text}>
      {display}
    </span>
  );
}
