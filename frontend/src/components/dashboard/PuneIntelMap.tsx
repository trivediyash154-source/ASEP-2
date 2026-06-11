"use client";

import { Radio } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Pune Regional Surveillance Network — curated zone intelligence for the
 * pilot deployment. Twelve enforcement zones along the city's real road
 * corridors: the Mumbai–Pune expressway approach through PCMC, the
 * Hinjewadi IT corridor, Karve Road, Nagar Road and Satara Road.
 */
export interface PuneZone {
  name: string;
  code: string;
  corridor: string;
  cameras: number;
  violations: number;
  risk: "critical" | "high" | "medium" | "low" | "clear";
  active: boolean;
  cx: number;
  cy: number;
}

export const PUNE_ZONES: PuneZone[] = [
  { name: "Hinjewadi",        code: "HJW", corridor: "IT Park Ph 1–3",      cameras: 3, violations: 48, risk: "high",   active: true,  cx: 52,  cy: 108 },
  { name: "Pimpri-Chinchwad", code: "PCM", corridor: "Old Mumbai Hwy",      cameras: 3, violations: 42, risk: "high",   active: true,  cx: 118, cy: 52  },
  { name: "Shivajinagar",     code: "SHN", corridor: "JM Rd · Univ Circle", cameras: 3, violations: 36, risk: "high",   active: true,  cx: 188, cy: 122 },
  { name: "Wakad",            code: "WKD", corridor: "Expressway exit",     cameras: 2, violations: 31, risk: "medium", active: true,  cx: 92,  cy: 90  },
  { name: "Kharadi",          code: "KHD", corridor: "Nagar Rd bypass",     cameras: 2, violations: 29, risk: "medium", active: true,  cx: 292, cy: 116 },
  { name: "Koregaon Park",    code: "KP",  corridor: "North Main Rd",       cameras: 2, violations: 26, risk: "medium", active: true,  cx: 238, cy: 112 },
  { name: "Baner",            code: "BNR", corridor: "Baner Rd",            cameras: 2, violations: 22, risk: "medium", active: true,  cx: 116, cy: 112 },
  { name: "Kothrud",          code: "KTR", corridor: "Paud Rd",             cameras: 2, violations: 18, risk: "low",    active: true,  cx: 140, cy: 152 },
  { name: "Camp",             code: "CMP", corridor: "MG Rd",               cameras: 2, violations: 15, risk: "low",    active: true,  cx: 218, cy: 148 },
  { name: "Karve Nagar",      code: "KRV", corridor: "Karve Rd",            cameras: 1, violations: 12, risk: "low",    active: true,  cx: 156, cy: 172 },
  { name: "Katraj",           code: "KTJ", corridor: "Satara Rd · NH-48",   cameras: 1, violations: 11, risk: "low",    active: true,  cx: 192, cy: 222 },
  { name: "Bibwewadi",        code: "BBW", corridor: "Satara Rd",           cameras: 1, violations: 9,  risk: "clear",  active: false, cx: 212, cy: 188 },
];

export const PUNE_TOTALS = {
  zones: PUNE_ZONES.length,
  cameras: PUNE_ZONES.reduce((a, z) => a + z.cameras, 0),
  violations: PUNE_ZONES.reduce((a, z) => a + z.violations, 0),
};

const RISK_CFG: Record<string, { label: string; dot: string; bar: string; cls: string; marker: string }> = {
  critical: { label: "CRITICAL", dot: "bg-[hsl(0_60%_48%)]",   bar: "bg-[hsl(0_60%_48%)]",   cls: "text-threat-critical", marker: "#B95C5C" },
  high:     { label: "HIGH",     dot: "bg-[hsl(17_70%_55%)]",  bar: "bg-[hsl(17_70%_55%)]",  cls: "text-threat-high",     marker: "#E58060" },
  medium:   { label: "MEDIUM",   dot: "bg-[hsl(35_65%_48%)]",  bar: "bg-[hsl(35_65%_48%)]",  cls: "text-threat-medium",   marker: "#C9925F" },
  low:      { label: "LOW",      dot: "bg-[hsl(79_30%_46%)]",  bar: "bg-[hsl(79_30%_46%)]",  cls: "text-threat-low",      marker: "#5C8A6E" },
  clear:    { label: "CLEAR",    dot: "bg-[hsl(150_30%_42%)]", bar: "bg-[hsl(150_30%_42%)]", cls: "text-threat-clear",    marker: "#7C7970" },
};

/* Road corridors — stylized but geographically honest */
const CORRIDORS: Array<{ d: string; label?: string }> = [
  // Mumbai–Pune Expressway → PCMC → University → Shivajinagar
  { d: "M8,28 L70,40 L118,52 L152,86 L188,122" },
  // Hinjewadi IT corridor → Wakad → Baner → Shivajinagar
  { d: "M52,108 L92,90 L116,112 L188,122" },
  // Karve Road: Shivajinagar → Kothrud → Karve Nagar
  { d: "M188,122 L140,152 L156,172" },
  // Nagar Road: Shivajinagar → Koregaon Park → Kharadi
  { d: "M188,122 L238,112 L292,116 L340,108" },
  // Satara Road: Camp → Bibwewadi → Katraj → NH-48 south
  { d: "M218,148 L212,188 L192,222 L184,250" },
  // City spine: Shivajinagar → Camp
  { d: "M188,122 L218,148" },
];

export function PuneIntelMap({ embedded = false }: { embedded?: boolean }) {
  const maxViol = Math.max(...PUNE_ZONES.map((z) => z.violations));

  if (embedded) {
    return <MapBody maxViol={maxViol} className="flex-1 flex flex-col min-h-0" />;
  }

  return (
    <section className="op-surface h-full flex flex-col">
      <header className="ops-header">
        <span className="ops-title">Pune Surveillance Network</span>
        <span className="ops-meta flex items-center gap-1.5">
          <Radio className="h-3 w-3 text-status-success animate-pulse-soft" />
          {PUNE_TOTALS.zones} zones · live
        </span>
      </header>
      <MapBody maxViol={maxViol} className="p-4 flex-1 flex flex-col" />
    </section>
  );
}

function MapBody({ maxViol, className }: { maxViol: number; className?: string }) {
  // Rank zones by violation load for the readout list
  const ranked = [...PUNE_ZONES].sort((a, b) => b.violations - a.violations).slice(0, 8);

  return (
    <div className={className}>
      {/* Schematic city map */}
      <div className="relative mb-3 rounded-lg overflow-hidden bg-stone-50 dark:bg-stone-900/40 border border-border aspect-[10/7]">
        <div className="tactical-grid" />
        <svg viewBox="0 0 360 260" className="w-full h-full" fill="none">
          {/* City boundary — stylized Pune municipal limits */}
          <path
            d="M60,60 L100,34 L150,42 L205,30 L255,48 L305,62 L330,92 L325,130 L305,165 L275,195 L240,225 L205,245 L170,240 L140,215 L110,195 L80,165 L58,130 L50,95 Z"
            className="fill-sage-100/50 dark:fill-sage-900/25 stroke-sage-300 dark:stroke-sage-700"
            strokeWidth="1.5"
          />
          {/* Mula–Mutha river hint */}
          <path
            d="M70,80 Q140,108 188,118 Q240,128 320,100"
            className="stroke-sage-400/30 dark:stroke-sage-600/30"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Road corridors */}
          {CORRIDORS.map((c, i) => (
            <path
              key={i}
              d={c.d}
              className="stroke-bronze-400/50 dark:stroke-bronze-500/40"
              strokeWidth="1.6"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          ))}
          {/* Zone markers */}
          {PUNE_ZONES.map((z) => (
            <ZoneMarker key={z.code} zone={z} maxViol={maxViol} />
          ))}
          {/* Corridor labels */}
          <text x={14} y={22} fontSize="7" fill="#8a8378" fontFamily="monospace">MUM–PUNE EXPY</text>
          <text x={300} y={100} fontSize="7" fill="#8a8378" fontFamily="monospace">NAGAR RD</text>
          <text x={166} y={252} fontSize="7" fill="#8a8378" fontFamily="monospace">NH-48 · SATARA RD</text>
        </svg>
      </div>

      {/* Zone ranking */}
      <div className="space-y-1.5">
        {ranked.map((z, i) => {
          const cfg = RISK_CFG[z.risk];
          const barPct = Math.round((z.violations / maxViol) * 100);
          return (
            <motion.div
              key={z.code}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2.5"
              title={`${z.name} · ${z.corridor} · ${z.cameras} cameras`}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", z.active ? cfg.dot : "bg-stone-300 dark:bg-stone-600")} />
              <span className="font-mono text-2xs text-foreground-subtle w-8 shrink-0">{z.code}</span>
              <span className="text-2xs text-foreground-muted w-24 shrink-0 truncate hidden sm:block">{z.name}</span>
              <div className="flex-1 h-1 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct}%` }}
                  transition={{ delay: i * 0.05 + 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className={cn("h-full rounded-full", cfg.bar)}
                />
              </div>
              <span className="font-mono text-2xs text-foreground tabular-nums w-6 text-right shrink-0">
                {z.violations}
              </span>
              <span className={cn("font-mono text-2xs font-semibold w-14 shrink-0", cfg.cls)}>
                {cfg.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-2.5 pt-2 border-t border-border/60 font-mono text-2xs text-foreground-subtle uppercase tracking-[0.12em] flex items-center justify-between">
        <span>Pilot deployment · PMC + PCMC limits</span>
        <span className="tabular-nums">{PUNE_TOTALS.cameras} cams</span>
      </p>
    </div>
  );
}

function ZoneMarker({ zone, maxViol }: { zone: PuneZone; maxViol: number }) {
  const r = 3 + (zone.violations / maxViol) * 5;
  const color = RISK_CFG[zone.risk]?.marker ?? "#7C7970";

  return (
    <g>
      {zone.active && (
        <>
          <circle cx={zone.cx} cy={zone.cy} r={r + 4} fill={color} opacity="0.12" style={{ animation: "radarPing 2.5s ease-out infinite" }} />
          <circle cx={zone.cx} cy={zone.cy} r={r + 2} fill={color} opacity="0.2" />
        </>
      )}
      <circle cx={zone.cx} cy={zone.cy} r={r} fill={color} opacity="0.85" />
      <text x={zone.cx + r + 3} y={zone.cy + 3} fontSize="7.5" fill="#8a8378" fontFamily="monospace">{zone.code}</text>
    </g>
  );
}
