/**
 * Operational intelligence event store.
 *
 * Single source of truth for every event the UI surfaces — controlled-replay
 * detections, live alerts, challan issuances, system warnings, camera
 * disconnects. Backed by a Zustand store so the NotificationCenter,
 * LiveEventRail, and IncidentResponseOverlay all stay in sync without each
 * holding their own WebSocket.
 *
 * Events are pushed in by `useNotificationBus` (mounted once in the
 * dashboard layout). Components subscribe via selectors — no event will be
 * dropped on the floor regardless of which page is open.
 */
import { create } from "zustand";

/** Compact unique id — `crypto.randomUUID()` is available in evergreen browsers
 *  and Node ≥ 19. Fallback to a base-36 timestamp+random for safety. */
function nanoid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type NotificationSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "system";

export type NotificationKind =
  | "detection"           // ordinary detection — vehicle seen, OCR ok
  | "challan_issued"      // automated challan creation
  | "blacklist_hit"       // blacklisted plate seen
  | "repeat_offender"     // multiple offences in window
  | "stolen_match"        // BOLO match
  | "ocr_recovery"        // low-confidence read recovered via consensus
  | "camera_offline"      // stream lost
  | "system_warning"      // pipeline degradation, queue backup, etc.
  | "system_error";       // hard failure

export interface OperationalEvent {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  detail: string;
  /** Source district / camera location */
  district?: string;
  /** Plate number, when applicable */
  plate?: string;
  /** Numeric threat score (0–100) for the event, when scored */
  threat_score?: number;
  /** OCR confidence at the moment of detection (0–1) */
  ocr_confidence?: number;
  /** Backend Detection.id for deep-linking into evidence */
  detection_id?: string;
  /** Backend Challan.id for deep-linking into the challan */
  challan_id?: string;
  /** Backend camera ID */
  camera_id?: string;
  /** ISO timestamp from the backend; we also keep receivedAt locally */
  timestamp: string;
  receivedAt: number;
  read: boolean;
}

interface State {
  events: OperationalEvent[];
  /** id of an event that should auto-open an incident overlay (one-shot) */
  pendingIncidentId: string | null;
  /** Currently-applied severity filter for the NotificationCenter */
  filterSeverity: NotificationSeverity[] | "all";
  /** Currently-applied district filter (substring match, case-insensitive) */
  filterDistrict: string;

  // ── actions ──
  push: (event: Omit<OperationalEvent, "id" | "read" | "receivedAt">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  consumeIncident: () => void;
  setFilterSeverity: (f: NotificationSeverity[] | "all") => void;
  setFilterDistrict: (q: string) => void;
}

/** Trim the buffer to this many most-recent events; older ones drop. */
const MAX_BUFFER = 200;

/** Auto-open an incident overlay for these severities. */
const INCIDENT_SEVERITIES = new Set<NotificationSeverity>(["high", "critical"]);

export const useNotificationsStore = create<State>((set, get) => ({
  events: [],
  pendingIncidentId: null,
  filterSeverity: "all",
  filterDistrict: "",

  push: (e) => {
    const event: OperationalEvent = {
      ...e,
      id: nanoid(),
      read: false,
      receivedAt: Date.now(),
    };
    set((s) => ({
      events: [event, ...s.events].slice(0, MAX_BUFFER),
      // The first qualifying event becomes the next incident to display.
      // We never overwrite an unread incident — the overlay must clear it
      // explicitly via consumeIncident() once acknowledged.
      pendingIncidentId:
        s.pendingIncidentId ??
        (INCIDENT_SEVERITIES.has(event.severity) ? event.id : null),
    }));
  },

  markRead: (id) =>
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, read: true } : e)),
    })),

  markAllRead: () =>
    set((s) => ({ events: s.events.map((e) => ({ ...e, read: true })) })),

  dismiss: (id) =>
    set((s) => ({
      events: s.events.filter((e) => e.id !== id),
      pendingIncidentId: s.pendingIncidentId === id ? null : s.pendingIncidentId,
    })),

  clearAll: () => set({ events: [], pendingIncidentId: null }),

  consumeIncident: () => set({ pendingIncidentId: null }),

  setFilterSeverity: (f) => set({ filterSeverity: f }),
  setFilterDistrict: (q) => set({ filterDistrict: q }),
}));

// ── Derived selectors ────────────────────────────────────────────────

export function selectUnreadCount(s: State): number {
  return s.events.filter((e) => !e.read).length;
}

export function selectFilteredEvents(s: State): OperationalEvent[] {
  const q = s.filterDistrict.trim().toLowerCase();
  const sev = s.filterSeverity;
  return s.events.filter((e) => {
    if (sev !== "all" && !sev.includes(e.severity)) return false;
    if (q && !(e.district ?? "").toLowerCase().includes(q)) return false;
    return true;
  });
}

export function selectPendingIncident(s: State): OperationalEvent | null {
  if (!s.pendingIncidentId) return null;
  return s.events.find((e) => e.id === s.pendingIncidentId) ?? null;
}

// ── Severity ranking, used by the rail to highlight the worst-recent ──

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  system: 0, info: 1, low: 2, medium: 3, high: 4, critical: 5,
};

export function compareSeverity(
  a: NotificationSeverity,
  b: NotificationSeverity,
): number {
  return SEVERITY_RANK[b] - SEVERITY_RANK[a];
}
