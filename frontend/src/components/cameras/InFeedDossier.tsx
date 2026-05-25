"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  FileWarning,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import { buildDossier, type ComplianceStatus } from "@/lib/intel/vehicleDossier";
import type { LiveDetectionEvent } from "@/lib/stores/cameras.store";
import { cn } from "@/lib/utils";

import { OCRReveal } from "./primitives/OCRReveal";

interface Props {
  event: LiveDetectionEvent | null;
  triggerKey: number;
  /** ms after which the dossier auto-dismisses */
  ttlMs?: number;
  /** If true, suppress on compliant detections (alerts only) */
  onViolationsOnly?: boolean;
}

/**
 * Glassmorphic in-feed intelligence card. Slides up from the bottom of the
 * camera viewport on each new detection, auto-dismisses after `ttlMs`. Designed
 * to be overlaid inside a `<CameraFeedCanvas>` so it composes with the bbox
 * pulse and evidence flash for the full enforcement moment.
 *
 * Owner / insurance / RC / PUC values are deterministically synthesised from
 * the plate hash so each plate produces a stable, believable dossier. In
 * production these are sourced from the registry lookup.
 */
export function InFeedDossier({
  event,
  triggerKey,
  ttlMs = 5400,
  onViolationsOnly = false,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!event || triggerKey === 0) return;
    if (onViolationsOnly && !event.is_violation) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), ttlMs);
    return () => clearTimeout(t);
  }, [triggerKey, event, ttlMs, onViolationsOnly]);

  if (!event) return null;
  const plate = event.plate ?? "—";
  const violation = !!event.is_violation;
  const d = buildDossier(plate, event.violation_type);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={triggerKey}
          initial={{ opacity: 0, y: 28, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-3 right-3 bottom-3 z-30 pointer-events-none"
        >
          <div className="mx-auto max-w-[440px] rounded-xl border border-stone-100/15 bg-stone-950/82 backdrop-blur-md shadow-popover overflow-hidden">
            {/* Top strip */}
            <div
              className={cn(
                "flex items-center gap-2 px-4 py-2 border-b border-stone-100/10",
                violation
                  ? "bg-peach-500/15 text-peach-200"
                  : "bg-sage-500/10 text-sage-200"
              )}
            >
              {violation ? (
                <ShieldAlert className="h-3.5 w-3.5" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              <span className="font-mono text-2xs font-semibold uppercase tracking-[0.20em]">
                {violation ? "Intelligence · Alert" : "Intelligence · Compliant"}
              </span>
              <span className="ml-auto font-mono text-2xs text-stone-500 tracking-[0.06em]">
                VAAHAN ID #{d.vaahanId}
              </span>
            </div>

            {/* Body */}
            <div className="p-4 grid grid-cols-[auto_1fr_auto] gap-3 items-center text-stone-200">
              {/* Plate chip with OCR reveal */}
              <span className="inline-flex items-center h-8 px-2.5 rounded-md font-mono text-base font-semibold tracking-[0.10em] bg-stone-100 text-stone-900 border border-stone-300/30">
                <OCRReveal text={plate} triggerKey={triggerKey} />
              </span>

              {/* Owner */}
              <div className="min-w-0">
                <p className="text-2xs uppercase tracking-[0.16em] text-stone-500 font-semibold">
                  Registered owner
                </p>
                <p className="text-sm font-display font-semibold truncate">{d.owner.name}</p>
                <p className="mt-0.5 text-2xs text-stone-400 truncate font-mono">
                  {d.vehicle.make} {d.vehicle.model} · {d.vehicle.year}
                </p>
              </div>

              {/* Risk ring */}
              <RiskRing value={d.risk.score} violation={violation} />
            </div>

            {/* Compliance grid */}
            <div className="px-4 pb-4 grid grid-cols-2 gap-x-3 gap-y-2.5">
              <DossierField label="Insurance" status={d.compliance.insurance} />
              <DossierField label="Registration" status={d.compliance.rc} />
              <DossierField label="Pollution Cert" status={d.compliance.puc} />
              <DossierField
                label="Prior encounters"
                status={{
                  ok: d.risk.priorEncounters < 3,
                  text: d.risk.repeatOffender
                    ? `${d.risk.priorEncounters} · REPEAT`
                    : `${d.risk.priorEncounters} flagged`,
                }}
              />
            </div>

            {/* Enforcement footer */}
            {violation && (
              <div className="px-4 py-2.5 border-t border-stone-100/10 bg-peach-500/[0.08] flex items-center gap-2 text-peach-200">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="text-2xs font-semibold uppercase tracking-[0.16em]">
                  Auto-enforcement recommended
                </span>
                <span className="ml-auto font-mono text-2xs text-peach-300/90">
                  Routed → challan queue
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DossierField({
  label,
  status,
}: {
  label: string;
  status: ComplianceStatus;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs uppercase tracking-[0.14em] text-stone-500 font-semibold">
        {label}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono text-xs font-semibold",
          status.ok ? "text-sage-300" : "text-peach-300"
        )}
      >
        {status.ok ? (
          <ShieldCheck className="h-3 w-3" />
        ) : (
          <FileWarning className="h-3 w-3" />
        )}
        {status.text}
      </span>
    </div>
  );
}

function RiskRing({
  value,
  violation,
}: {
  value: number;
  violation: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const accent = violation ? "#ED9F7E" : "#A9B394";
  return (
    <div className="relative shrink-0 h-12 w-12">
      <svg viewBox="0 0 36 36" className="-rotate-90 h-full w-full">
        <circle
          cx="18"
          cy="18"
          r="15.915"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="3"
        />
        <motion.circle
          cx="18"
          cy="18"
          r="15.915"
          fill="none"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ strokeDasharray: "0 100" }}
          animate={{ strokeDasharray: `${pct} ${100 - pct}` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display text-sm font-semibold tabular-nums leading-none"
          style={{ color: accent }}
        >
          {pct}
        </span>
        <span className="font-mono text-[0.5rem] tracking-[0.18em] text-stone-500 mt-0.5">
          RISK
        </span>
      </div>
    </div>
  );
}
