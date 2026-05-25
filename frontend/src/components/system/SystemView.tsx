"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity, Camera, CheckCircle2, Cpu, Database, HardDrive,
  MemoryStick, RefreshCw, Server, Shield, Thermometer, Wifi, WifiOff, XCircle, Zap,
} from "lucide-react";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { healthApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

interface Metrics {
  cpu: number;
  memory: number;
  memory_used_gb: number;
  memory_total_gb: number;
  disk: number;
  disk_used_gb: number;
  disk_total_gb: number;
  active_connections: number;
  active_cameras: number;
  pipeline_status: Record<string, { running: boolean; fps: number; frames: number; errors: number }>;
  gpu: { available: boolean; name?: string; usage_percent?: number; memory_used_gb?: number; memory_total_gb?: number; temperature_c?: number };
}

const isMetrics = (d: unknown): d is Metrics & { type: string } =>
  !!d && typeof d === "object" && (d as Record<string, unknown>)["type"] === "system_metrics";

function getLevel(value: number): "ok" | "warn" | "danger" {
  return value > 85 ? "danger" : value > 65 ? "warn" : "ok";
}

function Bar({ label, value, sub, icon: Icon, level }: {
  label: string; value: number; sub?: string;
  icon: typeof Cpu; level: "ok" | "warn" | "danger";
}) {
  const barColor = { ok: "bg-sage-500", warn: "bg-bronze-400", danger: "bg-peach-500" }[level];
  const textColor = { ok: "text-sage-700", warn: "text-bronze-600", danger: "text-peach-700" }[level];

  return (
    <div className="surface-panel p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-stone-400" />
          <span className="text-sm font-semibold text-stone-700">{label}</span>
        </div>
        <span className={cn("text-sm font-bold tabular-nums font-mono", textColor)}>
          {value.toFixed(1)}%
        </span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden mb-2">
        <motion.div
          className={cn("h-full rounded-full", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 18 }}
        />
      </div>
      {sub && <p className="text-xs text-stone-400 tabular-nums font-mono">{sub}</p>}
    </div>
  );
}

function ServiceChip({
  name, ok, icon: Icon, detail,
}: { name: string; ok: boolean; icon: typeof Server; detail?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      ok ? "bg-sage-50 border-sage-100" : "bg-peach-50 border-peach-100"
    )}>
      <div className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
        ok ? "bg-sage-100" : "bg-peach-100"
      )}>
        <Icon className={cn("h-3.5 w-3.5", ok ? "text-sage-700" : "text-peach-700")} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-stone-700">{name}</p>
        <p className={cn("text-2xs font-medium font-mono", ok ? "text-sage-600" : "text-peach-600")}>
          {ok ? "Healthy" : "Degraded"}
          {detail && <span className="text-stone-400 ml-1">· {detail}</span>}
        </p>
      </div>
      {ok
        ? <CheckCircle2 className="h-3.5 w-3.5 text-sage-500 shrink-0 ml-auto" />
        : <XCircle className="h-3.5 w-3.5 text-peach-500 shrink-0 ml-auto" />
      }
    </div>
  );
}

export function SystemView() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  const onMessage = useCallback((d: unknown) => {
    if (!isMetrics(d)) return;
    const { type: _, ...rest } = d;
    setMetrics(rest as Metrics);
    setUpdated(new Date());
  }, []);

  const { status } = useWebSocket("/ws/metrics", { onMessage, autoReconnect: true });
  const isLive = status === "connected";

  const { data: health } = useQuery({
    queryKey: ["system-health"],
    queryFn: healthApi.check,
    refetchInterval: 15_000,
    retry: false,
  });

  const pipelines = metrics ? Object.entries(metrics.pipeline_status) : [];
  const activePipelines = pipelines.filter(([, p]) => p.running);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-screen-xl mx-auto space-y-5">

        {/* Header */}
        <header className="surface-panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-eyebrow">Infrastructure</p>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground mt-0.5">
                System Health Monitor
              </h2>
            </div>
            <div className={cn(
              "flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border",
              isLive
                ? "bg-sage-50 border-sage-200 text-sage-700"
                : "bg-bronze-50 border-bronze-200 text-bronze-700"
            )}>
              {isLive
                ? <><Wifi className="h-3 w-3" /> Live metrics</>
                : <><WifiOff className="h-3 w-3" /> Reconnecting…</>
              }
              {updated && isLive && (
                <span className="text-stone-400 ml-1">
                  · {updated.toLocaleTimeString("en-IN", { hour12: false })}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Resource bars */}
        {metrics ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Bar label="CPU Utilization" value={metrics.cpu}
                sub={`${metrics.cpu.toFixed(1)}% across ${(metrics as unknown as { cpu_cores?: number }).cpu_cores ?? "—"} cores`}
                icon={Cpu} level={getLevel(metrics.cpu)} />
              <Bar label="Memory (RAM)" value={metrics.memory}
                sub={`${metrics.memory_used_gb.toFixed(2)} / ${metrics.memory_total_gb.toFixed(2)} GB`}
                icon={MemoryStick} level={getLevel(metrics.memory)} />
              <Bar label="Disk Usage" value={metrics.disk}
                sub={`${metrics.disk_used_gb.toFixed(1)} / ${metrics.disk_total_gb.toFixed(1)} GB`}
                icon={HardDrive} level={getLevel(metrics.disk)} />
            </div>

            {/* GPU section */}
            {metrics.gpu.available && (
              <div className="surface-panel p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-bronze-500" />
                  <p className="font-display text-sm font-semibold text-foreground">GPU — {metrics.gpu.name}</p>
                  {metrics.gpu.temperature_c != null && (
                    <div className={cn(
                      "ml-auto flex items-center gap-1 text-xs font-mono",
                      metrics.gpu.temperature_c > 80 ? "text-peach-600" : "text-stone-400"
                    )}>
                      <Thermometer className="h-3.5 w-3.5" />
                      {metrics.gpu.temperature_c}°C
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Bar label="GPU Core" value={metrics.gpu.usage_percent ?? 0}
                    sub={`${metrics.gpu.usage_percent ?? 0}% utilization`}
                    icon={Activity} level={getLevel(metrics.gpu.usage_percent ?? 0)} />
                  <Bar
                    label="GPU Memory (VRAM)"
                    value={((metrics.gpu.memory_used_gb ?? 0) / Math.max(metrics.gpu.memory_total_gb ?? 1, 0.001)) * 100}
                    sub={`${(metrics.gpu.memory_used_gb ?? 0).toFixed(2)} / ${(metrics.gpu.memory_total_gb ?? 0).toFixed(2)} GB`}
                    icon={MemoryStick}
                    level={getLevel(((metrics.gpu.memory_used_gb ?? 0) / Math.max(metrics.gpu.memory_total_gb ?? 1, 0.001)) * 100)}
                  />
                </div>
              </div>
            )}

            {/* Service health — real data from /health endpoint */}
            <div className="surface-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="section-eyebrow">Services</p>
                  <h3 className="font-display text-sm font-semibold text-foreground mt-0.5">Service Health</h3>
                </div>
                {health && (
                  <span className={cn(
                    "text-2xs font-mono font-semibold px-2 py-1 rounded-full border uppercase tracking-wider",
                    health.status === "healthy"
                      ? "bg-sage-50 border-sage-200 text-sage-700"
                      : "bg-peach-50 border-peach-200 text-peach-700"
                  )}>
                    {health.status}
                    {health.version && <span className="text-stone-400 ml-1">v{health.version}</span>}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ServiceChip
                  name="API Backend"
                  ok={!!health}
                  icon={Server}
                  detail={health ? "responding" : "unreachable"}
                />
                <ServiceChip
                  name="WebSocket"
                  ok={isLive}
                  icon={Wifi}
                  detail={isLive ? "streaming" : "offline"}
                />
                <ServiceChip
                  name="Database"
                  ok={health?.services.database === "ok"}
                  icon={Database}
                  detail={health?.services.database ?? "unknown"}
                />
                <ServiceChip
                  name="Redis"
                  ok={health?.services.redis === "ok"}
                  icon={Shield}
                  detail={health?.services.redis ?? "unknown"}
                />
              </div>
            </div>

            {/* Active pipelines */}
            <div className="surface-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="section-eyebrow">AI Pipelines</p>
                  <h3 className="font-display text-sm font-semibold text-foreground mt-0.5">Camera Pipeline Status</h3>
                </div>
                <span className="text-2xs text-stone-400 font-mono">
                  {activePipelines.length} active / {pipelines.length} total
                </span>
              </div>
              {pipelines.length === 0 ? (
                <div className="py-8 text-center">
                  <Camera className="h-6 w-6 text-stone-300 mx-auto mb-2" />
                  <p className="text-sm text-stone-500">No camera pipelines running</p>
                  <p className="text-xs text-stone-400 mt-1">Start a camera from the Camera Network page</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pipelines.map(([cameraId, p]) => (
                    <div key={cameraId} className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      p.running ? "bg-sage-50/50 border-sage-100" : "bg-stone-50 border-stone-200 border-dashed"
                    )}>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "h-2 w-2 rounded-full shrink-0",
                          p.running ? "bg-sage-500 animate-pulse" : "bg-stone-300"
                        )} />
                        <div>
                          <p className="text-sm font-mono font-semibold text-stone-700">{cameraId}</p>
                          <p className="text-2xs text-stone-400 font-mono">
                            {p.frames.toLocaleString("en-IN")} frames · {p.errors} errors
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-stone-700 tabular-nums font-mono">{p.fps} FPS</p>
                        <p className={cn("text-2xs font-mono", p.running ? "text-sage-600" : "text-stone-400")}>
                          {p.running ? "Active" : "Stopped"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live counters */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "WebSocket Connections", value: metrics.active_connections, icon: Wifi },
                { label: "Active Cameras", value: metrics.active_cameras, icon: Camera },
                { label: "AI Pipelines Running", value: activePipelines.length, icon: Zap },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="surface-panel p-4 text-center">
                  <Icon className="h-4 w-4 text-stone-400 mx-auto mb-2" />
                  <p className="font-display text-2xl font-semibold text-stone-900 tabular-nums">{value}</p>
                  <p className="text-2xs text-stone-400 font-mono mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Loading skeleton */}
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="skeleton rounded-xl h-24" />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton rounded-xl h-16" />
              ))}
            </div>
            <div className="skeleton rounded-xl h-40" />
            {/* Show health status even while WS is loading */}
            {health && (
              <div className="surface-panel p-5">
                <p className="section-eyebrow mb-3">Service Health</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ServiceChip name="API Backend" ok={true} icon={Server} detail="responding" />
                  <ServiceChip name="WebSocket" ok={isLive} icon={Wifi} detail={isLive ? "streaming" : "connecting"} />
                  <ServiceChip name="Database" ok={health.services.database === "ok"} icon={Database} detail={health.services.database} />
                  <ServiceChip name="Redis" ok={health.services.redis === "ok"} icon={Shield} detail={health.services.redis} />
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer: auto-refresh indicator */}
        <div className="flex items-center justify-end gap-2 text-2xs text-stone-400 font-mono pb-2">
          <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: "4s" }} />
          WS metrics · health poll every 15s
        </div>
      </div>
    </div>
  );
}
