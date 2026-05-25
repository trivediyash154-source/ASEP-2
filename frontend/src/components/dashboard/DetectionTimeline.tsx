"use client";

import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api/endpoints";
import { format, parseISO } from "date-fns";
import { Activity } from "lucide-react";

/* Brand palette tokens — keep in sync with tailwind.config */
const SAGE_500    = "#7F8876";
const PEACH_500   = "#E58060";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-xl shadow-popover px-4 py-3 text-xs">
      <p className="font-mono font-semibold text-foreground mb-2 uppercase tracking-[0.1em]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-foreground-subtle">{p.name}</span>
          </div>
          <span className="font-display font-semibold text-foreground tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export function DetectionTimeline() {
  const { data, isLoading } = useQuery({
    queryKey: ["detection-timeline"],
    queryFn: () => analyticsApi.timeline(24).then((r) => r.data),
    refetchInterval: 60_000,
  });

  const chartData = (Array.isArray(data) ? data : []).map((item: any) => ({
    hour: format(parseISO(item.hour), "HH:mm"),
    Detections: item.count,
    Violations: item.violations,
  }));

  return (
    <div className="op-surface p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="section-eyebrow mb-0.5">Temporal Intelligence</p>
          <p className="text-sm font-semibold text-foreground">Detection Timeline · 24h</p>
        </div>
        <div className="flex items-center gap-1.5 bg-sage-50 dark:bg-sage-900/30 border border-sage-200 dark:border-sage-700/40 rounded-full px-3 py-1">
          <Activity className="h-3 w-3 text-sage-600 dark:text-sage-400 animate-pulse-soft" />
          <span className="text-2xs font-semibold text-sage-700 dark:text-sage-300 uppercase tracking-[0.1em]">Realtime</span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-56 flex items-end gap-1 px-2">
          {Array.from({ length: 18 }, (_, i) => (
            <div
              key={i}
              className="skeleton flex-1 rounded-t"
              style={{ height: `${20 + Math.sin(i) * 40 + 30}%` }}
            />
          ))}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gDetections" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={SAGE_500}  stopOpacity={0.18} />
                <stop offset="95%" stopColor={SAGE_500}  stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gViolations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={PEACH_500} stopOpacity={0.14} />
                <stop offset="95%" stopColor={PEACH_500} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
            <Area
              type="monotone" dataKey="Detections"
              stroke={SAGE_500} strokeWidth={2}
              fill="url(#gDetections)" dot={false} activeDot={{ r: 4, fill: SAGE_500 }}
            />
            <Area
              type="monotone" dataKey="Violations"
              stroke={PEACH_500} strokeWidth={2}
              fill="url(#gViolations)" dot={false} activeDot={{ r: 4, fill: PEACH_500 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
