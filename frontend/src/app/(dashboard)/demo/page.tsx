"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Radio, Sparkles } from "lucide-react";

import { TopBar } from "@/components/shared/layout/TopBar";
import { DemoSurveillanceConsole } from "@/components/cameras/demo/DemoSurveillanceConsole";
import { ControlledReplayConsole } from "@/components/cameras/demo/controlled/ControlledReplayConsole";
import { LiveEventRail } from "@/components/shared/event-rail/LiveEventRail";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { cn } from "@/lib/utils";

type Mode = "controlled" | "live";

const TABS: { id: Mode; label: string; sublabel: string; icon: typeof Radio }[] = [
  {
    id: "controlled",
    label: "Controlled replay",
    sublabel: "Deterministic — for stakeholder demos",
    icon: Sparkles,
  },
  {
    id: "live",
    label: "Live theatre",
    sublabel: "Mobile camera ingest — live RTSP",
    icon: Radio,
  },
];

export default function DemoPage() {
  // Default to Controlled for high-stakes demos. Operators can toggle to
  // Live Theatre for end-to-end ingest testing.
  const [mode, setMode] = useState<Mode>("controlled");

  return (
    <>
      <TopBar
        eyebrow="Demo theatre"
        title={mode === "controlled" ? "Controlled replay console" : "Live mobile-camera theatre"}
        subtitle={
          mode === "controlled"
            ? "Operator-driven AI pipeline replay against a curated case library — same outcome, every run."
            : "Mobile camera ingest · ANPR pipeline · concurrent compliance · automatic enforcement."
        }
      />
      <RoleGuard capability="replay:run" label="Live Theatre">
        <div>
        {/* ── Mode switcher ──────────────────────────────────────────── */}
        <div className="px-4 sm:px-6 pt-3">
        <div
          role="tablist"
          aria-label="Demo mode"
          className="inline-flex items-stretch gap-1 p-1 rounded-xl border border-border bg-surface shadow-card"
        >
          {TABS.map((t) => {
            const active = t.id === mode;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setMode(t.id)}
                className={cn(
                  "relative inline-flex items-center gap-2 px-3.5 sm:px-4 h-11 rounded-lg text-left transition-colors",
                  active
                    ? "text-foreground"
                    : "text-foreground-muted hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="demo-mode-pill"
                    className="absolute inset-0 rounded-lg bg-sage-100 dark:bg-sage-900/40 ring-1 ring-sage-300/60 dark:ring-sage-700/60"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon
                  className={cn(
                    "relative h-4 w-4 shrink-0",
                    active
                      ? "text-sage-700 dark:text-sage-200"
                      : "text-foreground-subtle",
                  )}
                />
                <span className="relative">
                  <span className="block text-sm font-semibold tracking-tight leading-none">
                    {t.label}
                  </span>
                  <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-subtle mt-1 leading-none">
                    {t.sublabel}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Live event rail ────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-3">
        <LiveEventRail />
      </div>

      {/* ── Mode body ──────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-4">
        {mode === "controlled" ? (
          <ControlledReplayConsole />
        ) : (
          <DemoSurveillanceConsole />
        )}
        </div>
        </div>
      </RoleGuard>
    </>
  );
}
