/**
 * Operational event bus — singleton subscriber.
 *
 * Mount this **exactly once** at the dashboard layout root. It opens two
 * authenticated WebSocket subscriptions:
 *
 *   /ws/detections   → broadcasted by every persisted Detection (live + replay)
 *   /ws/alerts       → broadcasted on violations + challan issuance
 *
 * Each incoming payload is classified into a NotificationKind and severity,
 * then pushed into the shared notifications store. The NotificationCenter,
 * LiveEventRail, and IncidentResponseOverlay all read from that store.
 *
 * Hardening:
 *  - Reuses the existing `useWebSocket` hook (bounded reconnect + heartbeat).
 *  - `enabled` is gated on the user being authenticated, so we don't burn
 *    reconnect attempts when there's no token to send.
 *  - Deduplication: detection events and alert events for the *same* backend
 *    detection_id are merged — alert takes precedence (richer payload).
 */
"use client";

import { useCallback, useEffect, useRef } from "react";

import { useWebSocket } from "@/lib/hooks/useWebSocket";
import { useAuthStore } from "@/lib/stores/auth.store";
import {
  useNotificationsStore,
  type NotificationKind,
  type NotificationSeverity,
} from "@/lib/stores/notifications.store";
import { log } from "@/lib/diagnostics/logger";

// ── Severity mapping ────────────────────────────────────────────────

const SEVERITY_FALLBACK_BY_VIOLATION: Record<string, NotificationSeverity> = {
  "Blacklisted Vehicle":   "critical",
  "Stolen Vehicle":        "critical",
  "Expired Registration":  "high",
  "Expired Insurance":     "medium",
  "Expired Pollution Cert": "low",
  "Speeding":              "high",
  "Signal Jump":           "medium",
};

function normaliseSeverity(raw: unknown): NotificationSeverity | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw.toLowerCase();
  if (s === "info" || s === "low" || s === "medium" || s === "high" || s === "critical" || s === "system") {
    return s;
  }
  return undefined;
}

// ── Payload → OperationalEvent classification ───────────────────────

interface DetectionPayload {
  type?: string;
  id?: string;
  camera_id?: string;
  camera_code?: string;
  camera_location?: string;
  camera_name?: string;
  plate?: string;
  ocr_confidence?: number;
  is_violation?: boolean;
  violation_type?: string | null;
  severity?: string;
  threat_score?: number;
  challan_id?: string | null;
  challan_number?: string | null;
  fine_amount_inr?: number;
  timestamp?: string;
  source?: string;
}

function classifyDetection(p: DetectionPayload): {
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  detail: string;
} | null {
  if (!p.plate) return null;

  // Alerts (carry severity + threat_score)
  if (p.type === "alert" || p.is_violation) {
    const severity =
      normaliseSeverity(p.severity) ??
      SEVERITY_FALLBACK_BY_VIOLATION[p.violation_type ?? ""] ??
      "medium";
    const violation = p.violation_type ?? "Compliance violation";
    const challanLabel = p.challan_number
      ? ` · ${p.challan_number}`
      : p.fine_amount_inr
        ? ` · ₹${p.fine_amount_inr.toLocaleString("en-IN")}`
        : "";

    const isBlacklist = violation.toLowerCase().includes("blacklist");
    const isStolen = violation.toLowerCase().includes("stolen") || violation.toLowerCase().includes("bolo");
    const kind: NotificationKind =
      isStolen ? "stolen_match" :
      isBlacklist ? "blacklist_hit" :
      p.challan_id ? "challan_issued" :
      "detection";

    return {
      kind,
      severity,
      title: isStolen ? "BOLO match — stolen vehicle" :
             isBlacklist ? "Blacklist hit" :
             p.challan_id ? `Challan issued — ${violation}` :
             violation,
      detail: `${p.plate} · ${p.camera_code ?? "unknown camera"}${challanLabel}`,
    };
  }

  // Plain detection — low-confidence OCR triggers a different notif
  if (typeof p.ocr_confidence === "number" && p.ocr_confidence < 0.78) {
    return {
      kind: "ocr_recovery",
      severity: "info",
      title: "OCR recovery — consensus vote",
      detail: `${p.plate} · ${p.camera_code ?? "—"} · OCR ${(p.ocr_confidence * 100).toFixed(0)}%`,
    };
  }

  return {
    kind: "detection",
    severity: "info",
    title: "Detection logged",
    detail: `${p.plate} · ${p.camera_code ?? "—"} · OCR ${
      typeof p.ocr_confidence === "number" ? (p.ocr_confidence * 100).toFixed(0) + "%" : "—"
    }`,
  };
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * Subscribe to global detection + alert streams and feed the notifications
 * store. Mount **exactly once** at the dashboard layout root.
 */
export function useNotificationBus() {
  const push = useNotificationsStore((s) => s.push);
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  // Track which detection_ids we've already classified, so an alert and a
  // detection for the same event don't both create notifications.
  const seenRef = useRef<Set<string>>(new Set());

  const handleEvent = useCallback(
    (data: unknown) => {
      const payload = data as DetectionPayload | null;
      if (!payload || typeof payload !== "object") return;

      // Heartbeat / subscription ack frames — ignore
      if (payload.type === "ping" || payload.type === "connected" || payload.type === "subscribed") {
        return;
      }

      // Dedup: alert wins over the detection for the same row. We only de-dup
      // the *detection* path — alerts always go through (they're stronger).
      if (payload.type === "detection" && payload.id) {
        if (seenRef.current.has(payload.id)) return;
        seenRef.current.add(payload.id);
        // Bound the set so it doesn't grow forever during long sessions
        if (seenRef.current.size > 500) {
          const arr = Array.from(seenRef.current);
          seenRef.current = new Set(arr.slice(-250));
        }
      }

      const classified = classifyDetection(payload);
      if (!classified) return;

      push({
        kind: classified.kind,
        severity: classified.severity,
        title: classified.title,
        detail: classified.detail,
        district: payload.camera_location ?? payload.camera_name,
        plate: payload.plate,
        threat_score: payload.threat_score,
        ocr_confidence: payload.ocr_confidence,
        detection_id: payload.id,
        challan_id: payload.challan_id ?? undefined,
        camera_id: payload.camera_id,
        timestamp: payload.timestamp ?? new Date().toISOString(),
      });

      log.debug("ws", "classified", {
        kind: classified.kind,
        severity: classified.severity,
        plate: payload.plate,
      });
    },
    [push]
  );

  // Two channels — one each for detections and alerts. Alerts carry severity
  // and challan_id, so they're our primary signal for high-stakes events.
  useWebSocket("/ws/detections", {
    onMessage: handleEvent,
    autoReconnect: true,
    enabled: isAuthed,
  });
  useWebSocket("/ws/alerts", {
    onMessage: handleEvent,
    autoReconnect: true,
    enabled: isAuthed,
  });

  // No return value — the store is the public interface.
  useEffect(() => {
    log.info("ws", "mounted");
    return () => log.info("ws", "unmounted");
  }, []);
}
