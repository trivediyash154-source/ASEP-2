"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Triggers a brief white-sheet "evidence capture" flash on demand. The hook
 * keeps a single `flashing` state that consumers render as a full-cover
 * absolute div with opacity decay, so the flash always lands inside the
 * camera viewport (never the full window).
 *
 * Decay duration ≈ 350ms with exponential opacity curve.
 */
export function useEvidenceFlash(durationMs = 360) {
  const [active, setActive] = useState(false);
  const [pulseKey, setPulseKey] = useState(0); // bump on each fire so CSS animations restart
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setPulseKey((k) => k + 1);
    setActive(true);
    timer.current = setTimeout(() => setActive(false), durationMs);
  }, [durationMs]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { active, pulseKey, trigger, durationMs };
}
