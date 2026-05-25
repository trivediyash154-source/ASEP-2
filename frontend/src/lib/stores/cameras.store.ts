/**
 * Cameras / surveillance state — coordinates the live event stream, the
 * currently-focused camera, the evidence drawer, and fullscreen mode.
 *
 * Designed so every component in the cameras module reads from one source
 * of truth instead of holding its own WebSocket connection. A single
 * useGlobalDetectionStream() hook feeds events into pushEvent().
 */
import { create } from "zustand";

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LiveDetectionEvent {
  id: string;
  type: string;
  camera_id: string;
  camera_code?: string;
  camera_name?: string;
  camera_location?: string;
  plate?: string;
  ocr_confidence?: number;
  vehicle_confidence?: number;
  plate_confidence?: number;
  vehicle_category?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  vehicle_year?: number;
  is_violation?: boolean;
  violation_type?: string;
  processing_time_ms?: number;
  bounding_box?: BBox;
  plate_bounding_box?: BBox;
  frame_width?: number;
  frame_height?: number;
  timestamp: string;
  /** Local epoch ms when the event arrived — used for "is recent" checks */
  receivedAt: number;
}

const MAX_GLOBAL = 80;
const MAX_PER_CAMERA = 20;

interface CamerasState {
  /** Hero / focused camera ID. null until first list loads. */
  selectedCameraId: string | null;
  /** Currently open detection in evidence drawer */
  selectedDetectionId: string | null;
  /** Whether the fullscreen tactical wall overlay is visible */
  fullscreen: boolean;
  /** Most-recent events, newest first, capped at MAX_GLOBAL */
  events: LiveDetectionEvent[];
  /** Per-camera event buckets, newest first */
  eventsByCamera: Record<string, LiveDetectionEvent[]>;
  /** Monotonic counter incremented on every push — easy way to trigger
   *  flash animations even when the array reference is stable */
  pulse: number;

  selectCamera: (id: string | null) => void;
  selectDetection: (id: string | null) => void;
  setFullscreen: (on: boolean) => void;
  toggleFullscreen: () => void;
  pushEvent: (event: LiveDetectionEvent) => void;
  clearEvents: () => void;
}

export const useCamerasStore = create<CamerasState>((set) => ({
  selectedCameraId: null,
  selectedDetectionId: null,
  fullscreen: false,
  events: [],
  eventsByCamera: {},
  pulse: 0,

  selectCamera: (id) => set({ selectedCameraId: id }),
  selectDetection: (id) => set({ selectedDetectionId: id }),
  setFullscreen: (on) => set({ fullscreen: on }),
  toggleFullscreen: () => set((s) => ({ fullscreen: !s.fullscreen })),

  pushEvent: (event) =>
    set((state) => {
      const events = [event, ...state.events].slice(0, MAX_GLOBAL);
      const cid = event.camera_id;
      const prevBucket = state.eventsByCamera[cid] ?? [];
      const eventsByCamera = {
        ...state.eventsByCamera,
        [cid]: [event, ...prevBucket].slice(0, MAX_PER_CAMERA),
      };
      return { events, eventsByCamera, pulse: state.pulse + 1 };
    }),

  clearEvents: () => set({ events: [], eventsByCamera: {}, pulse: 0 }),
}));

// ── Convenience selectors ───────────────────────────────────────────
export const selectCameraEvents = (cameraId: string) => (s: CamerasState) =>
  s.eventsByCamera[cameraId] ?? [];

export const selectLatestForCamera = (cameraId: string) => (s: CamerasState) =>
  s.eventsByCamera[cameraId]?.[0];
