"use client";

import { cn } from "@/lib/utils";

interface Props {
  intensity?: "low" | "medium" | "high";
  className?: string;
}

/**
 * Premium 3D light-rays background.
 *
 * Composed of six independently-blurred layers that simulate volumetric
 * spotlights coming through an atmosphere. The conic gradients are wide
 * and soft so the "rays" never look like hard CSS spokes; the radial
 * accent orbs add depth; a fine dot grid and grain pass break up the
 * gradient banding that otherwise gives away the trick.
 *
 * Honors `prefers-reduced-motion` — the slow drift animations are
 * disabled at the OS level when the user opts out.
 */
export function LightRaysBackground({ intensity = "medium", className }: Props) {
  const opacityMap = { low: "opacity-30", medium: "opacity-60", high: "opacity-80" };

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none [perspective:1200px]",
        className,
      )}
      aria-hidden
    >
      {/* ── Atmospheric base — warm sage center, fades to surface ── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-15%,rgba(127,136,118,0.32),transparent_72%)]" />

      {/* ── Primary ray cone — angled, blurred conic gradient ── */}
      <div
        className={cn(
          "absolute -top-[45%] left-1/2 -translate-x-1/2 w-[160%] h-[140%] animate-rays-drift",
          opacityMap[intensity],
        )}
        style={{
          transform: "translateX(-50%) rotateX(28deg)",
          transformOrigin: "50% 0%",
          background: `
            conic-gradient(
              from 195deg at 50% 0%,
              transparent 0deg,
              rgba(127,136,118,0.14) 12deg,
              transparent 28deg,
              transparent 48deg,
              rgba(196,167,125,0.10) 64deg,
              transparent 82deg,
              transparent 118deg,
              rgba(127,136,118,0.16) 138deg,
              transparent 156deg,
              transparent 182deg,
              rgba(196,167,125,0.09) 204deg,
              transparent 222deg,
              transparent 252deg,
              rgba(127,136,118,0.13) 274deg,
              transparent 296deg,
              transparent 326deg,
              rgba(196,167,125,0.08) 344deg,
              transparent 360deg
            )
          `,
          filter: "blur(46px)",
        }}
      />

      {/* ── Secondary ray cone — offset, longer wavelengths ── */}
      <div
        className={cn(
          "absolute -top-[32%] left-[44%] -translate-x-1/2 w-[140%] h-[110%] animate-rays-drift-slow",
          opacityMap[intensity],
        )}
        style={{
          transform: "translateX(-50%) rotateX(22deg) rotateZ(-3deg)",
          transformOrigin: "50% 0%",
          background: `
            conic-gradient(
              from 158deg at 55% 0%,
              transparent 0deg,
              rgba(196,167,125,0.09) 18deg,
              transparent 44deg,
              transparent 92deg,
              rgba(127,136,118,0.12) 112deg,
              transparent 134deg,
              transparent 198deg,
              rgba(196,167,125,0.08) 222deg,
              transparent 246deg,
              transparent 298deg,
              rgba(127,136,118,0.07) 318deg,
              transparent 342deg
            )
          `,
          filter: "blur(68px)",
        }}
      />

      {/* ── Volumetric haze — soft horizontal glow band ── */}
      <div
        className="absolute top-[3%] left-0 right-0 h-[44%]"
        style={{
          background:
            "linear-gradient(180deg, rgba(127,136,118,0.10) 0%, rgba(196,167,125,0.04) 55%, transparent 100%)",
          filter: "blur(82px)",
        }}
      />

      {/* ── Warm spotlight orb (right) ── */}
      <div
        className="absolute top-[8%] right-[12%] w-[34vw] h-[34vw] max-w-[440px] max-h-[440px] rounded-full animate-orb-float"
        style={{
          background: "radial-gradient(circle, rgba(196,167,125,0.18) 0%, transparent 65%)",
          filter: "blur(54px)",
        }}
      />

      {/* ── Cool spotlight orb (left, smaller, deeper) ── */}
      <div
        className="absolute top-[26%] left-[8%] w-[24vw] h-[24vw] max-w-[320px] max-h-[320px] rounded-full animate-orb-float-slow"
        style={{
          background: "radial-gradient(circle, rgba(127,136,118,0.16) 0%, transparent 60%)",
          filter: "blur(64px)",
        }}
      />

      {/* ── Fine dot grid (depth cue) ── */}
      <div
        className="absolute inset-0 opacity-[0.10] text-stone-600"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)",
          backgroundSize: "30px 30px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 0%, transparent 75%)",
        }}
      />

      {/* ── Grain overlay (kills banding) ── */}
      <div className="absolute inset-0 opacity-[0.18] bg-grain [background-size:24px_24px] mix-blend-overlay" />
    </div>
  );
}
