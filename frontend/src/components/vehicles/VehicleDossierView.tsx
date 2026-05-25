"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeAlert,
  Bell,
  Calendar,
  Camera,
  Car,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Fingerprint,
  Gauge,
  History,
  MapPin,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { detectionsApi } from "@/lib/api/endpoints";
import {
  buildDossier,
  formatPlate,
  riskBandStyle,
  type ComplianceStatus,
} from "@/lib/intel/vehicleDossier";
import type { Detection } from "@/lib/types";
import { cn, formatNumber, timeAgo } from "@/lib/utils";

import { OCRReveal } from "@/components/cameras/primitives/OCRReveal";

interface Props {
  plate: string;
}

/**
 * Full-page vehicle intelligence dossier. Consumes the shared
 * `buildDossier` synthesis for identity / compliance / risk and fetches
 * recent detections to render an encounter timeline filtered for this plate.
 *
 * Sections (top to bottom):
 *   - Plate hero with watchlist / blacklist / repeat-offender badges
 *   - Identity strip: vehicle + owner + risk assessment ring
 *   - Compliance grid (insurance / RC / PUC / fitness, with expiry dates)
 *   - Encounter timeline of detections for this plate
 *   - Enforcement actions panel
 */
export function VehicleDossierView({ plate }: Props) {
  const dossier = useMemo(() => buildDossier(plate), [plate]);

  // Pull the recent detection stream and filter for this plate. The API has
  // no dedicated plate filter yet — when one lands, swap this for it.
  const { data: recent = [] } = useQuery({
    queryKey: ["detections", "recent-large"],
    queryFn: () => detectionsApi.recent(200).then((r) => r.data ?? []),
    staleTime: 30_000,
  });

  const normalised = plate.replace(/\s+/g, "").toUpperCase();
  const encounters = useMemo<Detection[]>(
    () =>
      (recent as Detection[]).filter(
        (d) => (d.detected_plate ?? "").replace(/\s+/g, "").toUpperCase() === normalised
      ),
    [recent, normalised]
  );

  const copyPlate = () => {
    navigator.clipboard.writeText(dossier.plate).then(
      () => toast.success("Plate copied", { description: dossier.plate }),
      () => toast.error("Copy failed")
    );
  };

  const band = riskBandStyle(dossier.risk.band);

  return (
    <div className="page-shell page-enter space-y-6">
      {/* ── Back ──────────────────────────────────────────── */}
      <Link
        href="/detections"
        className="inline-flex items-center gap-1.5 text-xs text-foreground-subtle hover:text-foreground transition-colors -mb-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Detections
      </Link>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative surface-panel overflow-hidden">
        <div className="absolute inset-0 -z-0 opacity-60 bg-sage-radial pointer-events-none" />
        <div className="absolute inset-0 -z-0 opacity-40 bg-peach-radial pointer-events-none" />

        <div className="relative z-10 p-5 sm:p-7 flex flex-col lg:flex-row gap-6 items-start lg:items-end justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="page-eyebrow flex items-center gap-1.5">
                <Fingerprint className="h-3 w-3" />
                Vehicle intelligence dossier
              </span>
              <span className="text-2xs font-mono text-foreground-subtle">
                VAAHAN ID #{dossier.vaahanId}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center h-12 px-4 rounded-lg font-mono text-2xl font-semibold tracking-[0.14em] bg-surface text-foreground border border-border-strong shadow-card">
                <OCRReveal text={formatPlate(dossier.plate)} duration={600} />
              </span>
              <button
                type="button"
                onClick={copyPlate}
                className="btn-secondary btn-sm"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
              {dossier.risk.blacklisted && (
                <FlagBadge tone="danger" icon={<BadgeAlert className="h-3 w-3" />} label="Blacklisted" />
              )}
              {dossier.risk.watchlisted && !dossier.risk.blacklisted && (
                <FlagBadge tone="peach" icon={<AlertTriangle className="h-3 w-3" />} label="Watchlist" />
              )}
              {dossier.risk.repeatOffender && (
                <FlagBadge tone="bronze" icon={<History className="h-3 w-3" />} label="Repeat offender" />
              )}
              {!dossier.risk.repeatOffender && !dossier.risk.watchlisted && !dossier.risk.blacklisted && (
                <FlagBadge tone="sage" icon={<ShieldCheck className="h-3 w-3" />} label="Clean record" />
              )}
            </div>

            <p className="mt-4 text-sm text-foreground-muted max-w-2xl">
              Composite intelligence record drawn from the registry, insurance, RTO,
              and enforcement databases. Last refreshed{" "}
              <span className="font-mono text-foreground">{new Date().toLocaleString("en-IN", { hour12: false })}</span>.
            </p>
          </div>

          {/* Risk assessment */}
          <div className="shrink-0 self-stretch lg:self-end">
            <RiskAssessmentCard score={dossier.risk.score} band={band} priorEncounters={dossier.risk.priorEncounters} />
          </div>
        </div>
      </section>

      {/* ── Identity strip ────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="surface-panel p-5">
          <header className="flex items-center justify-between mb-3">
            <h3 className="section-title flex items-center gap-1.5">
              <Car className="h-4 w-4 text-bronze-600" />
              Vehicle
            </h3>
            <span className="text-2xs font-mono text-foreground-subtle">RTO record</span>
          </header>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <IdRow label="Make / Model" value={`${dossier.vehicle.make} ${dossier.vehicle.model}`} />
            <IdRow label="Category" value={dossier.vehicle.category} />
            <IdRow label="Model year" value={String(dossier.vehicle.year)} mono />
            <IdRow label="Colour" value={dossier.vehicle.color} />
          </dl>
        </div>

        <div className="surface-panel p-5">
          <header className="flex items-center justify-between mb-3">
            <h3 className="section-title flex items-center gap-1.5">
              <User className="h-4 w-4 text-sage-700" />
              Registered owner
            </h3>
            <span className="text-2xs font-mono text-foreground-subtle">Verified</span>
          </header>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <IdRow label="Name" value={dossier.owner.name} colSpan />
            <IdRow label="Phone" value={dossier.owner.phoneMasked} mono />
            <IdRow label="Address" value={dossier.owner.address} colSpan />
          </dl>
        </div>
      </section>

      {/* ── Compliance grid ───────────────────────────────── */}
      <section>
        <header className="flex items-end justify-between mb-3 px-1">
          <div>
            <h3 className="section-title">Compliance status</h3>
            <p className="section-subtitle">Validity checked against the central registry</p>
          </div>
          <span className="text-2xs text-foreground-subtle font-mono">Auto-resolved</span>
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <ComplianceCard label="Insurance"     status={dossier.compliance.insurance} icon={<ShieldCheck className="h-4 w-4" />} />
          <ComplianceCard label="Registration"  status={dossier.compliance.rc}        icon={<FileText className="h-4 w-4" />} />
          <ComplianceCard label="Pollution"     status={dossier.compliance.puc}       icon={<Sparkles className="h-4 w-4" />} />
          <ComplianceCard label="Fitness"       status={dossier.compliance.fitness}   icon={<Gauge className="h-4 w-4" />} />
        </div>
      </section>

      {/* ── Encounters + Enforcement ─────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6">
        <EncounterTimeline encounters={encounters} totalKnown={dossier.risk.priorEncounters} lastFlagged={dossier.lastFlagged} />
        <EnforcementPanel dossier={dossier} />
      </section>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════

function FlagBadge({
  tone,
  icon,
  label,
}: {
  tone: "danger" | "peach" | "bronze" | "sage";
  icon: React.ReactNode;
  label: string;
}) {
  const styles = {
    danger: "bg-[hsl(0_45%_96%)] text-[hsl(0_40%_38%)] border-[hsl(0_45%_84%)]",
    peach:  "bg-peach-50 text-peach-800 border-peach-200",
    bronze: "bg-bronze-50 text-bronze-800 border-bronze-200",
    sage:   "bg-sage-50 text-sage-800 border-sage-200",
  }[tone];

  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 h-6 rounded-md border text-2xs font-semibold uppercase tracking-[0.14em]",
      styles
    )}>
      {icon}
      {label}
    </span>
  );
}

function RiskAssessmentCard({
  score,
  band,
  priorEncounters,
}: {
  score: number;
  band: { tone: "sage" | "peach" | "bronze"; label: string };
  priorEncounters: number;
}) {
  const accent =
    band.tone === "peach" ? "#ED9F7E" :
    band.tone === "bronze" ? "#BD8658" : "#7F8876";
  const tint =
    band.tone === "peach" ? "bg-peach-50 border-peach-200" :
    band.tone === "bronze" ? "bg-bronze-50 border-bronze-200" :
    "bg-sage-50 border-sage-200";

  return (
    <div className={cn("rounded-xl border p-4 flex items-center gap-4 min-w-[280px]", tint)}>
      <div className="relative h-20 w-20 shrink-0">
        <svg viewBox="0 0 36 36" className="-rotate-90 h-full w-full">
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="rgba(45,51,34,0.10)" strokeWidth="3" />
          <motion.circle
            cx="18" cy="18" r="15.915"
            fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round"
            initial={{ strokeDasharray: "0 100" }}
            animate={{ strokeDasharray: `${score} ${100 - score}` }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-semibold tabular-nums leading-none" style={{ color: accent }}>
            {score}
          </span>
          <span className="font-mono text-[0.5rem] tracking-[0.20em] text-foreground-subtle mt-0.5">
            RISK
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="data-label">Risk assessment</p>
        <p className="font-display text-lg font-semibold tracking-tight mt-0.5" style={{ color: accent }}>
          {band.label}
        </p>
        <p className="text-2xs text-foreground-muted mt-1 flex items-center gap-1.5 font-mono">
          <History className="h-3 w-3" />
          {priorEncounters} prior {priorEncounters === 1 ? "encounter" : "encounters"}
        </p>
      </div>
    </div>
  );
}

function IdRow({
  label,
  value,
  mono,
  colSpan,
}: {
  label: string;
  value: string;
  mono?: boolean;
  colSpan?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", colSpan && "col-span-2")}>
      <dt className="data-label">{label}</dt>
      <dd className={cn("text-sm text-foreground", mono && "font-mono tabular-nums")}>{value}</dd>
    </div>
  );
}

function ComplianceCard({
  label,
  status,
  icon,
}: {
  label: string;
  status: ComplianceStatus;
  icon: React.ReactNode;
}) {
  const tint = status.ok
    ? "border-sage-200 bg-sage-50/60"
    : "border-peach-200 bg-peach-50/70";
  const accentText = status.ok ? "text-sage-800" : "text-peach-800";
  const subtleText = status.ok ? "text-sage-700/80" : "text-peach-700/85";

  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-2", tint)}>
      <header className="flex items-center justify-between">
        <span className="data-label">{label}</span>
        <span className={cn("opacity-60", accentText)}>{icon}</span>
      </header>
      <div className="flex items-center gap-2">
        {status.ok ? (
          <CheckCircle2 className={cn("h-4 w-4", accentText)} />
        ) : (
          <AlertTriangle className={cn("h-4 w-4", accentText)} />
        )}
        <span className={cn("font-display text-base font-semibold tracking-tight", accentText)}>
          {status.ok ? "Valid" : "Expired"}
        </span>
      </div>
      <p className={cn("text-xs font-mono tabular-nums", subtleText)}>
        {status.text}
      </p>
      {status.expiresAt && (
        <p className="text-2xs text-foreground-subtle font-mono flex items-center gap-1">
          <Calendar className="h-2.5 w-2.5" />
          {status.ok ? "Expires" : "Expired"} {status.expiresAt}
        </p>
      )}
    </div>
  );
}

function EncounterTimeline({
  encounters,
  totalKnown,
  lastFlagged,
}: {
  encounters: Detection[];
  totalKnown: number;
  lastFlagged: { violation: string; daysAgo: number } | null;
}) {
  const totalShown = encounters.length;
  const violationCount = encounters.filter((e) => e.is_violation).length;

  return (
    <div className="surface-panel overflow-hidden">
      <header className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="section-title flex items-center gap-1.5">
            <History className="h-4 w-4 text-foreground-muted" />
            Encounter timeline
          </h3>
          <p className="section-subtitle">
            {formatNumber(totalShown)} captured · {formatNumber(violationCount)} flagged
            {totalKnown > 0 && totalShown === 0 && ` · ${totalKnown} prior on record`}
          </p>
        </div>
        {lastFlagged && (
          <div className="text-right">
            <p className="data-label">Last alert</p>
            <p className="text-xs font-mono text-peach-800 mt-0.5">
              {lastFlagged.violation} · {lastFlagged.daysAgo}d ago
            </p>
          </div>
        )}
      </header>

      {encounters.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Camera className="h-8 w-8 text-foreground-subtle mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No recent encounters in the live stream</p>
          <p className="mt-1 text-xs text-foreground-subtle max-w-sm mx-auto">
            {totalKnown > 0
              ? `${totalKnown} prior encounters are on record; older records aren't shown in the recent window.`
              : "This vehicle has not been observed by any camera in the recent window."}
          </p>
        </div>
      ) : (
        <ol className="relative">
          <div className="absolute left-[27px] top-3 bottom-3 w-px bg-border" aria-hidden />
          {encounters.slice(0, 30).map((e, i) => (
            <EncounterRow key={e.id} encounter={e} index={i} />
          ))}
        </ol>
      )}
    </div>
  );
}

function EncounterRow({ encounter, index }: { encounter: Detection; index: number }) {
  const v = encounter.is_violation;
  return (
    <motion.li
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4), duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative px-5 py-3 flex items-start gap-4 hover:bg-stone-50/70 transition-colors"
    >
      <div className={cn(
        "relative z-10 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0",
        v
          ? "bg-peach-100 text-peach-800 ring-2 ring-peach-50"
          : "bg-sage-100 text-sage-800 ring-2 ring-sage-50"
      )}>
        {v ? <AlertTriangle className="h-2.5 w-2.5" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {v ? (encounter.violation_type ?? "Violation") : "Compliant pass"}
          </span>
          {encounter.ocr_confidence !== undefined && (
            <span className="text-2xs font-mono text-foreground-subtle tabular-nums">
              OCR {Math.round(encounter.ocr_confidence * 100)}%
            </span>
          )}
        </div>
        <p className="mt-0.5 text-2xs text-foreground-subtle font-mono flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Camera className="h-3 w-3" />
            CAM · {encounter.camera_id?.slice(0, 8) ?? "—"}
          </span>
          {encounter.processing_time_ms !== undefined && (
            <span>{encounter.processing_time_ms}ms</span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-foreground tabular-nums">
          {new Date(encounter.timestamp).toLocaleString("en-IN", { hour12: false })}
        </p>
        <p className="text-2xs text-foreground-subtle font-mono">{timeAgo(encounter.timestamp)}</p>
      </div>
    </motion.li>
  );
}

function EnforcementPanel({ dossier }: { dossier: ReturnType<typeof buildDossier> }) {
  const hasViolation =
    !dossier.compliance.insurance.ok ||
    !dossier.compliance.rc.ok ||
    !dossier.compliance.puc.ok ||
    !dossier.compliance.fitness.ok ||
    dossier.risk.blacklisted;

  const failingTypes = [
    !dossier.compliance.insurance.ok && "Expired Insurance",
    !dossier.compliance.rc.ok        && "Expired Registration",
    !dossier.compliance.puc.ok       && "Expired Pollution Cert",
    !dossier.compliance.fitness.ok   && "Failed Fitness",
    dossier.risk.blacklisted         && "Blacklisted Vehicle",
  ].filter(Boolean) as string[];

  return (
    <div className="surface-panel p-5 flex flex-col gap-4">
      <header>
        <h3 className="section-title flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-peach-700" />
          Enforcement
        </h3>
        <p className="section-subtitle">
          Recommended actions from the policy engine
        </p>
      </header>

      <div className={cn(
        "rounded-lg border px-3.5 py-3 text-xs",
        hasViolation
          ? "bg-peach-50 border-peach-200 text-peach-900"
          : "bg-sage-50 border-sage-200 text-sage-900"
      )}>
        {hasViolation ? (
          <>
            <p className="font-semibold mb-1.5">Auto-enforcement recommended</p>
            <ul className="space-y-0.5">
              {failingTypes.map((t) => (
                <li key={t} className="font-mono text-2xs tracking-[0.04em]">
                  · {t}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="font-semibold">No enforcement action recommended at this time.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <ActionButton
          icon={<Receipt className="h-4 w-4" />}
          label="Issue challan"
          sub={hasViolation ? "Pre-fill from violation stack" : "Ad-hoc"}
          primary={hasViolation}
        />
        <ActionButton
          icon={<AlertTriangle className="h-4 w-4" />}
          label={dossier.risk.watchlisted ? "Update watchlist note" : "Add to watchlist"}
          sub="Notify any operator on next sighting"
        />
        <ActionButton
          icon={<Bell className="h-4 w-4" />}
          label="Notify owner"
          sub={dossier.owner.phoneMasked}
        />
        <ActionButton
          icon={<Download className="h-4 w-4" />}
          label="Export PDF dossier"
          sub="Court-admissible packet"
        />
      </div>

      <footer className="mt-1 pt-3 border-t border-border text-2xs text-foreground-subtle font-mono flex items-center gap-1.5">
        <MapPin className="h-3 w-3" />
        Linked to operator audit log
      </footer>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  sub,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        primary
          ? "border-peach-300 bg-peach-50 hover:bg-peach-100 text-peach-900"
          : "border-border bg-surface hover:bg-stone-50 text-foreground"
      )}
    >
      <span className={cn(
        "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
        primary ? "bg-peach-200/70 text-peach-800" : "bg-stone-100 text-foreground-subtle"
      )}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold tracking-tight">{label}</span>
        {sub && <span className="block text-2xs text-foreground-subtle font-mono mt-0.5">{sub}</span>}
      </span>
    </button>
  );
}
