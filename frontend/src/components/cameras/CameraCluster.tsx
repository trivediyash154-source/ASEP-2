"use client";

import { useMemo } from "react";

import { useCamerasStore } from "@/lib/stores/cameras.store";
import { SurveillanceCard } from "./SurveillanceCard";
import type { Camera } from "@/lib/types";

interface Props {
  cameras: Camera[];
  /** Camera to exclude from the cluster (typically the hero) */
  excludeId?: string | null;
  density?: "compact" | "comfortable";
}

/**
 * Adaptive grid of secondary camera cards. Splits into sections by
 * status so operators can quickly see what needs attention.
 */
export function CameraCluster({ cameras, excludeId, density = "comfortable" }: Props) {
  const selectedId = useCamerasStore((s) => s.selectedCameraId);

  const { live, alert, idle } = useMemo(() => {
    const live: Camera[] = [];
    const alert: Camera[] = [];
    const idle: Camera[] = [];
    for (const c of cameras) {
      if (c.id === excludeId) continue;
      if (c.status === "active") live.push(c);
      else if (c.status === "error") alert.push(c);
      else idle.push(c);
    }
    return { live, alert, idle };
  }, [cameras, excludeId]);

  const renderSection = (title: string, items: Camera[], accent: string) => {
    if (items.length === 0) return null;
    return (
      <section>
        <header className="flex items-center justify-between mb-3 px-1">
          <h3 className={"font-mono text-2xs font-semibold uppercase tracking-[0.18em] " + accent}>
            {title}
            <span className="ml-2 text-foreground-subtle tabular-nums">{items.length}</span>
          </h3>
          <span className="text-2xs text-foreground-subtle font-mono">
            Press 1–9 to focus
          </span>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((c) => (
            <SurveillanceCard
              key={c.id}
              camera={c}
              active={c.id === selectedId}
              density={density}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-7">
      {renderSection("Live", live, "text-sage-700")}
      {renderSection("Fault", alert, "text-peach-700")}
      {renderSection("Standby", idle, "text-foreground-subtle")}
    </div>
  );
}
