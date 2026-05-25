"use client";

/**
 * Top-level React error boundary.
 *
 * Renders an operational fallback whenever a child throws during render,
 * lifecycle, or effect commit. Recovery is one click — `reset()` clears
 * the boundary state and re-mounts the children. The captured error is
 * logged to the diagnostics ring buffer.
 *
 * This is the LAST line of defence: the entire app is wrapped in one of
 * these at the root layout, so a throw anywhere in the tree degrades
 * gracefully into a recoverable surface instead of a blank white screen.
 */
import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { log } from "@/lib/diagnostics/logger";

interface Props {
  children: ReactNode;
  /** Optional override label for the boundary — useful for nested boundaries. */
  label?: string;
  /** Render a custom fallback instead of the default panel. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error("render", "boundary_caught", {
      label: this.props.label ?? "root",
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 6).join("\n"),
      componentStack: info.componentStack?.split("\n").slice(0, 6).join("\n"),
    });
  }

  reset = (): void => {
    log.info("render", "boundary_reset", { label: this.props.label ?? "root" });
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }
    return <DefaultFallback error={this.state.error} reset={this.reset} label={this.props.label} />;
  }
}

function DefaultFallback({
  error,
  reset,
  label,
}: {
  error: Error;
  reset: () => void;
  label?: string;
}) {
  const goHome = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/dashboard";
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="surface-panel p-6 sm:p-8 max-w-lg w-full">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-peach-100 dark:bg-peach-900/30 flex items-center justify-center ring-1 ring-peach-300/50 shrink-0">
            <AlertTriangle className="h-5 w-5 text-peach-700 dark:text-peach-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="section-eyebrow">Operational fault</p>
            <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
              {label ? `Section "${label}" crashed` : "The operator console crashed"}
            </h2>
            <p className="mt-1.5 text-xs text-foreground-muted">
              The interface caught an unexpected error before it could propagate.
              You can recover this section or return to the dashboard — no data
              has been lost.
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
        </div>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-sage-600 text-white text-sm font-medium hover:bg-sage-700 transition-colors"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Recover this section
          </button>
          <button
            onClick={goHome}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-surface border border-border text-foreground text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            Go to dashboard
          </button>
        </div>

        <p className="mt-4 text-2xs text-foreground-subtle font-mono">
          Diagnostics: open the browser console — recent logs are also retained
          on <span className="text-foreground">window.__VAAHAN_LOGS__</span>.
        </p>
      </div>
    </div>
  );
}
