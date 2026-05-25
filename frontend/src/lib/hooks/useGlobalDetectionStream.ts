"use client";

import { useCallback } from "react";
import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { useCamerasStore, type LiveDetectionEvent } from "@/lib/stores/cameras.store";

/**
 * Singleton-style hook: subscribes to the global detection feed once and
 * pushes every event into the cameras store. Mount it exactly once at the
 * cameras module root (or anywhere that needs live data) — all child
 * components then read from the store instead of opening their own
 * WebSocket connections.
 */
export function useGlobalDetectionStream() {
  const push = useCamerasStore((s) => s.pushEvent);

  const handle = useCallback(
    (data: unknown) => {
      const e = data as Partial<LiveDetectionEvent> | null;
      if (!e || e.type !== "detection" || !e.id || !e.camera_id) return;
      push({
        ...(e as LiveDetectionEvent),
        receivedAt: Date.now(),
      });
    },
    [push]
  );

  return useWebSocket("/ws/detections", {
    onMessage: handle,
    autoReconnect: true,
  });
}
