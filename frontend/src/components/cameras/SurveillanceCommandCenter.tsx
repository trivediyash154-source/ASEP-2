"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { camerasApi } from "@/lib/api/endpoints";
import { useCamerasStore } from "@/lib/stores/cameras.store";
import { useGlobalDetectionStream } from "@/lib/hooks/useGlobalDetectionStream";
import type { Camera } from "@/lib/types";

import { TacticalHeader } from "./TacticalHeader";
import { HeroFeed } from "./HeroFeed";
import { CameraCluster } from "./CameraCluster";
import { IncidentRail } from "./IncidentRail";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { FullscreenWall } from "./FullscreenWall";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Orchestrates every surveillance component, owns the single global WS
 * subscription, and binds keyboard shortcuts.
 *
 * Layout:
 *   ┌─ TacticalHeader ──────────────────────────────────────────┐
 *   ├─ HeroFeed ──────────────────────┬─ IncidentRail ─────────┤
 *   ├─ CameraCluster ─────────────────┘                         │
 *   └───────────────────────────────────────────────────────────┘
 *   + EvidenceDrawer (slides in from right when detection selected)
 *   + FullscreenWall (overlay, F key)
 */
export function SurveillanceCommandCenter() {
  const { status: wsStatus } = useGlobalDetectionStream();
  const wsConnected = wsStatus === "connected";

  const { data: cameras, isLoading } = useQuery({
    queryKey: ["cameras", "list"],
    queryFn: () => camerasApi.list(0, 100).then((r) => r.data as Camera[]),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const list = cameras ?? [];
  const selectedId = useCamerasStore((s) => s.selectedCameraId);
  const selectCamera = useCamerasStore((s) => s.selectCamera);
  const toggleFullscreen = useCamerasStore((s) => s.toggleFullscreen);
  const selectDetection = useCamerasStore((s) => s.selectDetection);

  // Auto-select the first active camera when the list arrives
  useEffect(() => {
    if (!list.length || selectedId) return;
    const firstActive = list.find((c) => c.status === "active") ?? list[0];
    if (firstActive) selectCamera(firstActive.id);
  }, [list, selectedId, selectCamera]);

  const hero = useMemo<Camera | undefined>(() => {
    return list.find((c) => c.id === selectedId) ?? list.find((c) => c.status === "active") ?? list[0];
  }, [list, selectedId]);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ignore when typing in any input/textarea/contenteditable
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement | null)?.isContentEditable) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (e.key === "Escape") {
        // Drawer handles its own Esc; this catches the rail-empty case
        selectDetection(null);
        return;
      }
      // 1–9 → focus camera at that index in the visible active list
      const n = Number(e.key);
      if (!Number.isNaN(n) && n >= 1 && n <= 9) {
        const sorted = [
          ...list.filter((c) => c.status === "active"),
          ...list.filter((c) => c.status === "error"),
          ...list.filter((c) => c.status !== "active" && c.status !== "error"),
        ];
        const target = sorted[n - 1];
        if (target) selectCamera(target.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [list, selectCamera, selectDetection, toggleFullscreen]);

  return (
    <div className="page-shell page-enter space-y-6">
      <TacticalHeader cameras={list} wsConnected={wsConnected} />

      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(320px,360px)] gap-6">
          <Skeleton className="h-[560px] rounded-xl" />
          <Skeleton className="h-[560px] rounded-xl" />
        </div>
      ) : !hero ? (
        <div className="surface-panel p-10 text-center">
          <p className="font-display text-base font-semibold text-foreground">
            No cameras provisioned
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            Add a camera to begin streaming surveillance events.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(320px,360px)] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <HeroFeed camera={hero} />
            <CameraCluster cameras={list} excludeId={hero.id} />
          </div>
          <IncidentRail />
        </div>
      )}

      <EvidenceDrawer />
      <FullscreenWall cameras={list} />
    </div>
  );
}
