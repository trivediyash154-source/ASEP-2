"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * "subtle" — light glass, for embedded cards inside a brighter context
   * "default" — the standard login-panel surface
   * "elevated" — strongest blur + deepest shadow, for the active hero card
   */
  variant?: "subtle" | "default" | "elevated";
  /** Show the soft 1px inner highlight along the top edge. */
  highlight?: boolean;
}

/**
 * GlassPanel — backdrop-filter frosted surface with brand-safe tinting.
 *
 * Three surfaces compose the depth:
 *   1. Backdrop blur (16–24px) softens whatever's behind
 *   2. Semi-transparent fill in the brand surface color
 *   3. Inner top hairline + outer ambient + tight contact shadow
 *
 * The fill stays on the surface color so the existing brand background
 * shows through faithfully — this avoids the "purple iCloud" look glass
 * panels often slide into.
 */
export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  function GlassPanel(
    { variant = "default", highlight = true, className, children, ...rest },
    ref,
  ) {
    const variants = {
      subtle:
        "bg-surface/50 backdrop-blur-md ring-1 ring-white/40 border border-border/60 shadow-[0_10px_30px_-14px_rgba(15,23,42,0.18)]",
      default:
        "bg-surface/70 backdrop-blur-xl ring-1 ring-white/55 border border-border/70 shadow-[0_28px_70px_-24px_rgba(15,23,42,0.25),0_2px_4px_-2px_rgba(15,23,42,0.08)]",
      elevated:
        "bg-surface/80 backdrop-blur-2xl ring-1 ring-white/70 border border-white/60 shadow-[0_40px_90px_-28px_rgba(15,23,42,0.32),0_4px_8px_-4px_rgba(15,23,42,0.10)]",
    } as const;

    return (
      <div
        ref={ref}
        className={cn(
          "relative rounded-2xl overflow-hidden",
          variants[variant],
          className,
        )}
        {...rest}
      >
        {highlight && (
          <>
            {/* Static hairline */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent"
            />
            {/* Slow scanning beam — sweeps across once every ~9s */}
            {variant === "elevated" && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px login-scan-beam"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(196,167,125,0.85) 50%, transparent 100%)",
                }}
              />
            )}
          </>
        )}
        {children}
      </div>
    );
  },
);
