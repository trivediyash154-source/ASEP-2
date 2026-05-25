"use client";

/**
 * Last-resort error UI when even the root layout fails. This file MUST
 * include its own <html>/<body> because it replaces the root layout
 * itself when triggered. Keep the dependencies and styling minimal —
 * we cannot assume the design system loaded successfully.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Defensive: the structured logger might be the thing that broke.
    try {
      // eslint-disable-next-line no-console, @typescript-eslint/no-require-imports
      const { log } = require("@/lib/diagnostics/logger");
      log.error("render", "global_error", {
        message: error.message,
        digest: error.digest,
      });
    } catch {
      // eslint-disable-next-line no-console
      console.error("[global-error]", error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#141210",
          color: "#e3ddd6",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            background: "#1b1814",
            border: "1px solid #352e28",
            borderRadius: 12,
            padding: 28,
            boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#9b9089",
              margin: 0,
            }}
          >
            System fault
          </p>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              margin: "4px 0 12px",
            }}
          >
            VAAHAN AI failed to start
          </h1>
          <p style={{ fontSize: 13, color: "#9b9089", marginBottom: 20, lineHeight: 1.5 }}>
            A fatal error prevented the operator console from loading. You can
            try to recover, or reload the entire app.
          </p>
          <div
            style={{
              background: "#0f0e0c",
              border: "1px solid #352e28",
              borderRadius: 8,
              padding: "10px 12px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              color: "#e3ddd6",
              wordBreak: "break-all",
              marginBottom: 20,
            }}
          >
            {error.message || "Unknown error"}
            {error.digest ? <div style={{ color: "#67615a", marginTop: 4 }}>digest: {error.digest}</div> : null}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                background: "#67705E",
                color: "white",
                border: 0,
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try to recover
            </button>
            <button
              onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}
              style={{
                background: "transparent",
                color: "#e3ddd6",
                border: "1px solid #4a4038",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
