"use client";

import { motion } from "framer-motion";

import { CommandStatusBar } from "./CommandStatusBar";
import { SituationBriefing } from "./SituationBriefing";
import { CommandReadout } from "./CommandReadout";
import { ThreatFeed } from "./ThreatFeed";
import { IntelligenceCanvas } from "./IntelligenceCanvas";
import { EnforcementQueuePanel } from "./EnforcementQueuePanel";
import { CameraNetworkStrip } from "./CameraNetworkStrip";
import { ZoneHeatBoard } from "./ZoneHeatBoard";
import { EvidenceStrip } from "@/components/cameras/EvidenceStrip";
import { EvidenceDrawer } from "@/components/cameras/EvidenceDrawer";

/**
 * COMMAND CENTER — a zoned operations screen, not a scrolling dashboard.
 *
 * On desktop the whole theatre fits the viewport; each zone scrolls
 * internally, like a physical console wall:
 *
 *   ┌─ status ribbon + instruments ───────────────────────────────┐
 *   ├──────────┬──────────────────────────────┬───────────────────┤
 *   │ THREAT   │  LIVE INTELLIGENCE LAYER     │ ENFORCEMENT       │
 *   │ FEED     │  theatre map · last AI read  │ QUEUE             │
 *   │ (live)   │  · 24h activity pulse        │ (open cases)      │
 *   ├──────────┴──────────────────────────────┴───────────────────┤
 *   └─ camera network status board ───────────────────────────────┘
 *
 * Below xl the zones stack and the page scrolls normally.
 */

const enter = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
});

export function CommandCenterView() {
  return (
    <div className="w-full px-4 sm:px-5 py-4 flex flex-col gap-4">
      {/* ════ THE WALL — fills the first viewport exactly ════════ */}
      <div className="flex flex-col gap-4 xl:h-[calc(100dvh-6rem)] xl:min-h-[620px]">
        {/* ── Operational ribbon ───────────────────────────────── */}
        <motion.div {...enter(0)} className="shrink-0">
          <CommandStatusBar />
        </motion.div>
        <motion.div {...enter(0.03)} className="shrink-0">
          <SituationBriefing />
        </motion.div>
        <motion.div {...enter(0.06)} className="shrink-0">
          <CommandReadout compact />
        </motion.div>

        {/* ── Theatre row ──────────────────────────────────────── */}
        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)_320px] gap-4">
          <motion.div {...enter(0.1)} className="min-h-[320px] xl:min-h-0 xl:h-full flex flex-col">
            <ThreatFeed className="flex-1" />
          </motion.div>
          <motion.div {...enter(0.14)} className="min-h-[480px] xl:min-h-0 xl:h-full flex flex-col">
            <IntelligenceCanvas className="flex-1" />
          </motion.div>
          <motion.div {...enter(0.18)} className="min-h-[320px] xl:min-h-0 xl:h-full flex flex-col">
            <EnforcementQueuePanel className="flex-1" />
          </motion.div>
        </div>

        {/* ── Network board ────────────────────────────────────── */}
        <motion.div {...enter(0.24)} className="shrink-0">
          <CameraNetworkStrip />
        </motion.div>
      </div>

      {/* ════ DEEPER INTELLIGENCE — revealed on scroll ═══════════ */}
      <div className="flex items-center gap-3 pt-1">
        <span className="font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-foreground-subtle whitespace-nowrap">
          Deeper Intelligence
        </span>
        <span className="hairline flex-1" aria-hidden />
      </div>
      <motion.div {...enter(0.05)} className="min-w-0">
        <EvidenceStrip />
      </motion.div>
      <motion.div {...enter(0.1)} className="min-w-0">
        <ZoneHeatBoard />
      </motion.div>

      {/* Forensic drawer — lets the evidence strip open full case detail
          without leaving the command center */}
      <EvidenceDrawer />
    </div>
  );
}
