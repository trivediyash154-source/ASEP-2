"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertOctagon, Camera, Coins, Gauge, ShieldCheck } from "lucide-react";

import { Stat } from "@/components/ui/stat";
import { analyticsApi } from "@/lib/api/endpoints";
import type { DashboardSummary } from "@/lib/types";

export function KpiRow() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => analyticsApi.dashboard().then((r) => r.data),
    refetchInterval: 15_000,
    staleTime: 8_000,
  });

  const kpis = (data as DashboardSummary | undefined)?.kpis;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Stat
        label="ANPR scans · 24h"
        value={kpis?.total_scans_24h ?? 0}
        format="compact"
        loading={isLoading}
        tone="sage"
        icon={<Gauge />}
        hint="Across all active cameras"
      />
      <Stat
        label="Violations · 24h"
        value={kpis?.violations_24h ?? 0}
        format="compact"
        loading={isLoading}
        tone="peach"
        icon={<AlertOctagon />}
        hint={kpis ? `${kpis.success_rate.toFixed(1)}% compliant` : "—"}
      />
      <Stat
        label="Active cameras"
        value={kpis?.active_cameras ?? 0}
        format="raw"
        loading={isLoading}
        tone="bronze"
        icon={<Camera />}
        hint="Streaming and healthy"
      />
      <Stat
        label="Fines collected"
        value={kpis?.revenue_collected ?? 0}
        format="currency"
        loading={isLoading}
        tone="sage"
        icon={<Coins />}
        hint={
          kpis
            ? `₹${new Intl.NumberFormat("en-IN").format(kpis.revenue_pending)} pending`
            : "—"
        }
      />
    </div>
  );
}
