"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { analyticsApi } from "@/lib/api/endpoints";
import {
  Activity, AlertTriangle, Camera, CheckCircle2,
  Clock, Eye, Shield, TrendingDown, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

// ── Design-system chart palette ───────────────────────────────────────────────
const CHART_SAGE    = "#67705E";  // sage-600
const CHART_PEACH   = "#D26B4A";  // peach-600
const CHART_BRONZE  = "#BD8658";  // bronze-500
const CHART_STONE   = "#A8A29E";  // stone-400

const VIOLATION_COLORS: Record<string, string> = {
  "Expired Registration":   CHART_SAGE,
  "Expired Insurance":      CHART_BRONZE,
  "No Pollution Certificate": CHART_PEACH,
  "Expired PUC":            CHART_PEACH,
  "Unregistered Vehicle":   CHART_STONE,
};

function violationColor(type: string, idx: number): string {
  if (VIOLATION_COLORS[type]) return VIOLATION_COLORS[type];
  const fallbacks = [CHART_SAGE, CHART_BRONZE, CHART_PEACH, CHART_STONE];
  return fallbacks[idx % fallbacks.length];
}

const Tip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; name: string; color: string; value: number }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-popover px-3.5 py-2.5 text-xs">
      {label && <p className="font-semibold text-stone-600 mb-1.5">{label}</p>}
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-stone-500">{p.name}</span>
          </div>
          <span className="font-semibold text-stone-800 tabular-nums ml-4">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function AnalyticsView() {
  const { data: timeline, isLoading: tlLoading } = useQuery({
    queryKey: ["analytics-timeline", 168],
    queryFn: () => analyticsApi.timeline(168).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: cameras, isLoading: camLoading } = useQuery({
    queryKey: ["analytics-cameras"],
    queryFn: () => analyticsApi.cameras().then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ["detection-stats"],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: violations } = useQuery({
    queryKey: ["analytics-violations"],
    queryFn: () => analyticsApi.violations().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const { data: aiPerf } = useQuery({
    queryKey: ["analytics-ai-performance"],
    queryFn: () => analyticsApi.aiPerformance().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const tlData = (Array.isArray(timeline) ? timeline : []).map((d: { hour: string; count: number; violations: number }) => ({
    time: format(parseISO(d.hour), "EEE HH:mm"),
    Detections: d.count,
    Violations: d.violations,
  }));

  const camData = (Array.isArray(cameras) ? cameras : []).map((c: { name?: string; camera_id: string; total_detections: number; error_count: number }) => ({
    name: c.name?.split(" ")[0] ?? c.camera_id,
    detections: c.total_detections,
    errors: c.error_count,
  })).sort((a, b) => b.detections - a.detections).slice(0, 8);

  const kpis = (stats as { kpis?: Record<string, number> } | undefined)?.kpis;

  const violationData = Array.isArray(violations) && violations.length > 0
    ? violations
    : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-screen-2xl mx-auto space-y-5">

        {/* Summary KPI cards — real data from /analytics/dashboard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Detection Rate", icon: CheckCircle2,
              value: kpis ? `${kpis.success_rate ?? 0}%` : "—",
              accent: "sage", trend: "up",
            },
            {
              label: "Avg AI Confidence", icon: Activity,
              value: kpis ? `${Math.round((kpis.avg_confidence ?? 0) * 100)}%` : "—",
              accent: "bronze", trend: "up",
            },
            {
              label: "Violations (24h)", icon: AlertTriangle,
              value: kpis ? String(kpis.violations_24h ?? 0) : "—",
              accent: "peach", trend: "down",
            },
            {
              label: "Active Cameras", icon: Camera,
              value: kpis ? String(kpis.active_cameras ?? 0) : "—",
              accent: "sage", trend: "up",
            },
          ].map(({ label, value, icon: Icon, accent, trend }, i) => {
            const palette = {
              sage:   { card: "bg-sage-50 border-sage-100",   num: "text-sage-800",   icon: "text-sage-600",   trendC: "text-sage-500" },
              bronze: { card: "bg-bronze-50 border-bronze-100", num: "text-bronze-800", icon: "text-bronze-600", trendC: "text-bronze-500" },
              peach:  { card: "bg-peach-50 border-peach-100",  num: "text-peach-800",  icon: "text-peach-600",  trendC: "text-peach-500" },
            }[accent as "sage" | "bronze" | "peach"];
            const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;
            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn("rounded-xl border p-4", palette.card)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-mono uppercase tracking-[0.12em] text-stone-500">{label}</span>
                  <Icon className={cn("h-3.5 w-3.5", palette.icon)} />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <p className={cn("font-display text-2xl font-semibold tabular-nums", palette.num)}>{value}</p>
                  <TrendIcon className={cn("h-4 w-4 mb-0.5 shrink-0", palette.trendC)} />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detection trend — 7 days */}
        <div className="surface-panel p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-eyebrow">Trend</p>
              <h3 className="font-display text-sm font-semibold text-foreground mt-0.5">
                7-Day Detection Trend
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">Hourly breakdown — detections vs violations</p>
            </div>
            <span className="text-2xs font-mono text-stone-400 bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-full">
              Last 168 hours
            </span>
          </div>
          {tlLoading ? (
            <div className="h-64 flex items-end gap-0.5 px-2">
              {Array.from({ length: 40 }, (_, i) => (
                <div key={i} className="skeleton flex-1 rounded-t"
                  style={{ height: `${15 + Math.sin(i / 3) * 40 + 30}%` }} />
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={tlData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="ga-sage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_SAGE} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={CHART_SAGE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ga-peach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_PEACH} stopOpacity={0.10} />
                    <stop offset="95%" stopColor={CHART_PEACH} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#A8A29E" }} tickLine={false} axisLine={false}
                  interval={Math.floor(tlData.length / 10)} />
                <YAxis tick={{ fontSize: 10, fill: "#A8A29E" }} tickLine={false} axisLine={false} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="Detections" stroke={CHART_SAGE} strokeWidth={2}
                  fill="url(#ga-sage)" dot={false} activeDot={{ r: 3, fill: CHART_SAGE }} />
                <Area type="monotone" dataKey="Violations" stroke={CHART_PEACH} strokeWidth={2}
                  fill="url(#ga-peach)" dot={false} activeDot={{ r: 3, fill: CHART_PEACH }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Camera performance + violation breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Camera detection bar chart */}
          <div className="surface-panel p-5 lg:col-span-2">
            <p className="section-eyebrow mb-0.5">Performance</p>
            <h3 className="font-display text-sm font-semibold text-foreground mb-1">Camera Performance</h3>
            <p className="text-xs text-stone-400 mb-5">Total detections per camera unit</p>
            {camLoading ? (
              <div className="h-52 flex items-end gap-2 px-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex-1 space-y-2">
                    <div className="skeleton rounded" style={{ height: `${40 + i * 15}%` }} />
                  </div>
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={camData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#A8A29E" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#A8A29E" }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="detections" name="Detections" fill={CHART_SAGE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Violation type donut — real DB data */}
          <div className="surface-panel p-5">
            <p className="section-eyebrow mb-0.5">Breakdown</p>
            <h3 className="font-display text-sm font-semibold text-foreground mb-1">Violation Types</h3>
            <p className="text-xs text-stone-400 mb-4">Distribution from live detections</p>
            {violationData ? (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={violationData}
                      dataKey="count"
                      nameKey="type"
                      cx="50%" cy="50%"
                      innerRadius={42} outerRadius={65}
                      paddingAngle={3}
                    >
                      {violationData.map((entry, idx) => (
                        <Cell key={entry.type} fill={violationColor(entry.type, idx)} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} detections`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {violationData.map((v, idx) => (
                    <div key={v.type} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: violationColor(v.type, idx) }} />
                        <span className="text-stone-600 truncate max-w-[130px]">{v.type}</span>
                      </div>
                      <span className="font-semibold text-stone-700 tabular-nums font-mono">{v.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="text-xs text-stone-400">No violations recorded yet</p>
                <p className="text-2xs text-stone-300 mt-1 font-mono">Run the pipeline to generate data</p>
              </div>
            )}
          </div>
        </div>

        {/* AI Performance metrics — real data from /analytics/ai-performance */}
        <div className="surface-panel p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="section-eyebrow">AI Metrics</p>
              <h3 className="font-display text-sm font-semibold text-foreground mt-0.5">
                AI Pipeline Performance
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                Derived from {aiPerf?.sample_size?.toLocaleString("en-IN") ?? "—"} processed detections
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Avg Processing",
                value: aiPerf?.avg_processing_ms != null ? `${aiPerf.avg_processing_ms}ms` : "—",
                sub: "per frame end-to-end",
                icon: Clock,
                good: aiPerf?.avg_processing_ms == null || aiPerf.avg_processing_ms < 500,
              },
              {
                label: "Vehicle Detection",
                value: aiPerf?.vehicle_detection_pct != null ? `${aiPerf.vehicle_detection_pct}%` : "—",
                sub: "avg vehicle confidence",
                icon: Shield,
                good: aiPerf?.vehicle_detection_pct == null || aiPerf.vehicle_detection_pct >= 60,
              },
              {
                label: "OCR Accuracy",
                value: aiPerf?.ocr_accuracy_pct != null ? `${aiPerf.ocr_accuracy_pct}%` : "—",
                sub: "avg OCR confidence",
                icon: Eye,
                good: aiPerf?.ocr_accuracy_pct == null || aiPerf.ocr_accuracy_pct >= 50,
              },
              {
                label: "Error Rate",
                value: aiPerf != null ? `${aiPerf.error_rate_pct}%` : "—",
                sub: "failed detections",
                icon: AlertTriangle,
                good: aiPerf?.error_rate_pct == null || aiPerf.error_rate_pct < 5,
              },
            ].map(({ label, value, sub, icon: Icon, good }) => (
              <div key={label} className={cn(
                "rounded-xl border p-4 text-center",
                good ? "bg-sage-50/60 border-sage-100" : "bg-peach-50/60 border-peach-100"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-3",
                  good ? "bg-sage-100 text-sage-700" : "bg-peach-100 text-peach-700"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className={cn(
                  "font-display text-2xl font-semibold tabular-nums",
                  good ? "text-sage-900" : "text-peach-800"
                )}>{value}</p>
                <p className="text-xs font-medium text-stone-600 mt-0.5">{label}</p>
                <p className="text-2xs text-stone-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          {aiPerf && aiPerf.sample_size === 0 && (
            <p className="text-center text-xs text-stone-400 mt-4 font-mono">
              No processed detections in database — run the live pipeline to populate metrics
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
