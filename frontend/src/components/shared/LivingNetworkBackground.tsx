"use client";

import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Living network background — the Pune corridor grid, operating.
 *
 * Not decoration: every element maps to the real system. Roads are the
 * pilot corridors (expressway approach, Hinjewadi belt, Nagar Rd, Karve
 * Rd, Satara Rd). Moving points are vehicles transiting; sage points are
 * compliant passes, the rare peach point is a flagged vehicle. Pulsing
 * nodes are camera junctions reporting. Everything runs slow and quiet —
 * infrastructure rhythm, not animation.
 *
 * Pure SVG + SMIL/CSS, zero JS per frame. Honors prefers-reduced-motion
 * by rendering the static network.
 */

interface Corridor {
  d: string;
  dots: Array<{ dur: number; delay: number; violation?: boolean; reverse?: boolean }>;
}

const CORRIDORS: Corridor[] = [
  // Mumbai–Pune Expressway → PCMC → University → Shivajinagar
  {
    d: "M -60,140 C 160,170 300,230 420,330 C 480,380 560,405 640,420",
    dots: [
      { dur: 26, delay: 0 },
      { dur: 32, delay: 9 },
      { dur: 24, delay: 17, violation: true },
    ],
  },
  // Hinjewadi IT corridor → Wakad → Baner → Shivajinagar
  {
    d: "M -50,500 C 140,470 320,455 470,440 C 540,433 600,426 640,420",
    dots: [
      { dur: 28, delay: 4 },
      { dur: 22, delay: 13, reverse: true },
    ],
  },
  // Nagar Road: Shivajinagar → Koregaon Park → Kharadi →
  {
    d: "M 640,420 C 790,398 930,378 1090,350 C 1150,340 1220,330 1280,322",
    dots: [
      { dur: 30, delay: 2 },
      { dur: 25, delay: 12, reverse: true },
      { dur: 34, delay: 21 },
    ],
  },
  // Karve Road: Shivajinagar → Kothrud → Karve Nagar →
  {
    d: "M 640,420 C 520,465 420,500 300,540 C 220,565 130,590 40,615",
    dots: [
      { dur: 27, delay: 6, reverse: true },
      { dur: 33, delay: 16 },
    ],
  },
  // Satara Road: Camp → Bibwewadi → Katraj → NH-48
  {
    d: "M 665,455 C 670,540 655,640 620,720 C 600,765 580,810 560,860",
    dots: [
      { dur: 24, delay: 3 },
      { dur: 29, delay: 14, violation: true, reverse: true },
    ],
  },
  // City spine NE toward Alandi Rd
  {
    d: "M 640,420 C 720,310 800,230 920,130 C 960,95 1010,60 1060,20",
    dots: [{ dur: 31, delay: 8 }],
  },
];

/* Camera junctions — match the corridor geometry */
const NODES: Array<{ x: number; y: number; delay: number; flash?: boolean }> = [
  { x: 320, y: 255, delay: 0.4 },              // PCMC
  { x: 300, y: 458, delay: 2.1 },              // Wakad
  { x: 120, y: 488, delay: 3.4, flash: true }, // Hinjewadi
  { x: 470, y: 440, delay: 1.2 },              // Baner
  { x: 640, y: 420, delay: 0.0, flash: true }, // Shivajinagar
  { x: 800, y: 396, delay: 2.8 },              // Koregaon Park
  { x: 1010, y: 364, delay: 4.2 },             // Kharadi
  { x: 665, y: 455, delay: 1.7 },              // Camp
  { x: 470, y: 482, delay: 3.0 },              // Kothrud
  { x: 360, y: 522, delay: 4.8 },              // Karve Nagar
  { x: 655, y: 580, delay: 2.4, flash: true }, // Bibwewadi
  { x: 622, y: 716, delay: 0.9 },              // Katraj
];

export function LivingNetworkBackground({
  className,
  opacity = 0.5,
}: {
  className?: string;
  opacity?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ opacity }}
    >
      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        fill="none"
      >
        {/* Faint survey grid */}
        <g stroke="rgba(127,136,118,0.10)" strokeWidth="1">
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`v${i}`} x1={i * 120} y1={0} x2={i * 120} y2={800} />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * 115} x2={1200} y2={i * 115} />
          ))}
        </g>

        {/* River hint */}
        <path
          d="M 80,300 C 320,360 520,400 700,395 C 880,390 1040,340 1240,270"
          stroke="rgba(127,136,118,0.14)"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Corridors */}
        {CORRIDORS.map((c, i) => (
          <path
            key={`c${i}`}
            d={c.d}
            stroke="rgba(127,136,118,0.30)"
            strokeWidth="1.4"
            strokeDasharray="1 7"
            strokeLinecap="round"
          />
        ))}

        {/* Transit signals — vehicles moving along corridors */}
        {!reduced &&
          CORRIDORS.map((c, ci) =>
            c.dots.map((dot, di) => (
              <circle
                key={`d${ci}-${di}`}
                r={dot.violation ? 2.6 : 2}
                fill={dot.violation ? "rgba(229,128,96,0.9)" : "rgba(127,136,118,0.85)"}
              >
                <animateMotion
                  dur={`${dot.dur}s`}
                  begin={`${dot.delay}s`}
                  repeatCount="indefinite"
                  path={c.d}
                  keyPoints={dot.reverse ? "1;0" : "0;1"}
                  keyTimes="0;1"
                />
              </circle>
            ))
          )}

        {/* Camera junctions */}
        {NODES.map((n, i) => (
          <g key={`n${i}`}>
            {!reduced && (
              <circle
                cx={n.x}
                cy={n.y}
                r={11}
                fill="rgba(127,136,118,0.20)"
                style={{
                  animation: `radarPing ${n.flash ? 5 : 7}s ease-out infinite`,
                  animationDelay: `${n.delay}s`,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }}
              />
            )}
            <circle cx={n.x} cy={n.y} r={2.6} fill="rgba(127,136,118,0.75)" />
            <circle cx={n.x} cy={n.y} r={5.5} stroke="rgba(127,136,118,0.38)" strokeWidth="1" />
          </g>
        ))}

        {/* Detection events — occasional evidence capture flashes */}
        {!reduced &&
          NODES.filter((n) => n.flash).map((n, i) => (
            <circle
              key={`f${i}`}
              cx={n.x}
              cy={n.y}
              r={16}
              stroke="rgba(229,128,96,0.5)"
              strokeWidth="1.5"
              fill="none"
              style={{
                animation: "radarPing 9s ease-out infinite",
                animationDelay: `${2.5 + i * 3.1}s`,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            />
          ))}
      </svg>
    </div>
  );
}
