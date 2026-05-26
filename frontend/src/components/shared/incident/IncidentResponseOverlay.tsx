"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  FileText,
  Fingerprint,
  Radio,
  ShieldAlert,
  X,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useNotificationsStore,
  selectPendingIncident,
} from "@/lib/stores/notifications.store";

/**
 * Cinematic full-screen overlay that auto-fires when the notifications store
 * sees a `high` / `critical` event. Three-act sequence:
 *
 *   1. "AI LOCK"          — sweeping crosshair animation, sub-second
 *   2. "ESCALATION"       — banner slides up with violation + threat score
 *   3. "DOSSIER READY"    — primary CTA into the evidence panel
 *
 * The overlay is dismissable with Esc, the X button, or any of the actions.
 * `consumeIncident()` is called on every exit so the same event never re-fires.
 */
const ENTRY_DURATION_MS = 1800;       // length of the AI-LOCK animation
const AUTO_DISMISS_MS = 14_000;       // hard ceiling if the operator does nothing

type Phase = "lock" | "engaged" | "exiting";

const SEVERITY_PALETTE = {
  critical: {
    accent: "var(--status-danger, #d23a3a)",
    ringClass: "ring-status-danger/70",
    chipClass: "bg-status-danger text-white",
    label: "CRITICAL · CODE RED",
  },
  high: {
    accent: "#bd8658",
    ringClass: "ring-[#bd8658]/70",
    chipClass: "bg-[#bd8658] text-white",
    label: "HIGH SEVERITY",
  },
} as const;

export function IncidentResponseOverlay() {
  const router = useRouter();
  const incident = useNotificationsStore(selectPendingIncident);
  const consume = useNotificationsStore((s) => s.consumeIncident);

  const [phase, setPhase] = useState<Phase>("lock");

  // Reset phase whenever a new incident arrives
  useEffect(() => {
    if (!incident) return;
    setPhase("lock");
    const t1 = setTimeout(() => setPhase("engaged"), ENTRY_DURATION_MS);
    const t2 = setTimeout(() => closeOverlay(), AUTO_DISMISS_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident?.id]);

  // Esc dismiss
  useEffect(() => {
    if (!incident) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident?.id]);

  function closeOverlay() {
    setPhase("exiting");
    // Let the exit animation finish before clearing the store flag
    setTimeout(consume, 260);
  }

  function openEvidence() {
    if (incident?.detection_id) router.push(`/evidence?detection=${incident.detection_id}`);
    closeOverlay();
  }

  function openDossier() {
    if (incident?.detection_id) router.push(`/evidence?detection=${incident.detection_id}`);
    closeOverlay();
  }

  if (!incident) return null;

  // High / critical only — anything else shouldn't have been queued.
  const palette =
    incident.severity === "critical" ? SEVERITY_PALETTE.critical :
    incident.severity === "high"     ? SEVERITY_PALETTE.high :
                                        SEVERITY_PALETTE.high;

  return (
    <AnimatePresence>
      {phase !== "exiting" && (
        <motion.div
          key={incident.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/72 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-label="Incident response"
        >
          {/* Pulsing vignette tinted by severity */}
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.25, 0.65, 0.25] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow: `inset 0 0 240px 40px ${palette.accent}`,
            }}
          />

          {/* AI-LOCK crosshair (phase 1) */}
          {phase === "lock" && (
            <CrosshairLock accent={palette.accent} />
          )}

          {/* Engagement card (phase 2) */}
          {phase === "engaged" && (
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative w-[560px] max-w-[94vw] rounded-2xl bg-surface text-foreground border border-border shadow-popover overflow-hidden ring-2",
                palette.ringClass,
              )}
            >
              {/* Top severity band */}
              <div
                className={cn("flex items-center justify-between px-4 py-2.5 font-mono text-2xs font-bold uppercase tracking-[0.18em]", palette.chipClass)}
              >
                <span className="inline-flex items-center gap-2">
                  <AlertOctagon className="h-3.5 w-3.5" />
                  {palette.label}
                </span>
                <button
                  onClick={closeOverlay}
                  className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-black/15 transition-colors"
                  aria-label="Acknowledge and close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: `${palette.accent}22`,
                      color: palette.accent,
                    }}
                  >
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="section-eyebrow">Incident · {incident.id.slice(0, 8)}</p>
                    <h2 className="mt-0.5 font-display text-lg font-semibold tracking-tight leading-tight">
                      {incident.title}
                    </h2>
                    <p className="mt-1 text-sm text-foreground-muted">
                      {incident.detail}
                    </p>
                  </div>
                </div>

                {/* Telemetry strip */}
                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  <Stat
                    label="Threat"
                    icon={Zap}
                    value={incident.threat_score != null ? `${incident.threat_score}/100` : "—"}
                    accent={palette.accent}
                  />
                  <Stat
                    label="Plate"
                    icon={Fingerprint}
                    value={incident.plate ?? "—"}
                    mono
                  />
                  <Stat
                    label="OCR"
                    icon={Radio}
                    value={
                      incident.ocr_confidence != null
                        ? `${(incident.ocr_confidence * 100).toFixed(0)}%`
                        : "—"
                    }
                    mono
                  />
                </div>

                {incident.district && (
                  <p className="mt-3 font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
                    Source · {incident.district}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    onClick={closeOverlay}
                    className="inline-flex items-center justify-center h-9 px-3.5 rounded-lg border border-border bg-surface text-sm font-semibold text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={openEvidence}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-border bg-surface text-sm font-semibold text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Open evidence
                  </button>
                  <button
                    onClick={openDossier}
                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ background: palette.accent }}
                  >
                    <Fingerprint className="h-3.5 w-3.5" />
                    Open dossier
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Phase-1 crosshair (the AI-LOCK animation) ──────────────────────────

function CrosshairLock({ accent }: { accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="relative flex items-center justify-center"
    >
      {/* Outer corner brackets converging */}
      <motion.svg
        viewBox="0 0 240 240"
        width={240}
        height={240}
        initial={{ scale: 1.4, rotate: 0, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{ color: accent }}
        className="absolute"
      >
        {/* Four L-shaped corner brackets */}
        {[
          [10, 10, 60, 10, 10, 60],
          [230, 10, 180, 10, 230, 60],
          [10, 230, 60, 230, 10, 180],
          [230, 230, 180, 230, 230, 180],
        ].map((c, i) => (
          <polyline
            key={i}
            points={`${c[0]},${c[3]} ${c[0]},${c[1]} ${c[4]},${c[5]}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          />
        ))}
      </motion.svg>

      {/* Spinning ring */}
      <motion.div
        className="h-32 w-32 rounded-full border-2 border-transparent"
        style={{ borderTopColor: accent, borderRightColor: accent }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
      />

      {/* Centre crosshair + LOCKED text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="font-mono text-2xs font-bold uppercase tracking-[0.32em] text-white/85"
          style={{ textShadow: `0 0 14px ${accent}` }}
        >
          AI · LOCK
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.4 }}
          className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55"
        >
          ENGAGING DOSSIER
        </motion.div>
      </div>

      {/* Sweep line */}
      <motion.div
        aria-hidden
        initial={{ rotate: -45, opacity: 0 }}
        animate={{ rotate: 315, opacity: [0, 0.7, 0] }}
        transition={{ duration: 1.4, ease: "linear" }}
        className="absolute h-32 w-px origin-bottom"
        style={{ background: accent, top: "calc(50% - 64px)" }}
      />
    </motion.div>
  );
}

// ─── Tiny stat tile ─────────────────────────────────────────────────────

function Stat({
  label,
  icon: Icon,
  value,
  mono,
  accent,
}: {
  label: string;
  icon: typeof Zap;
  value: string;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="h-3 w-3 text-foreground-subtle" />
        <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">{label}</span>
      </div>
      <p
        className={cn("text-sm font-bold tabular-nums leading-tight", mono && "font-mono")}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
