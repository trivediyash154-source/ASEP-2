"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, Camera, FileText, IndianRupee, MapPin, Radio,
  ShieldAlert, ShieldCheck, Cpu, Zap, TrendingUp,
} from "lucide-react";
import { KPICard } from "./KPICard";
import { DetectionTimeline } from "./DetectionTimeline";
import { LiveDetectionFeed } from "./LiveDetectionFeed";
import { SystemMetricsPanel } from "./SystemMetricsPanel";
import { analyticsApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/* ── Maharashtra district intelligence ───────────────────────────── */
const DISTRICTS = [
  { name: "Mumbai",      code: "MUM", cameras: 24, violations: 142, risk: "high",   active: true  },
  { name: "Pune",        code: "PUN", cameras: 18, violations: 89,  risk: "medium", active: true  },
  { name: "Thane",       code: "THA", cameras: 15, violations: 73,  risk: "medium", active: true  },
  { name: "Navi Mumbai", code: "NMU", cameras: 12, violations: 41,  risk: "low",    active: true  },
  { name: "Nashik",      code: "NSK", cameras: 9,  violations: 28,  risk: "low",    active: true  },
  { name: "Nagpur",      code: "NGP", cameras: 11, violations: 19,  risk: "clear",  active: false },
];

const RISK_CFG: Record<string, { label: string; dot: string; bar: string; cls: string }> = {
  critical: { label: "CRITICAL", dot: "bg-[hsl(0_60%_48%)]",   bar: "bg-[hsl(0_60%_48%)]",   cls: "threat-critical" },
  high:     { label: "HIGH",     dot: "bg-[hsl(17_70%_55%)]",  bar: "bg-[hsl(17_70%_55%)]",  cls: "threat-high"     },
  medium:   { label: "MEDIUM",   dot: "bg-[hsl(35_65%_48%)]",  bar: "bg-[hsl(35_65%_48%)]",  cls: "threat-medium"   },
  low:      { label: "LOW",      dot: "bg-[hsl(79_30%_46%)]",  bar: "bg-[hsl(79_30%_46%)]",  cls: "threat-low"      },
  clear:    { label: "CLEAR",    dot: "bg-[hsl(150_30%_42%)]", bar: "bg-[hsl(150_30%_42%)]", cls: "threat-clear"    },
};

/* ── Operational status banner ────────────────────────────────────── */
function OperationalBanner({ kpis, isLoading }: { kpis: any; isLoading: boolean }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const uptime = `${Math.floor(tick / 3600).toString().padStart(2, "0")}:${Math.floor((tick % 3600) / 60).toString().padStart(2, "0")}:${(tick % 60).toString().padStart(2, "0")}`;
  const successRate = kpis?.success_rate ?? 0;
  const overallThreat = successRate > 85 ? "LOW" : successRate > 70 ? "MEDIUM" : "HIGH";
  const threatColor = overallThreat === "LOW" ? "text-threat-low" : overallThreat === "MEDIUM" ? "text-threat-medium" : "text-threat-high";

  return (
    <div className={cn(
      "flex flex-wrap items-center justify-between gap-3 px-5 py-3",
      "bg-surface border border-border rounded-xl shadow-card",
      "text-2xs font-mono uppercase tracking-[0.12em]"
    )}>
      {/* Left: System identity */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-status-success opacity-60 animate-ping" />
            <span className="relative h-2 w-2 rounded-full bg-status-success" />
          </span>
          <span className="text-foreground font-semibold">VAAHAN AI · OPERATIONAL</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-foreground-subtle">
          <MapPin className="h-3 w-3" />
          <span>Maharashtra Enforcement Network</span>
        </div>
      </div>

      {/* Center: key metrics strip */}
      <div className="hidden lg:flex items-center gap-6 text-foreground-muted">
        <BannerStat label="THREAT" value={overallThreat} className={threatColor} />
        <BannerStat label="UPTIME" value={uptime} mono />
        <BannerStat label="AI ENGINE" value={isLoading ? "—" : `${kpis?.success_rate ?? 0}%`} />
        <BannerStat label="CAMERAS" value={isLoading ? "—" : String(kpis?.active_cameras ?? 0)} />
      </div>

      {/* Right: time */}
      <div className="flex items-center gap-3 text-foreground-subtle">
        <span className="text-foreground-subtle">MH · IST</span>
        <LiveBannerTime />
      </div>
    </div>
  );
}

function BannerStat({ label, value, mono, className }: { label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-foreground-subtle">{label}</span>
      <span className={cn("text-foreground font-semibold tabular-nums", className)}>{value}</span>
    </div>
  );
}

function LiveBannerTime() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    setT(new Date());
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-foreground font-semibold tabular-nums signal-live">
      {t ? t.toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--"}
    </span>
  );
}

/* ── Maharashtra Intelligence Map ──────────────────────────────────── */
function MaharashtraIntelMap() {
  const maxViol = Math.max(...DISTRICTS.map(d => d.violations));

  return (
    <div className="op-surface p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-eyebrow mb-0.5">Statewide Intelligence</p>
          <p className="text-sm font-semibold text-foreground">Maharashtra Command Map</p>
        </div>
        <div className="flex items-center gap-1.5 text-2xs font-mono text-foreground-subtle bg-muted px-2.5 py-1 rounded-md border border-border">
          <Radio className="h-3 w-3 text-status-success animate-pulse-soft" />
          <span className="uppercase tracking-[0.12em]">6 Districts · Live</span>
        </div>
      </div>

      {/* SVG Maharashtra schematic */}
      <div className="relative mb-4 rounded-lg overflow-hidden bg-stone-50 dark:bg-stone-900/40 border border-border aspect-[2/1]">
        <div className="tactical-grid" />
        <svg viewBox="0 0 400 200" className="w-full h-full" fill="none">
          {/* Rough Maharashtra state outline */}
          <path
            d="M60,40 L90,20 L130,25 L170,18 L210,30 L250,22 L280,35 L310,28 L340,45 L355,65 L345,90 L330,110 L320,130 L300,150 L270,165 L240,175 L210,168 L180,160 L155,150 L130,155 L100,148 L75,135 L55,115 L45,90 L50,65 Z"
            className="fill-sage-100/60 dark:fill-sage-900/30 stroke-sage-300 dark:stroke-sage-700"
            strokeWidth="1.5"
          />
          {/* District markers */}
          <DistrictMarker cx={165} cy={120} district={DISTRICTS[0]} maxViol={maxViol} /> {/* Mumbai */}
          <DistrictMarker cx={200} cy={135} district={DISTRICTS[1]} maxViol={maxViol} /> {/* Pune */}
          <DistrictMarker cx={180} cy={108} district={DISTRICTS[2]} maxViol={maxViol} /> {/* Thane */}
          <DistrictMarker cx={195} cy={118} district={DISTRICTS[3]} maxViol={maxViol} /> {/* Navi Mumbai */}
          <DistrictMarker cx={155} cy={72}  district={DISTRICTS[4]} maxViol={maxViol} /> {/* Nashik */}
          <DistrictMarker cx={295} cy={95}  district={DISTRICTS[5]} maxViol={maxViol} /> {/* Nagpur */}
        </svg>
      </div>

      {/* District list */}
      <div className="space-y-1.5">
        {DISTRICTS.map((d, i) => {
          const cfg = RISK_CFG[d.risk];
          const barPct = Math.round((d.violations / maxViol) * 100);
          return (
            <motion.div
              key={d.code}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", d.active ? cfg.dot : "bg-stone-300")} />
              <span className="font-mono text-2xs text-foreground-subtle w-8 shrink-0">{d.code}</span>
              <div className="flex-1 h-1 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct}%` }}
                  transition={{ delay: i * 0.06 + 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className={cn("h-full rounded-full", cfg.bar)}
                />
              </div>
              <span className="font-mono text-2xs text-foreground tabular-nums w-6 text-right shrink-0">
                {d.violations}
              </span>
              <span className={cn("font-mono text-2xs font-semibold w-14 shrink-0", cfg.cls)}>
                {cfg.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function DistrictMarker({ cx, cy, district, maxViol }: { cx: number; cy: number; district: typeof DISTRICTS[0]; maxViol: number }) {
  const cfg = RISK_CFG[district.risk];
  const r = 3 + (district.violations / maxViol) * 5;
  const colorMap: Record<string, string> = {
    critical: "#B95C5C", high: "#E58060", medium: "#C9925F", low: "#5C8A6E", clear: "#7C7970",
  };
  const color = colorMap[district.risk] ?? "#7C7970";

  return (
    <g>
      {district.active && (
        <>
          <circle cx={cx} cy={cy} r={r + 4} fill={color} opacity="0.12" style={{ animation: "radarPing 2.5s ease-out infinite" }} />
          <circle cx={cx} cy={cy} r={r + 2} fill={color} opacity="0.2" />
        </>
      )}
      <circle cx={cx} cy={cy} r={r} fill={color} opacity="0.85" />
      <text x={cx + r + 3} y={cy + 3} fontSize="8" fill="#6e6860" fontFamily="monospace">{district.code}</text>
    </g>
  );
}

/* ── Threat Intelligence Strip ─────────────────────────────────────── */
function ThreatIntelStrip({ kpis }: { kpis: any }) {
  const levels = [
    { level: "CRITICAL", count: 2,  cls: "threat-critical" },
    { level: "HIGH",     count: 8,  cls: "threat-high" },
    { level: "MEDIUM",   count: 23, cls: "threat-medium" },
    { level: "LOW",      count: 67, cls: "threat-low" },
    { level: "CLEAR",    count: kpis?.total_scans_24h ? Math.max(0, kpis.total_scans_24h - 100) : 0, cls: "threat-clear" },
  ];

  return (
    <div className="op-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-eyebrow mb-0.5">AI Classification</p>
          <p className="text-sm font-semibold text-foreground">Threat Intelligence</p>
        </div>
        <ShieldAlert className="h-4 w-4 text-foreground-subtle" />
      </div>

      <div className="space-y-2">
        {levels.map((l, i) => (
          <motion.div
            key={l.level}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: i * 0.08, origin: 0 }}
            className={cn("flex items-center justify-between rounded-lg border px-3 py-2", l.cls)}
          >
            <span className="font-mono text-2xs font-semibold tracking-[0.12em]">{l.level}</span>
            <span className="font-display text-sm font-bold tabular-nums">{l.count.toLocaleString()}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-2xs text-foreground-subtle font-mono">
        <span>VEHICLES CLASSIFIED</span>
        <span className="text-foreground font-semibold tabular-nums">{levels.reduce((a, l) => a + l.count, 0).toLocaleString()}</span>
      </div>
    </div>
  );
}

/* ── AI Pipeline Status ─────────────────────────────────────────────── */
function AIPipelineStatus({ kpis }: { kpis: any }) {
  const metrics = [
    { label: "YOLOv8n Detection", value: kpis?.success_rate ?? 0, unit: "%" },
    { label: "EasyOCR Read Rate", value: kpis?.avg_confidence != null ? Math.round(kpis.avg_confidence * 100) : 0, unit: "%" },
    { label: "Challan Generation", value: 94, unit: "%" },
    { label: "Evidence Archival", value: 100, unit: "%" },
  ];

  return (
    <div className="op-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-eyebrow mb-0.5">Backend Pipeline</p>
          <p className="text-sm font-semibold text-foreground">AI Engine Status</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu className="h-4 w-4 text-sage-600 dark:text-sage-400" />
          <span className="text-2xs font-mono text-sage-600 dark:text-sage-400 uppercase tracking-[0.12em]">Online</span>
        </div>
      </div>

      <div className="space-y-3">
        {metrics.map((m, i) => (
          <div key={m.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-foreground-muted">{m.label}</span>
              <span className="font-mono text-xs font-semibold text-foreground tabular-nums">{m.value}{m.unit}</span>
            </div>
            <div className="h-1 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${m.value}%` }}
                transition={{ delay: i * 0.1 + 0.4, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "h-full rounded-full",
                  m.value >= 90 ? "bg-sage-500" : m.value >= 70 ? "bg-bronze-400" : "bg-peach-500"
                )}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3">
        <div>
          <p className="data-label mb-1">Avg Latency</p>
          <p className="font-mono text-sm font-bold text-foreground tabular-nums">42ms</p>
        </div>
        <div>
          <p className="data-label mb-1">GPU Temp</p>
          <p className="font-mono text-sm font-bold text-bronze-700 dark:text-bronze-400 tabular-nums">68°C</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main Dashboard View ────────────────────────────────────────────── */
export function DashboardView() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const kpis = summary?.kpis;

  const kpiCards = [
    {
      title: "AI Scans · 24h",
      value: isLoading ? "—" : (kpis?.total_scans_24h?.toLocaleString() ?? "0"),
      subtitle: "frames processed by pipeline",
      icon: Activity, variant: "sage" as const,
      trend: { value: 12, label: "vs yesterday" }, delay: 0, live: true,
    },
    {
      title: "Violations Detected",
      value: isLoading ? "—" : (kpis?.violations_24h?.toLocaleString() ?? "0"),
      subtitle: "expired / invalid documents",
      icon: ShieldAlert, variant: "peach" as const,
      trend: { value: -4, label: "vs yesterday" }, delay: 0.06,
    },
    {
      title: "Detection Rate",
      value: isLoading ? "—" : (kpis?.success_rate != null ? `${kpis.success_rate}%` : "—"),
      subtitle: "successful plate reads",
      icon: ShieldCheck, variant: "sage" as const,
      delay: 0.12,
    },
    {
      title: "Active Cameras",
      value: isLoading ? "—" : (kpis?.active_cameras ?? "0"),
      subtitle: "streaming live right now",
      icon: Camera, variant: "stone" as const,
      delay: 0.18, live: true,
    },
    {
      title: "Pending Challans",
      value: isLoading ? "—" : (kpis?.pending_challans?.toLocaleString() ?? "0"),
      subtitle: "awaiting payment",
      icon: FileText, variant: "warning" as const,
      delay: 0.24,
    },
    {
      title: "Revenue Collected",
      value: isLoading ? "—" : (kpis?.revenue_collected != null
        ? `₹${(kpis.revenue_collected / 1000).toFixed(0)}K` : "—"),
      subtitle: "fines collected this month",
      icon: IndianRupee, variant: "bronze" as const,
      delay: 0.30,
    },
    {
      title: "Revenue Pending",
      value: isLoading ? "—" : (kpis?.revenue_pending != null
        ? `₹${(kpis.revenue_pending / 1000).toFixed(0)}K` : "—"),
      subtitle: "outstanding enforcement",
      icon: TrendingUp, variant: "warning" as const,
      delay: 0.36,
    },
    {
      title: "AI Confidence",
      value: isLoading ? "—" : (kpis?.avg_confidence != null
        ? `${Math.round(kpis.avg_confidence * 100)}%` : "—"),
      subtitle: "average detection score",
      icon: Zap, variant: "sage" as const,
      delay: 0.42,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-screen-2xl mx-auto space-y-5">

        {/* Operational status banner */}
        <OperationalBanner kpis={kpis} isLoading={isLoading} />

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <KPICard key={card.title} {...card} loading={isLoading} />
          ))}
        </div>

        {/* Primary detection intelligence */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <DetectionTimeline />
          </div>
          <div className="xl:col-span-1">
            <LiveDetectionFeed />
          </div>
        </div>

        {/* Intelligence layer: map + threat intel + AI pipeline */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <MaharashtraIntelMap />
          </div>
          <div className="lg:col-span-1">
            <ThreatIntelStrip kpis={kpis} />
          </div>
          <div className="lg:col-span-1">
            <AIPipelineStatus kpis={kpis} />
          </div>
        </div>

        {/* System health */}
        <SystemMetricsPanel />
      </div>
    </div>
  );
}
