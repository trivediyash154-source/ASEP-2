"use client";

import { useEffect, useRef, useState } from "react";

import { playChime } from "@/lib/audio/alertChime";
import { useCamerasStore, type LiveDetectionEvent } from "@/lib/stores/cameras.store";

interface Options {
  audio?: boolean;
  freshnessMs?: number;
}

/**
 * Per-camera "detection ceremony" orchestrator. Watches the cameras store
 * for genuinely new events on the given camera and exposes monotonic keys
 * the FX layers consume:
 *
 *   flashKey   bumps   white evidence flash inside the feed
 *   pulseKey   bumps   radial DetectionPulse rings + dossier + ceremony
 *   lastEvent          the event that triggered the most recent bump
 *
 * Plays the audio chime when `audio` is true (scan for compliant, violation
 * for alerts). Switching cameras resets state — the new camera's backlog is
 * silently absorbed so we never replay history as if it were live.
 */
export function useDetectionFx(
  cameraId: string | null | undefined,
  opts: Options = {}
) {
  const { audio = false, freshnessMs = 2500 } = opts;
  const events = useCamerasStore((s) =>
    cameraId ? (s.eventsByCamera[cameraId] ?? []) : []
  );

  const [flashKey, setFlashKey] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const [lastEvent, setLastEvent] = useState<LiveDetectionEvent | null>(null);

  const seen = useRef<Set<string>>(new Set());
  // Sentinel for "no camera primed yet" — undefined ≠ any string or null
  const primedCameraId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Camera switched (including initial mount) — prime against current
    // backlog so we don't replay history as live events.
    if (primedCameraId.current !== cameraId) {
      seen.current = new Set(events.map((e) => e.id));
      primedCameraId.current = cameraId;
      setFlashKey(0);
      setPulseKey(0);
      setLastEvent(null);
      return;
    }

    const incoming = events.filter((e) => !seen.current.has(e.id));
    if (incoming.length === 0) return;
    for (const e of incoming) seen.current.add(e.id);

    const newest = incoming[0];
    setLastEvent(newest);

    if (Date.now() - newest.receivedAt > freshnessMs) return;
    setFlashKey((k) => k + 1);
    setPulseKey((k) => k + 1);
    if (audio) {
      playChime(newest.is_violation ? "violation" : "scan").catch(() => {});
    }
  }, [events, cameraId, audio, freshnessMs]);

  return { flashKey, pulseKey, lastEvent };
}
