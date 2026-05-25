"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Receipt } from "lucide-react";
import { useEffect, useState } from "react";

import type { LiveDetectionEvent } from "@/lib/stores/cameras.store";
import { formatCurrency } from "@/lib/utils";

interface Props {
  event: LiveDetectionEvent | null;
  triggerKey: number;
  ttlMs?: number;
}

const FINE_BY_TYPE: Record<string, number> = {
  "Blacklisted Vehicle":    10000,
  "Expired Registration":    5000,
  "Speeding":                3000,
  "Expired Insurance":       2000,
  "Expired Pollution Cert":  1500,
  "Signal Jump":             1500,
};

function fineFor(type?: string | null): number {
  if (!type) return 1500;
  return FINE_BY_TYPE[type] ?? 1500;
}

function challanNumber(eventId: string): string {
  let h = 0;
  for (let i = 0; i < eventId.length; i++) h = ((h << 5) - h + eventId.charCodeAt(i)) | 0;
  const n = Math.abs(h % 999999).toString().padStart(6, "0");
  return `CH-${new Date().getFullYear()}-${n}`;
}

/**
 * Top-right "CHALLAN ISSUED" badge that slides in on every violation event,
 * sits for `ttlMs`, then slides out. Composes with the in-feed dossier and
 * evidence flash for a complete enforcement ceremony.
 */
export function ChallanCeremony({ event, triggerKey, ttlMs = 3800 }: Props) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!event || triggerKey === 0) return;
    if (!event.is_violation) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), ttlMs);
    return () => clearTimeout(t);
  }, [triggerKey, event, ttlMs]);

  if (!event) return null;
  const fine = fineFor(event.violation_type);
  const id = challanNumber(event.id);

  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          key={triggerKey}
          initial={{ opacity: 0, y: -14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-12 right-3 z-30 pointer-events-none"
        >
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-peach-300/40 bg-stone-950/85 backdrop-blur-md shadow-popover">
            <div className="h-7 w-7 rounded-full bg-peach-500/15 border border-peach-300/30 flex items-center justify-center">
              <Receipt className="h-3.5 w-3.5 text-peach-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-peach-200">
                <CheckCircle2 className="h-3 w-3" />
                <span className="font-mono text-2xs font-semibold uppercase tracking-[0.18em]">
                  Challan issued
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2.5 text-stone-200">
                <span className="font-mono text-xs tracking-[0.06em]">{id}</span>
                <span className="h-3 w-px bg-stone-100/15" />
                <span className="font-display text-sm font-semibold tabular-nums">
                  {formatCurrency(fine)}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
