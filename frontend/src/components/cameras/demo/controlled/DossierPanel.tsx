"use client";

import { motion } from "framer-motion";
import {
  AlertOctagon, ArrowRight, BadgeAlert, BadgeCheck, Brain, Calendar, FileText,
  Fingerprint, Mail, MapPin, Phone, Shield, ShieldAlert, Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { DecisionSignal, DemoReplayPayload } from "@/lib/api/endpoints";

interface Props {
  payload: DemoReplayPayload;
  onAnother: () => void;
}

const SEV_COLOR: Record<DemoReplayPayload["outcome"]["severity"], { ring: string; chip: string; bar: string; text: string; label: string }> = {
  info:     { ring: "ring-sage-500/30",      chip: "bg-sage-500/15 text-sage-800 dark:text-sage-100",  bar: "from-sage-500 to-sage-400",   text: "text-sage-700 dark:text-sage-200",   label: "CLEAN PASS" },
  low:      { ring: "ring-peach-400/40",     chip: "bg-peach-500/15 text-peach-800 dark:text-peach-100", bar: "from-peach-400 to-peach-300", text: "text-peach-700 dark:text-peach-200", label: "LOW SEVERITY" },
  medium:   { ring: "ring-peach-500/50",     chip: "bg-peach-500/20 text-peach-800 dark:text-peach-100", bar: "from-peach-500 to-peach-400", text: "text-peach-800 dark:text-peach-100", label: "MEDIUM SEVERITY" },
  high:     { ring: "ring-[#bd8658]/60",     chip: "bg-[#bd8658]/20 text-[#7a4a28] dark:text-[#fcc99a]", bar: "from-[#bd8658] to-[#ed9f7e]", text: "text-[#7a4a28] dark:text-[#fcc99a]", label: "HIGH SEVERITY" },
  critical: { ring: "ring-status-danger/60", chip: "bg-status-danger/15 text-status-danger",          bar: "from-status-danger to-[#ed5252]", text: "text-status-danger",                 label: "CRITICAL" },
};

export function DossierPanel({ payload, onAnother }: Props) {
  const sev = SEV_COLOR[payload.outcome.severity];
  const compliance = payload.compliance;
  const violation = payload.outcome.is_violation;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-3"
    >
      {/* ── Header banner ──────────────────────────────────────────── */}
      <div className={cn("surface-panel-elevated p-4 sm:p-5 ring-2", sev.ring)}>
        <div className="flex items-start gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", sev.chip)}>
            {violation ? <ShieldAlert className="h-5 w-5" /> : <BadgeCheck className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="section-eyebrow">Forensic dossier · {payload.detection_id.slice(0, 8)}</span>
              <span className={cn("inline-flex items-center h-5 px-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.16em]", sev.chip)}>
                {sev.label}
              </span>
            </div>
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground leading-tight">
              {violation ? payload.outcome.violation_type : "All compliance signals green"}
            </h3>
            <p className="mt-1 text-xs text-foreground-muted">
              {payload.case_subtitle} · captured at {payload.camera.name}
            </p>
          </div>
          <button
            onClick={onAnother}
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:border-border-strong hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
          >
            Replay another <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Threat score bar */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">Threat score</span>
            <span className={cn("font-mono text-base font-bold tabular-nums tracking-tight", sev.text)}>
              {payload.outcome.threat_score}<span className="text-foreground-subtle/60 text-xs">/100</span>
            </span>
          </div>
          <div className="relative h-1.5 rounded-full bg-stone-200/50 dark:bg-stone-800/50 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${payload.outcome.threat_score}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", sev.bar)}
            />
          </div>
        </div>
      </div>

      {/* ── 3-column grid: vehicle · owner · compliance ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Vehicle */}
        <Section title="Vehicle" icon={Fingerprint}>
          <KV label="Registration" value={<span className="font-mono font-bold tracking-wider">{payload.vehicle.plate}</span>} />
          <KV label="Make · Model" value={`${payload.vehicle.make} ${payload.vehicle.model}`} />
          <KV label="Category" value={<span className="capitalize">{payload.vehicle.category}</span>} />
          <KV label="Colour · Year" value={`${payload.vehicle.color} · ${payload.vehicle.year}`} />
          <KV label="Camera" value={<span className="font-mono">{payload.camera.code}</span>} />
        </Section>

        {/* Owner */}
        <Section title="Owner of record" icon={Shield}>
          <KV label="Name" value={payload.owner.name} />
          <KV label="Phone" icon={Phone} value={<span className="font-mono">{payload.owner.phone}</span>} />
          <KV label="Email" icon={Mail} value={<span className="truncate">{payload.owner.email}</span>} />
          <KV label="City" icon={MapPin} value={payload.owner.city} />
        </Section>

        {/* Compliance */}
        <Section title="Compliance signals" icon={BadgeAlert}>
          <Signal label="Registration" ok={compliance.registration} />
          <Signal label="Insurance"    ok={compliance.insurance} />
          <Signal label="PUC"          ok={compliance.puc} />
          <Signal label="Blacklist"    ok={!compliance.blacklist} blacklist={compliance.blacklist} />
        </Section>
      </div>

      {/* ── AI telemetry + Encounter history ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section title="AI telemetry" icon={Fingerprint}>
          <Telem label="OCR confidence"      pct={payload.telemetry.ocr_confidence} />
          <Telem label="Vehicle confidence"  pct={payload.telemetry.vehicle_confidence} />
          <Telem label="Plate confidence"    pct={payload.telemetry.plate_confidence} />
          <Telem label="Frame quality"       pct={payload.telemetry.frame_quality} />
          <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-border/70">
            <span className="text-xs text-foreground-muted">OCR engine</span>
            <span className="font-mono text-xs font-semibold text-foreground">{payload.telemetry.ocr_engine}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground-muted">Pipeline latency</span>
            <span className="font-mono text-xs font-semibold text-foreground tabular-nums">{payload.telemetry.total_latency_ms} ms</span>
          </div>
        </Section>

        <Section title="Encounter history" icon={Calendar}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-foreground-muted">Detections (30 days)</span>
            <span className="font-mono text-base font-bold text-foreground tabular-nums">{payload.history.detections_30d}</span>
          </div>
          <div className="flex items-baseline justify-between mb-2.5">
            <span className="text-xs text-foreground-muted">Repeat offences</span>
            <span className={cn(
              "font-mono text-base font-bold tabular-nums",
              payload.history.repeat_offences > 0 ? "text-status-danger" : "text-foreground",
            )}>
              {payload.history.repeat_offences}
            </span>
          </div>
          {payload.history.encounter_history.length === 0 ? (
            <p className="text-xs text-foreground-subtle italic">No prior encounters on record.</p>
          ) : (
            <ul className="space-y-1">
              {payload.history.encounter_history.map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="font-mono tabular-nums text-foreground-subtle">{h.date}</span>
                  <span className="font-mono text-foreground-subtle">·</span>
                  <span className="font-mono text-foreground-muted">{h.camera}</span>
                  <span className="font-mono text-foreground-subtle ml-auto">{h.result}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* ── AI Explainability ─────────────────────────────────────── */}
      {payload.decision_trace && payload.decision_trace.length > 0 && (
        <ExplainabilityPanel
          trace={payload.decision_trace}
          violation={violation}
          totalScore={payload.outcome.threat_score}
        />
      )}

      {/* ── Challan (if violation) ────────────────────────────────── */}
      {violation && payload.challan_number && (
        <div className="surface-panel-elevated p-4 sm:p-5 ring-1 ring-status-danger/30">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-danger/15 text-status-danger">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="section-eyebrow">Challan issued</span>
              <p className="mt-0.5 font-mono text-sm font-bold tracking-wider text-foreground">{payload.challan_number}</p>
              <p className="mt-1 text-xs text-foreground-muted">
                {payload.outcome.violation_type} · MV Act compliant · auto-dispatched to {payload.owner.name}
              </p>
            </div>
            <div className="text-right">
              <span className="section-eyebrow">Fine</span>
              <p className="mt-0.5 font-mono text-lg font-bold text-status-danger tabular-nums">
                ₹{payload.outcome.fine_amount_inr.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onAnother}
        className="sm:hidden w-full inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-surface text-xs font-semibold text-foreground hover:border-border-strong hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
      >
        Replay another <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

// ─── Mini components ────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Shield;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-panel p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon className="h-3.5 w-3.5 text-foreground-subtle" />
        <span className="section-eyebrow">{title}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KV({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: typeof Phone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-foreground-muted inline-flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3 text-foreground-subtle" />}
        {label}
      </span>
      <span className="text-xs font-medium text-foreground text-right truncate min-w-0">{value}</span>
    </div>
  );
}

function Signal({ label, ok, blacklist }: { label: string; ok: boolean; blacklist?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-xs text-foreground-muted">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em]",
          ok && !blacklist && "bg-sage-500/15 text-sage-800 dark:text-sage-100",
          !ok && !blacklist && "bg-peach-500/20 text-peach-800 dark:text-peach-100",
          blacklist && "bg-status-danger/15 text-status-danger",
        )}
      >
        {blacklist ? (
          <>
            <AlertOctagon className="h-3 w-3" /> BOLO
          </>
        ) : ok ? (
          <>
            <BadgeCheck className="h-3 w-3" /> VALID
          </>
        ) : (
          <>
            <AlertOctagon className="h-3 w-3" /> EXPIRED
          </>
        )}
      </span>
    </div>
  );
}

// ─── AI Explainability ──────────────────────────────────────────────────

const OUTCOME_STYLES: Record<DecisionSignal["outcome"], { chip: string; bar: string; icon: typeof Sparkles }> = {
  PASS:      { chip: "bg-sage-500/15 text-sage-800 dark:text-sage-100",                bar: "bg-sage-500",         icon: BadgeCheck },
  FLAG:      { chip: "bg-[#bd8658]/20 text-[#7a4a28] dark:text-[#fcc99a]",             bar: "bg-[#bd8658]",        icon: AlertOctagon },
  CRITICAL:  { chip: "bg-status-danger/15 text-status-danger",                          bar: "bg-status-danger",    icon: ShieldAlert },
  RECOVERED: { chip: "bg-peach-500/15 text-peach-800 dark:text-peach-100",             bar: "bg-peach-500",        icon: Sparkles },
  ENHANCED:  { chip: "bg-sage-400/15 text-sage-700 dark:text-sage-100",                bar: "bg-sage-400",         icon: Sparkles },
};

function ExplainabilityPanel({
  trace,
  violation,
  totalScore,
}: {
  trace: DecisionSignal[];
  violation: boolean;
  totalScore: number;
}) {
  const headline = violation
    ? "Why this vehicle was flagged"
    : "Why this vehicle cleared";
  const subhead = violation
    ? "Decision trace · each signal’s source, evidence, and contribution to the threat score."
    : "Compliance trace · the inputs the engine evaluated before clearing the pass.";

  return (
    <div className="surface-panel-elevated p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-100 dark:bg-sage-900/30 text-sage-700 dark:text-sage-200">
          <Brain className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="section-eyebrow">AI explainability</span>
          <h3 className="mt-0.5 font-display text-sm sm:text-base font-semibold tracking-tight text-foreground leading-tight">
            {headline}
          </h3>
          <p className="mt-0.5 text-xs text-foreground-muted">{subhead}</p>
        </div>
        <div className="hidden sm:block text-right shrink-0">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">Composite</p>
          <p className="font-mono text-base font-bold tabular-nums text-foreground">{totalScore}<span className="text-foreground-subtle text-xs">/100</span></p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {trace.map((s, i) => {
          const style = OUTCOME_STYLES[s.outcome];
          const Icon = style.icon;
          const absContribution = Math.abs(s.contribution);
          // Width is relative to max possible 40-point swing per signal
          const barPct = Math.max(6, Math.min(100, (absContribution / 40) * 100));
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-lg border border-border bg-surface/60 px-3 py-2.5"
            >
              <div className="flex items-start gap-2.5">
                <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md", style.chip)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-foreground leading-tight">
                      {s.signal}
                    </p>
                    <span className={cn(
                      "inline-flex h-4 px-1 rounded text-[9px] font-bold uppercase tracking-[0.14em] shrink-0",
                      style.chip,
                    )}>
                      {s.outcome}
                    </span>
                  </div>
                  <p className="text-2xs font-mono uppercase tracking-[0.10em] text-foreground-subtle mb-1">
                    {s.source}
                  </p>
                  <p className="text-xs text-foreground-muted leading-snug">
                    {s.evidence}
                  </p>

                  {/* Contribution bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-stone-200/40 dark:bg-stone-800/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className={cn("h-full rounded-full", style.bar)}
                      />
                    </div>
                    <span className={cn(
                      "font-mono text-2xs font-bold tabular-nums shrink-0",
                      s.contribution > 0
                        ? "text-[#7a4a28] dark:text-[#fcc99a]"
                        : s.contribution < 0
                        ? "text-sage-700 dark:text-sage-200"
                        : "text-foreground-subtle"
                    )}>
                      {s.contribution > 0 ? `+${s.contribution}` : s.contribution} pts
                    </span>
                    <span className="font-mono text-2xs text-foreground-subtle shrink-0">
                      w={(s.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ul>

      <p className="mt-3 text-2xs text-foreground-subtle leading-relaxed">
        Composite score is a weighted aggregate of all signals above. Negative contributions reduce risk;
        positive contributions raise it. Each signal links to the source-of-truth registry it consulted —
        VAHAN for registration, IRDA for insurance, MPCB for PUC, MH Police for blacklist.
      </p>
    </div>
  );
}

function Telem({ label, pct }: { label: string; pct: number }) {
  const v = Math.round(pct * 100);
  const color =
    v >= 90 ? "bg-sage-500" :
    v >= 75 ? "bg-peach-400" :
    v >= 60 ? "bg-[#bd8658]" :
    "bg-status-danger";
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="text-foreground-muted">{label}</span>
        <span className="font-mono font-semibold text-foreground tabular-nums">{v}%</span>
      </div>
      <div className="h-1 rounded-full bg-stone-200/50 dark:bg-stone-800/50 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}
