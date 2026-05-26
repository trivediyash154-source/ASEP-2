"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCw, Sparkles, LogIn } from "lucide-react";

import { Sidebar } from "@/components/shared/layout/Sidebar";
import { useAuthStore } from "@/lib/stores/auth.store";
import { getAccessToken } from "@/lib/api/client";
import { log } from "@/lib/diagnostics/logger";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useNotificationBus } from "@/lib/hooks/useNotificationBus";
import { IncidentResponseOverlay } from "@/components/shared/incident/IncidentResponseOverlay";

/**
 * Auth gate for /dashboard/* — three-state recovery machine.
 *
 *   bootstrapping → checking → ok          (happy path)
 *                            → stalled     (timed out, recover button)
 *                            → no-session  (redirect to /login)
 *
 * Critical contract: the UI MUST exit the `checking` state within
 * `HARD_TIMEOUT_MS`, even if the backend is unreachable. Without this
 * the dashboard hangs on "VERIFYING SESSION" forever — the original
 * stabilisation bug.
 */
const HARD_TIMEOUT_MS = 6500;

type Phase = "checking" | "ok" | "stalled" | "no-session";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, fetchMe, user } = useAuthStore();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");

  // ── Global operational event bus ──────────────────────────────────
  // Singleton WS subscription. Re-mounted only when this layout itself
  // mounts/unmounts, so navigation between dashboard pages doesn't churn
  // the connection. Internally gated on `isAuthenticated`.
  useNotificationBus();
  const attemptRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const verify = useCallback(async () => {
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    setPhase("checking");

    // No token at all? Skip the round-trip — the user just needs to log in.
    if (!getAccessToken()) {
      log.info("auth", "verify_skip_no_token");
      setPhase("no-session");
      return;
    }

    // Optimistic: if we already have a persisted user, render the dashboard
    // immediately and verify in the background. This keeps the dashboard
    // responsive even if the backend is briefly degraded.
    if (useAuthStore.getState().isAuthenticated && useAuthStore.getState().user) {
      log.info("auth", "verify_optimistic_boot");
      setPhase("ok");
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(() => {
      log.warn("auth", "verify_hard_timeout", { attempt, ms: HARD_TIMEOUT_MS });
      controller.abort();
    }, HARD_TIMEOUT_MS);

    try {
      await fetchMe({ signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    // Re-read state after the call settled.
    const { isAuthenticated: authed, lastError } = useAuthStore.getState();
    if (authed) {
      setPhase("ok");
      log.info("auth", "verify_ok", { attempt });
    } else if (lastError) {
      // Backend reachable but no session, or hard error — depending on token presence.
      if (getAccessToken()) {
        log.warn("auth", "verify_stalled", { attempt, error: lastError });
        setPhase("stalled");
      } else {
        setPhase("no-session");
      }
    } else {
      setPhase("no-session");
    }
  }, [fetchMe]);

  useEffect(() => {
    verify();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "no-session") {
      router.replace("/login");
    }
  }, [phase, router]);

  if (phase === "checking") {
    return <VerifyingScreen onForce={() => setPhase("stalled")} />;
  }

  if (phase === "stalled") {
    return <StalledScreen onRetry={verify} />;
  }

  if (phase === "no-session") {
    // Render nothing while the router redirects.
    return null;
  }

  // phase === "ok" — also covers optimistic boot. Even if the background
  // verification later turns up unauthenticated, the auth store will set
  // isAuthenticated=false and the next protected request will trigger a
  // login redirect.
  if (!isAuthenticated && !user) return <StalledScreen onRetry={verify} />;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        <ErrorBoundary label="dashboard-view">{children}</ErrorBoundary>
      </main>
      {/* Cinematic critical-event overlay (auto-mounts on high/critical events) */}
      <IncidentResponseOverlay />
    </div>
  );
}

// ── Verifying overlay ──────────────────────────────────────────────────

function VerifyingScreen({ onForce }: { onForce: () => void }) {
  // Even though `verify` itself has a HARD_TIMEOUT_MS, surface a manual
  // escape hatch after `MANUAL_ESCAPE_MS` so the operator never sits in
  // front of a spinner with no way out.
  const MANUAL_ESCAPE_MS = 4000;
  const [showEscape, setShowEscape] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowEscape(true), MANUAL_ESCAPE_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center px-4">
        <div className="relative">
          <div className="h-10 w-10 rounded-xl bg-sage-600 flex items-center justify-center ring-1 ring-sage-700/30 shadow-sm">
            <Sparkles className="h-4 w-4 text-sand-50" />
          </div>
          <div className="absolute -inset-2 rounded-2xl border-2 border-sage-400/40 border-t-transparent animate-spin" />
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
          Verifying session
        </p>
        {showEscape && (
          <button
            onClick={onForce}
            className="mt-2 text-2xs font-mono uppercase tracking-[0.16em] text-foreground-subtle hover:text-foreground underline decoration-dotted underline-offset-4"
          >
            Taking too long? Continue without verification
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stalled / recovery screen ──────────────────────────────────────────

function StalledScreen({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  const error = useAuthStore((s) => s.lastError);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="surface-panel p-6 sm:p-8 max-w-md w-full text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-peach-100 dark:bg-peach-900/30 flex items-center justify-center ring-1 ring-peach-300/50">
          <AlertTriangle className="h-5 w-5 text-peach-700 dark:text-peach-300" />
        </div>
        <p className="section-eyebrow mt-4">Session verification stalled</p>
        <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground">
          Unable to reach the platform
        </h2>
        <p className="mt-2 text-xs text-foreground-muted">
          The auth service did not respond in time. This can happen briefly
          when the backend is restarting or the network is unstable. Retry,
          or go to login to start a fresh session.
        </p>
        {error && (
          <p className="mt-3 font-mono text-2xs text-foreground-subtle bg-stone-100 dark:bg-stone-900 px-2 py-1 rounded border border-border">
            {error}
          </p>
        )}
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button variant="primary" size="md" onClick={onRetry} leadingIcon={<RotateCw className="h-3.5 w-3.5" />}>
            Retry now
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={() => router.replace("/login")}
            leadingIcon={<LogIn className="h-3.5 w-3.5" />}
          >
            Go to login
          </Button>
        </div>
      </div>
    </div>
  );
}
