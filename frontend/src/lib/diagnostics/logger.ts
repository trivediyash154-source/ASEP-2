/**
 * Frontend structured logger.
 *
 * Categorized, level-filtered, ring-buffered. The ring buffer is exposed
 * on `window.__VAAHAN_LOGS__` so diagnostics overlays / support exports
 * can read recent log history without re-instrumenting code.
 *
 * Categories:
 *   auth      — session verification, token refresh, login/logout
 *   ws        — websocket lifecycle (connect/close/retry/error)
 *   stream    — MJPEG / live feed lifecycle
 *   camera    — camera connect/disconnect modal flows
 *   ocr       — OCR pipeline events surfaced from the backend
 *   render    — React errors caught by ErrorBoundary
 *   net       — axios / API client transport failures
 *   ui        — generic UI state transitions
 */

type Level = "debug" | "info" | "warn" | "error";
export type LogCategory =
  | "auth"
  | "ws"
  | "stream"
  | "camera"
  | "ocr"
  | "render"
  | "net"
  | "ui";

interface LogEntry {
  ts: number;
  level: Level;
  category: LogCategory;
  msg: string;
  data?: Record<string, unknown>;
}

const RING_SIZE = 500;
const ring: LogEntry[] = [];

const enabled = (() => {
  if (typeof window === "undefined") return true;
  return (
    (process.env.NODE_ENV !== "production") ||
    window.localStorage?.getItem("vaahan.debug") === "1"
  );
})();

const COLORS: Record<Level, string> = {
  debug: "color:#7C7970",
  info: "color:#7F8876",
  warn: "color:#C9925F;font-weight:bold",
  error: "color:#B95C5C;font-weight:bold",
};

function push(entry: LogEntry) {
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
  if (typeof window !== "undefined") {
    (window as unknown as { __VAAHAN_LOGS__?: LogEntry[] }).__VAAHAN_LOGS__ = ring;
  }
}

function emit(level: Level, category: LogCategory, msg: string, data?: Record<string, unknown>) {
  const entry: LogEntry = { ts: Date.now(), level, category, msg, data };
  push(entry);
  if (!enabled) return;
  const tag = `%c[${category}]`;
  const args: unknown[] = [tag, COLORS[level], msg];
  if (data) args.push(data);
  // eslint-disable-next-line no-console
  (console[level] ?? console.log)(...args);
}

export const log = {
  debug: (category: LogCategory, msg: string, data?: Record<string, unknown>) =>
    emit("debug", category, msg, data),
  info: (category: LogCategory, msg: string, data?: Record<string, unknown>) =>
    emit("info", category, msg, data),
  warn: (category: LogCategory, msg: string, data?: Record<string, unknown>) =>
    emit("warn", category, msg, data),
  error: (category: LogCategory, msg: string, data?: Record<string, unknown>) =>
    emit("error", category, msg, data),
  /** Drain the ring buffer — used by diagnostics export. */
  snapshot: (): LogEntry[] => [...ring],
  /** Clear the ring buffer. */
  clear: () => {
    ring.length = 0;
  },
};

/** Convenience wrapper that times an async block and logs the duration. */
export async function timed<T>(
  category: LogCategory,
  msg: string,
  fn: () => Promise<T>,
  extra?: Record<string, unknown>
): Promise<T> {
  const t0 = performance.now();
  try {
    const out = await fn();
    log.info(category, msg, { ...extra, ms: Math.round(performance.now() - t0), ok: true });
    return out;
  } catch (err) {
    log.error(category, msg, {
      ...extra,
      ms: Math.round(performance.now() - t0),
      ok: false,
      error: (err as Error)?.message,
    });
    throw err;
  }
}
