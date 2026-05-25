"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { analyticsApi } from "@/lib/api/endpoints";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface BucketRow {
  hour: string;
  total: number;
  violations: number;
}

function formatHour(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function DetectionTrendChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "timeline", 24],
    queryFn: () => analyticsApi.timeline(24).then((r) => r.data as BucketRow[]),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const rows = (data ?? []).map((r) => ({
    ...r,
    label: formatHour(r.hour),
    compliant: Math.max(0, r.total - r.violations),
  }));

  const totals = rows.reduce(
    (acc, r) => ({ scans: acc.scans + r.total, violations: acc.violations + r.violations }),
    { scans: 0, violations: 0 }
  );

  return (
    <section className="surface-panel">
      <header className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 border-b border-border">
        <div>
          <p className="section-eyebrow">Last 24 hours</p>
          <h3 className="font-display text-base font-semibold text-foreground tracking-tight mt-0.5">
            Detection volume
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant="sage" withDot>
            Compliant · {totals.scans.toLocaleString("en-IN")}
          </Badge>
          <Badge variant="peach" withDot>
            Violations · {totals.violations.toLocaleString("en-IN")}
          </Badge>
        </div>
      </header>

      <div className="px-2 sm:px-3 py-4">
        {isLoading ? (
          <Skeleton className="h-56 mx-3" />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 6, right: 16, bottom: 4, left: 4 }}>
                <defs>
                  <linearGradient id="grad-compliant" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7F8876" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#7F8876" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-violation" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ED9F7E" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#ED9F7E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  cursor={{ stroke: "#A9B394", strokeDasharray: "3 3" }}
                  formatter={(v: number, name: string) => [
                    v.toLocaleString("en-IN"),
                    name === "compliant" ? "Compliant" : "Violations",
                  ]}
                  labelFormatter={(label: string) => `Hour ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="compliant"
                  stackId="1"
                  stroke="#67705E"
                  strokeWidth={1.6}
                  fill="url(#grad-compliant)"
                />
                <Area
                  type="monotone"
                  dataKey="violations"
                  stackId="1"
                  stroke="#D26B4A"
                  strokeWidth={1.6}
                  fill="url(#grad-violation)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
