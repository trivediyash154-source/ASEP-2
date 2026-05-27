"use client";

/**
 * LightRaysBackground — login hero.
 *
 * Six-layer composition that simulates volumetric light coming from above:
 *   1. Warm sage radial atmosphere (matches existing brand background)
 *   2. SVG turbulence + displacement filter → soft aurora streaks
 *   3. Angled conic ray cone (primary)
 *   4. Offset conic ray cone (secondary, slower)
 *   5. Two floating spotlight orbs (sage + bronze)
 *   6. Masked dot grid + grain pass to break up gradient banding
 *
 * Performance: no canvas, no WebGL. Each layer is a single blurred
 * gradient, so the whole composition is ~6 render passes the GPU handles
 * in <1ms per frame. Animations are slow (18–26s) and pause for the
 * OS-level `prefers-reduced-motion`.
 */
import { cn } from "@/lib/utils";

interface Props {
  /** Visual loudness. Drives layer opacity. */
  intensity?: "low" | "medium" | "high";
  /** Animation speed multiplier. 1 = default 18–26s loops. */
  speed?: number;
  /** Override brand tints (sage + bronze by default). */
  tintColors?: { primary: string; secondary: string };
  /** Hard kill the animations (overrides reduced-motion auto-detect). */
  disableMotion?: boolean;
  className?: string;
}

const DEFAULT_TINTS = {
  primary: "127,136,118",   // sage
  secondary: "196,167,125", // bronze
};

export function LightRaysBackground({
  intensity = "medium",
  speed = 1,
  tintColors,
  disableMotion = false,
  className,
}: Props) {
  const tints = tintColors ?? DEFAULT_TINTS;
  const opacityMap = { low: 0.4, medium: 0.65, high: 0.85 } as const;
  const baseOpacity = opacityMap[intensity];

  // Speed is applied via inline `animation-duration` so the prop is honored
  // at the component boundary instead of forking 4 utility classes per speed.
  const rayCycle = 18 / Math.max(0.25, speed);
  const rayCycleSlow = 26 / Math.max(0.25, speed);
  const orbCycle = 14 / Math.max(0.25, speed);
  const orbCycleSlow = 22 / Math.max(0.25, speed);

  // When motion is disabled, set duration to 0 so the keyframe doesn't run
  // (and the element rests on its inline `transform`).
  const animSafe = (s: string) => (disableMotion ? "0s" : s);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden [perspective:1400px]",
        className,
      )}
      aria-hidden
    >
      {/* ── Atmospheric base (preserves brand background hue) ── */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 90% 60% at 50% -10%, rgba(${tints.primary},0.35), transparent 72%)`,
        }}
      />

      {/* ── SVG aurora streaks (turbulence + displacement) ── */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ opacity: baseOpacity * 0.55 }}
        preserveAspectRatio="none"
        viewBox="0 0 1200 800"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="aurora-warp" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.025" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="60" />
            <feGaussianBlur stdDeviation="30" />
          </filter>
          <linearGradient id="aurora-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={`rgba(${tints.primary},0.0)`} />
            <stop offset="40%"  stopColor={`rgba(${tints.primary},0.45)`} />
            <stop offset="60%"  stopColor={`rgba(${tints.secondary},0.35)`} />
            <stop offset="100%" stopColor={`rgba(${tints.secondary},0.0)`} />
          </linearGradient>
          <linearGradient id="aurora-grad-2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor={`rgba(${tints.secondary},0.0)`} />
            <stop offset="50%"  stopColor={`rgba(${tints.primary},0.32)`} />
            <stop offset="100%" stopColor={`rgba(${tints.primary},0.0)`} />
          </linearGradient>
        </defs>

        <g filter="url(#aurora-warp)">
          <rect x="-100" y="80"  width="1400" height="160" fill="url(#aurora-grad-1)" />
          <rect x="-100" y="280" width="1400" height="120" fill="url(#aurora-grad-2)" />
          <rect x="-100" y="460" width="1400" height="140" fill="url(#aurora-grad-1)" />
        </g>
      </svg>

      {/* ── Primary ray cone (angled, perspective-tilted) ── */}
      <div
        className="absolute -top-[50%] left-1/2 w-[170%] h-[150%]"
        style={{
          opacity: baseOpacity,
          transform: "translateX(-50%) rotateX(30deg)",
          transformOrigin: "50% 0%",
          background: `conic-gradient(
            from 195deg at 50% 0%,
            transparent 0deg,
            rgba(${tints.primary},0.18) 12deg,
            transparent 28deg,
            transparent 48deg,
            rgba(${tints.secondary},0.13) 64deg,
            transparent 82deg,
            transparent 118deg,
            rgba(${tints.primary},0.20) 138deg,
            transparent 156deg,
            transparent 182deg,
            rgba(${tints.secondary},0.12) 204deg,
            transparent 222deg,
            transparent 252deg,
            rgba(${tints.primary},0.16) 274deg,
            transparent 296deg,
            transparent 326deg,
            rgba(${tints.secondary},0.10) 344deg,
            transparent 360deg
          )`,
          filter: "blur(46px)",
          animation: `loginRaysDrift ${animSafe(`${rayCycle}s`)} ease-in-out infinite`,
        }}
      />

      {/* ── Secondary ray cone (offset, slower) ── */}
      <div
        className="absolute -top-[36%] left-[46%] w-[150%] h-[120%]"
        style={{
          opacity: baseOpacity * 0.9,
          transform: "translateX(-50%) rotateX(24deg) rotateZ(-3deg)",
          transformOrigin: "50% 0%",
          background: `conic-gradient(
            from 158deg at 55% 0%,
            transparent 0deg,
            rgba(${tints.secondary},0.12) 18deg,
            transparent 44deg,
            transparent 92deg,
            rgba(${tints.primary},0.15) 112deg,
            transparent 134deg,
            transparent 198deg,
            rgba(${tints.secondary},0.10) 222deg,
            transparent 246deg,
            transparent 298deg,
            rgba(${tints.primary},0.09) 318deg,
            transparent 342deg
          )`,
          filter: "blur(68px)",
          animation: `loginRaysDriftSlow ${animSafe(`${rayCycleSlow}s`)} ease-in-out infinite`,
        }}
      />

      {/* ── Volumetric haze band ── */}
      <div
        className="absolute top-[2%] left-0 right-0 h-[46%]"
        style={{
          background: `linear-gradient(180deg, rgba(${tints.primary},0.12) 0%, rgba(${tints.secondary},0.05) 55%, transparent 100%)`,
          filter: "blur(82px)",
          opacity: baseOpacity * 0.9,
        }}
      />

      {/* ── Warm orb (right) ── */}
      <div
        className="absolute top-[8%] right-[10%] w-[34vw] h-[34vw] max-w-[440px] max-h-[440px] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(${tints.secondary},0.22) 0%, transparent 65%)`,
          filter: "blur(54px)",
          animation: `loginOrbFloat ${animSafe(`${orbCycle}s`)} ease-in-out infinite`,
        }}
      />

      {/* ── Cool orb (left) ── */}
      <div
        className="absolute top-[28%] left-[6%] w-[24vw] h-[24vw] max-w-[320px] max-h-[320px] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(${tints.primary},0.20) 0%, transparent 60%)`,
          filter: "blur(64px)",
          animation: `loginOrbFloatSlow ${animSafe(`${orbCycleSlow}s`)} ease-in-out infinite`,
        }}
      />

      {/* ── Masked dot grid (subtle depth cue, fades to edges) ── */}
      <div
        className="absolute inset-0 opacity-[0.12] text-stone-600"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0)",
          backgroundSize: "30px 30px",
          maskImage: "radial-gradient(ellipse 75% 60% at 50% 30%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 60% at 50% 30%, black 0%, transparent 75%)",
        }}
      />

      {/* ── Grain pass — kills banding on cheap displays ── */}
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(45,51,34,0.10) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
    </div>
  );
}
