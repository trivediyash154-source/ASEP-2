"use client";

import { useEffect, useRef } from "react";

/**
 * CursorGlow — soft radial spotlight that trails the cursor with ~8% lag.
 *
 * Implementation:
 *   - Single fixed-position blurred radial gradient div.
 *   - rAF loop interpolates current position toward the latest pointer
 *     event (`x += (target - x) * 0.08`), giving the cinematic trailing.
 *   - No state updates, no React re-renders — just `style.transform`.
 *
 * Disabled when the OS reports `prefers-reduced-motion`. The element
 * uses `pointer-events: none` and `mix-blend-mode: soft-light` so it
 * never interferes with input focus or hit-testing.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const el = ref.current;
    if (!el) return;

    // Off-screen by default so the glow doesn't pop at (0,0) on mount.
    let curX = -9999;
    let curY = -9999;
    let tgtX = -9999;
    let tgtY = -9999;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tgtX = e.clientX;
      tgtY = e.clientY;
      if (curX < -1000) {
        curX = tgtX;
        curY = tgtY;
      }
    };

    const tick = () => {
      curX += (tgtX - curX) * 0.08;
      curY += (tgtY - curY) * 0.08;
      el.style.transform = `translate3d(${curX - 220}px, ${curY - 220}px, 0)`;
      raf = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-0 h-[440px] w-[440px] rounded-full will-change-transform"
      style={{
        background:
          "radial-gradient(circle, rgba(196,167,125,0.18) 0%, rgba(127,136,118,0.10) 40%, transparent 70%)",
        filter: "blur(40px)",
        mixBlendMode: "soft-light",
        transform: "translate3d(-9999px,-9999px,0)",
      }}
    />
  );
}
