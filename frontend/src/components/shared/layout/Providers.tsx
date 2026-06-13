"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { log } from "@/lib/diagnostics/logger";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
            refetchOnWindowFocus: false,
          },
          mutations: { retry: 1 },
        },
      })
  );

  // Catch escaped errors that don't bubble through React (async, event handlers).
  // The ErrorBoundary handles render-time throws; these listeners handle the rest.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onError = (ev: ErrorEvent) => {
      log.error("render", "window_error", {
        message: ev.message,
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
      });
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason as unknown;
      log.error("render", "unhandled_rejection", {
        message: (reason as Error)?.message ?? String(reason),
        stack: (reason as Error)?.stack?.split("\n").slice(0, 4).join("\n"),
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <ErrorBoundary>
      {/* Premium light is the default first impression; cinematic dark is
          one toggle away. storageKey is versioned so the new default applies
          even where an older preference was persisted. */}
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="vaahan-theme-v3" disableTransitionOnChange={false}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200} skipDelayDuration={120}>
            {children}
          </TooltipProvider>
          <ThemedToaster />
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="top-right"
      expand={false}
      closeButton
      duration={4000}
      offset={20}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{
        classNames: {
          title: "font-semibold",
          description: "text-xs opacity-80",
          actionButton: "bg-sage-600 text-white text-xs font-semibold",
          cancelButton: "bg-stone-100 dark:bg-stone-800 text-xs",
          success: "[&_[data-icon]]:text-status-success",
          warning: "[&_[data-icon]]:text-status-warning",
          error: "[&_[data-icon]]:text-status-danger",
          info: "[&_[data-icon]]:text-status-info",
        },
        style: {
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: "13px",
          borderRadius: "10px",
        },
      }}
    />
  );
}
