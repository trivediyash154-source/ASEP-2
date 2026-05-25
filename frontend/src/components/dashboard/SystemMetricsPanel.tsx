"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Camera, Cpu, Wifi, WifiOff } from "lucide-react";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { cn } from "@/lib/utils";

interface MetricsMsg {
  type: string; cpu: number; memory: number;
  memory_used_gb: number; memory_total_gb: number;
  disk: number; disk_used_gb: number; disk_total_gb: number;
  active_connections: number; active_cameras: number;
  pipeline_status: Record<string, { running: boolean; fps: number; frames: number }>;
  gpu: { available: boolean; name?: string; usage_percent?: number; memory_used_gb?: number; memory_total_gb?: number; temperature_c?: number };
}

const isMsg = (d: unknown): d is MetricsMsg =>
  !!d && typeof d === "object" && (d as any)["type"] === "system_metrics";

function barColor(value: number, danger = 85, warn = 65): string {
  if (value > danger) return "bg-peach-500 text-peach-700 dark:text-peach-400";
  if (value > warn)   return "bg-bronze-400 text-bronze-700 dark:text-bronze-400";
  return "bg-sage-500 text-sage-700 dark:text-sage-400";
}

function Bar({ label, value, colorClass, detail }: { label: string; value: number; colorClass: string; detail?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const [bg, text] = colorClass.split(" ");
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-foreground-muted">{label}</span>
        <span className={cn("text-xs font-mono font-semibold tabular-nums", text)}>
          {detail ?? `${value.toFixed(1)}%`}
        </span>
      </div>
      <div className="progress-track">
        <motion.div
          className={cn("progress-fill", bg)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
        />
      </div>
    </div>
  );
}

export function SystemMetricsPanel() {
  const [m, setM] = useState<MetricsMsg | null>(null);
  const [updated, setUpdated] = useState<Date | null>(null);

  const onMessage = useCallback((d: unknown) => {
    if (!isMsg(d)) return;
    setM(d); setUpdated(new Date());
  }, []);

  const { status } = useWebSocket("/ws/metrics", { onMessage, autoReconnect: true });
  const active = m ? Object.entries(m.pipeline_status).filter(([, p]) => p.running) : [];
  const isLive = status === "connected";

  return (
    <div className="op-surface p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="section-eyebrow mb-0.5">Infrastructure</p>
          <p className="text-sm font-semibold text-foreground">System Health</p>
          <p className="text-2xs text-foreground-subtle mt-0.5">
            {updated ? `Updated ${updated.toLocaleTimeString("en-IN", { hour12: false })}` : "Connecting…"}
          </p>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 text-2xs font-mono font-semibold",
          isLive ? "text-sage-600 dark:text-sage-400" : "text-foreground-subtle"
        )}>
          {isLive
            ? <><Wifi className="h-3.5 w-3.5" /> Live · 5s</>
            : <><WifiOff className="h-3.5 w-3.5" /> Offline</>}
        </div>
      </div>

      {m ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <Bar label="CPU Usage"   value={m.cpu}    colorClass={barColor(m.cpu)} />
            <Bar label="Memory"      value={m.memory}
              detail={`${m.memory_used_gb.toFixed(1)} / ${m.memory_total_gb.toFixed(1)} GB`}
              colorClass={barColor(m.memory, 90, 75)} />
            <Bar label="Disk"        value={m.disk}
              detail={`${m.disk_used_gb.toFixed(0)} / ${m.disk_total_gb.toFixed(0)} GB`}
              colorClass={barColor(m.disk, 90, 80)} />
          </div>

          {m.gpu.available && (
            <div className="mb-5 p-4 bg-sage-50/50 dark:bg-sage-900/20 border border-sage-200/60 dark:border-sage-700/30 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-sage-800 dark:text-sage-300 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  GPU · {m.gpu.name}
                </span>
                {m.gpu.temperature_c != null && (
                  <span className={cn(
                    "text-xs font-mono font-bold",
                    m.gpu.temperature_c > 80 ? "text-peach-600 dark:text-peach-400" : "text-foreground-muted"
                  )}>
                    {m.gpu.temperature_c}°C
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Bar label="GPU Core" value={m.gpu.usage_percent ?? 0}
                  colorClass={barColor(m.gpu.usage_percent ?? 0)} />
                <Bar label="VRAM"
                  value={((m.gpu.memory_used_gb ?? 0) / Math.max(m.gpu.memory_total_gb ?? 1, 0.001)) * 100}
                  detail={`${(m.gpu.memory_used_gb ?? 0).toFixed(1)} / ${(m.gpu.memory_total_gb ?? 0).toFixed(1)} GB`}
                  colorClass="bg-sage-500 text-sage-700 dark:text-sage-400" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "WS Connections", value: m.active_connections, icon: Wifi },
              { label: "Active Cameras",  value: m.active_cameras,    icon: Camera },
              { label: "Pipeline FPS",    value: active.reduce((s, [, p]) => s + p.fps, 0).toFixed(0), icon: Activity },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center p-3 bg-muted/60 rounded-xl border border-border">
                <Icon className="h-4 w-4 text-foreground-subtle mx-auto mb-1.5" />
                <p className="text-lg font-display font-bold text-foreground tabular-nums">{value}</p>
                <p className="text-2xs text-foreground-subtle mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {active.length > 0 && (
            <div className="space-y-1.5">
              <p className="section-eyebrow mb-2">Active Pipelines</p>
              {active.map(([id, p]) => (
                <div key={id} className="flex items-center justify-between text-xs py-2 px-3 bg-muted/40 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <span className="status-dot-live" />
                    <span className="font-mono text-foreground-muted text-2xs">{id}</span>
                  </div>
                  <div className="flex gap-3 text-2xs font-mono text-foreground-subtle tabular-nums">
                    <span className="text-sage-600 dark:text-sage-400 font-semibold">{p.fps} FPS</span>
                    <span>{p.frames.toLocaleString()} fr</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {[80, 60, 90].map((w, i) => (
            <div key={i}>
              <div className={`skeleton h-2 w-${w} rounded mb-2`} />
              <div className="skeleton h-1.5 w-full rounded" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
