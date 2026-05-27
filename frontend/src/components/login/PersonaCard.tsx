"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  icon: React.ElementType;
  title: string;
  badge: string;
  description: string;
  caption: string;
  active: boolean;
  onClick: () => void;
}

/**
 * Persona pick. Three states matter:
 *   - resting: neutral glass card with hairline highlight
 *   - hover:   subtle lift (-2px) and accent-tinted border
 *   - active:  neon edge glow + corner check + animated sheen sweep
 *
 * The active sheen is a CSS-only translate that runs every 4.5s — soft
 * enough to read as ambient instead of distracting. Disabled at the
 * OS level via `prefers-reduced-motion`.
 */
export function PersonaCard({
  icon: Icon,
  title,
  badge,
  description,
  caption,
  active,
  onClick,
}: Props) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      aria-pressed={active}
      className={cn(
        "group relative w-full text-left rounded-2xl p-3.5 overflow-hidden",
        "flex items-center gap-3",
        "bg-surface/60 backdrop-blur-md ring-1 transition-all duration-200",
        active
          ? "ring-sage-400/90 border border-sage-300/70 shadow-[0_24px_60px_-22px_rgba(127,136,118,0.7),0_0_0_1px_rgba(255,255,255,0.7)_inset,0_0_28px_-6px_rgba(196,167,125,0.45)]"
          : "ring-white/55 border border-border/70 hover:border-sage-300/60 hover:bg-surface/85 hover:ring-sage-200/60 shadow-[0_10px_26px_-16px_rgba(15,23,42,0.22)] hover:shadow-[0_18px_38px_-18px_rgba(127,136,118,0.35)]",
      )}
    >
      {/* Soft top hairline */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent"
      />

      {/* Active neon halo (behind everything) */}
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-2xl"
          style={{
            background:
              "radial-gradient(80% 60% at 0% 50%, rgba(127,136,118,0.20) 0%, transparent 60%), radial-gradient(70% 60% at 100% 50%, rgba(196,167,125,0.18) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Idle shimmer on active card */}
      {active && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 login-shimmer"
          style={{
            background:
              "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.55) 50%, transparent 65%)",
            mixBlendMode: "soft-light",
          }}
        />
      )}

      {/* Icon medallion */}
      <span
        className={cn(
          "relative z-10 h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-colors",
          active
            ? "bg-sage-600 text-white ring-1 ring-sage-700/40 shadow-[0_8px_24px_-8px_rgba(127,136,118,0.7)]"
            : "bg-sage-100 text-sage-800 ring-1 ring-sage-200 group-hover:bg-sage-200",
        )}
      >
        <Icon className="h-4 w-4" />
        {active && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-sage-500 text-white flex items-center justify-center ring-2 ring-surface">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        )}
      </span>

      {/* Copy */}
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground tracking-tight">
            {title}
          </span>
          <span className="font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
            {badge}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-foreground-muted text-pretty leading-relaxed">
          {description}
        </p>
      </div>

      <span
        className={cn(
          "relative z-10 text-2xs font-semibold uppercase tracking-[0.14em] shrink-0",
          active ? "text-sage-700" : "text-foreground-subtle",
        )}
      >
        {caption}
      </span>
    </motion.button>
  );
}
