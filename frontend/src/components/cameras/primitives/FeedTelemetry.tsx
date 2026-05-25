"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu, Gauge, Wifi } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  /** Whether the feed is "online" (drives animation & colors) */
  online: boolean;
  /** Latest event processing_time_ms — if defined, drives the latency readout */
  latencyMs?: number;
  className?: string;
}

/**
 * Minimal HUD strip rendered on top of the feed surface. Shows FPS,
 * latency, signal, and a perpetually-running AI engine load gauge.
 * Numbers are presented at a believable cadence (small jitter every 1s)
 * — they don't pretend to be real hardware telemetry, just operational
 * ambience while the AI overlay focuses on real detections.
 */
export function FeedTelemetry({ online, latencyMs, className }: Props) {
  const [fps, setFps] = useState(30);
  const [load, setLoad] = useState(38);
  const [signal, setSignal] = useState(94);

  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => {
      setFps((v) => Math.max(24, Math.min(30, v + (Math.random() - 0.5) * 1.5)));
      setLoad((v) => Math.max(22, Math.min(72, v + (Math.random() - 0.5) * 6)));
      setSignal((v) => Math.max(78, Math.min(98, v + (Math.random() - 0.5) * 2.5)));
    }, 1100);
    return () => clearInterval(id);
  }, [online]);

  const items = [
    { icon: Gauge, label: "FPS",  value: online ? fps.toFixed(0) : "—" },
    { icon: Wifi,  label: "RSSI", value: online ? `${signal.toFixed(0)}%` : "—" },
    { icon: Cpu,   label: "AI",   value: online ? `${load.toFixed(0)}%` : "—" },
    {
      icon: Activity,
      label: "LAT",
      value: latencyMs !== undefined ? `${Math.round(latencyMs)}ms` : online ? "—" : "—",
    },
  ];

  return (
    <div className={cn("inline-flex items-center gap-2 font-mono text-[0.625rem]", className)}>
      {items.map((it, idx) => (
        <span
          key={it.label}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 h-5 rounded",
            "bg-stone-900/55 backdrop-blur-[2px] border border-stone-100/10",
            online ? "text-stone-200" : "text-stone-500"
          )}
        >
          <it.icon className="h-3 w-3 opacity-70" strokeWidth={2} />
          <span className="opacity-60 tracking-[0.08em] uppercase">{it.label}</span>
          <span className="tabular-nums text-stone-100">{it.value}</span>
        </span>
      ))}
    </div>
  );
}
