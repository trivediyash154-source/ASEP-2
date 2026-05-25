"use client";

/**
 * Next.js convention: handles errors thrown during render of any route in
 * the app directory. This is the runtime-level safety net that catches
 * throws from server components, layouts, and route handlers — places
 * the React-level ErrorBoundary in Providers can't reach.
 */

import { useEffect } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { log } from "@/lib/diagnostics/logger";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error("render", "route_error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack?.split("\n").slice(0, 6).join("\n"),
    });
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="surface-panel p-6 sm:p-8 max-w-lg w-full">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-peach-100 dark:bg-peach-900/30 flex items-center justify-center ring-1 ring-peach-300/50 shrink-0">
            <AlertTriangle className="h-5 w-5 text-peach-700 dark:text-peach-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="section-eyebrow">Route fault</p>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
              This view did not load
            </h2>
            <p className="mt-1.5 text-xs text-foreground-muted">
              An error occurred while rendering this page. Retry — or jump back
              to the dashboard. The error has been captured in the diagnostics
              ring buffer.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-surface-sunken px-3 py-2.5">
          <p className="text-2xs font-mono uppercase tracking-[0.16em] text-foreground-subtle">
            Captured error
          </p>
          <p className="mt-1 font-mono text-xs text-foreground break-all">
            {error.message || "Unknown error"}
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-2xs text-foreground-subtle">digest: {error.digest}</p>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-sage-600 text-white text-sm font-medium hover:bg-sage-700 transition-colors"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Retry this view
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-surface border border-border text-foreground text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
