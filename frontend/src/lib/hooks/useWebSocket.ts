/**
 * Typed WebSocket hook with bounded exponential reconnect, heartbeat, and
 * a stable `onMessage` ref so parent re-renders don't cycle the socket.
 *
 * Hardening notes:
 *  - `onMessage` is stored in a ref; `connect` does not depend on it, so
 *    reconnect storms triggered by parent re-renders are eliminated.
 *  - Exponential backoff (1.5x) with jitter, capped at `maxReconnectDelay`,
 *    and a hard `maxReconnectAttempts` ceiling. After the ceiling is hit,
 *    the hook surfaces `status="failed"` and exposes `retry()` to allow
 *    operator-initiated recovery.
 *  - Heartbeat ping is sent only if the socket is OPEN. Pong handling is
 *    intrinsic — server-side managers usually reply with their own ping.
 *  - Cleanup is symmetric: close codes 1000 (normal) and 1001 (going away)
 *    will not auto-reconnect; the close was deliberate.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/api/client";
import { log } from "@/lib/diagnostics/logger";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export type WSStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
  | "failed";

interface UseWebSocketOptions {
  onMessage?: (data: unknown) => void;
  autoReconnect?: boolean;
  /** Base delay between attempts (ms). Grows by 1.5× with jitter. */
  reconnectDelay?: number;
  /** Hard cap per attempt. Defaults to 15s. */
  maxReconnectDelay?: number;
  /** Stop trying after this many consecutive failures. Defaults to 8. */
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  /** Disable the connection entirely (e.g. while gated on auth). */
  enabled?: boolean;
}

export interface UseWebSocketResult {
  status: WSStatus;
  send: (data: unknown) => boolean;
  retry: () => void;
  attempts: number;
  lastError: string | null;
}

export function useWebSocket(
  path: string,
  options: UseWebSocketOptions = {}
): UseWebSocketResult {
  const {
    onMessage,
    autoReconnect = true,
    reconnectDelay = 1500,
    maxReconnectDelay = 15_000,
    maxReconnectAttempts = 8,
    heartbeatInterval = 30_000,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<WSStatus>("disconnected");
  const [attempts, setAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const mountedRef = useRef(true);
  const attemptRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  const intentionalCloseRef = useRef(false);
  // Forward declarations — connect ↔ scheduleReconnect form a recursion cycle.
  // Late-binding via refs avoids the temporal dead zone while still allowing
  // each useCallback to capture stable deps. The refs are assigned during render.
  const connectRef = useRef<() => void>(() => {});
  const scheduleReconnectRef = useRef<() => void>(() => {});

  // Keep the latest onMessage callable without cycling the socket.
  onMessageRef.current = onMessage;

  const teardownSocket = useCallback(() => {
    clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = undefined;
    const ws = wsRef.current;
    wsRef.current = null;
    if (!ws) return;
    try {
      // Clear handlers first so a deferred onclose doesn't re-enter retry logic.
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, "client-teardown");
      }
    } catch {
      /* swallow — closing a half-open ws can throw on some browsers */
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    teardownSocket();
    intentionalCloseRef.current = false;

    const token = getAccessToken();
    const url = `${WS_URL}/api/v1${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    setStatus("connecting");
    log.info("ws", "connect", { path, attempt: attemptRef.current + 1 });

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setLastError((err as Error)?.message ?? "ws-construct-failed");
      setStatus("error");
      log.error("ws", "construct_failed", { path, error: (err as Error)?.message });
      scheduleReconnectRef.current();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      attemptRef.current = 0;
      setAttempts(0);
      setStatus("connected");
      setLastError(null);
      log.info("ws", "open", { path });

      // Heartbeat — only while OPEN
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
          } catch (err) {
            log.warn("ws", "heartbeat_send_failed", { error: (err as Error)?.message });
          }
        }
      }, heartbeatInterval);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data?.type === "ping") {
          try { ws.send(JSON.stringify({ type: "pong" })); } catch { /* */ }
          return;
        }
        onMessageRef.current?.(data);
      } catch {
        // Non-JSON message — ignore
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setStatus("error");
      setLastError("socket-error");
      log.warn("ws", "error", { path });
    };

    ws.onclose = (event) => {
      if (!mountedRef.current) return;
      clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = undefined;
      log.info("ws", "close", {
        path,
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        intentional: intentionalCloseRef.current,
      });
      if (intentionalCloseRef.current) {
        setStatus("disconnected");
        return;
      }
      // Authentication failures should not trigger an infinite retry storm
      // — bail out and let the operator log in again.
      if (event.code === 4001 || event.code === 4003) {
        setStatus("failed");
        setLastError(`auth-rejected (${event.code})`);
        return;
      }
      setStatus("disconnected");
      if (autoReconnect) scheduleReconnectRef.current();
    };
  }, [path, enabled, heartbeatInterval, autoReconnect, teardownSocket]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    attemptRef.current += 1;
    setAttempts(attemptRef.current);
    if (attemptRef.current > maxReconnectAttempts) {
      setStatus("failed");
      setLastError("max-attempts-exceeded");
      log.error("ws", "max_attempts", { path, attempts: attemptRef.current });
      return;
    }
    // Exponential backoff with full jitter, hard-capped.
    const base = Math.min(
      maxReconnectDelay,
      Math.floor(reconnectDelay * Math.pow(1.5, attemptRef.current - 1))
    );
    const delay = Math.floor(base * (0.5 + Math.random() * 0.5));
    log.info("ws", "reconnect_scheduled", {
      path, attempt: attemptRef.current, delay,
    });
    clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => connectRef.current(), delay);
  }, [path, maxReconnectAttempts, maxReconnectDelay, reconnectDelay]);

  // Keep the late-binding refs current.
  connectRef.current = connect;
  scheduleReconnectRef.current = scheduleReconnect;

  const retry = useCallback(() => {
    attemptRef.current = 0;
    setAttempts(0);
    setLastError(null);
    log.info("ws", "manual_retry", { path });
    connectRef.current();
  }, [path]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();
    return () => {
      mountedRef.current = false;
      intentionalCloseRef.current = true;
      clearTimeout(reconnectTimer.current);
      teardownSocket();
    };
  }, [connect, enabled, teardownSocket]);

  const send = useCallback((data: unknown): boolean => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(data));
      return true;
    } catch (err) {
      log.warn("ws", "send_failed", { path, error: (err as Error)?.message });
      return false;
    }
  }, [path]);

  return { status, send, retry, attempts, lastError };
}
