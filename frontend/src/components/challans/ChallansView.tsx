"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, Car, Check, ChevronDown, ChevronLeft, ChevronRight,
  Download, FileText, Fingerprint, Lock, MapPin, Phone, Plus, Search,
  ShieldCheck, ShieldX, User,
} from "lucide-react";
import { buildDossier } from "@/lib/intel/vehicleDossier";
import { challansApi } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/stores/auth.store";
import { can } from "@/lib/auth/permissions";
import { cn, formatCompact } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Challan, PaginatedResponse } from "@/lib/types";

interface ChallanStats {
  total_issued: number;
  total_collected: number;
  pending_count: number;
  collection_rate: number;
}

const STATUS_TABS = [
  { key: "all",      label: "ALL" },
  { key: "issued",   label: "ISSUED" },
  { key: "paid",     label: "SETTLED" },
  { key: "overdue",  label: "OVERDUE" },
  { key: "disputed", label: "DISPUTED" },
] as const;

/* ── Severity model — drives the rail, ordering cues, and chips ────── */
type Severity = "critical" | "high" | "medium" | "low" | "clear";

const SEVERITY_CFG: Record<Severity, { rail: string; label: string; cls: string }> = {
  critical: { rail: "severity-rail-critical", label: "CRITICAL", cls: "text-threat-critical" },
  high:     { rail: "severity-rail-high",     label: "HIGH",     cls: "text-threat-high" },
  medium:   { rail: "severity-rail-medium",   label: "MEDIUM",   cls: "text-threat-medium" },
  low:      { rail: "severity-rail-low",      label: "LOW",      cls: "text-threat-low" },
  clear:    { rail: "severity-rail-clear",    label: "SETTLED",  cls: "text-threat-clear" },
};

function isOverdue(c: Challan): boolean {
  return c.status === "issued" && !!c.due_date && new Date(c.due_date) < new Date();
}

function getSeverity(c: Challan): Severity {
  if (c.status === "overdue" || isOverdue(c)) return "critical";
  if (c.status === "disputed") return "high";
  if (c.status === "issued") return c.fine_amount >= 5000 ? "high" : "medium";
  if (c.status === "paid") return "clear";
  return "low"; // cancelled
}

/* ── Enforcement reasoning narrative ───────────────────────────────── */
function buildReasoning(c: Challan): string {
  const viol = c.violation_type.replace(/_/g, " ");
  const head =
    `AI detection flagged vehicle ${c.plate_number} for ${viol}` +
    `${c.location ? ` at ${c.location}` : ""}. ` +
    `Fine assessed at ₹${c.fine_amount.toLocaleString("en-IN")} per the Maharashtra MV Act schedule; ` +
    `notice ${c.challan_number} served on ${format(new Date(c.issued_at), "dd MMM yyyy")}.`;
  if (c.status === "paid") {
    return head + ` Settled${c.paid_at ? ` on ${format(new Date(c.paid_at), "dd MMM yyyy")}` : ""} — case closed.`;
  }
  if (c.status === "disputed") {
    return head + " Owner has contested the notice — case held pending adjudication.";
  }
  if (c.status === "overdue" || isOverdue(c)) {
    return head + ` Payment window expired${c.due_date ? ` on ${format(new Date(c.due_date), "dd MMM yyyy")}` : ""} — escalation to recovery recommended.`;
  }
  if (c.status === "cancelled") {
    return head + " Notice withdrawn — no further action.";
  }
  return head + `${c.due_date ? ` Payment due by ${format(new Date(c.due_date), "dd MMM yyyy")}.` : ""}`;
}

/* ── Settlement flow stepper: DETECTED → ISSUED → SETTLED ──────────── */
function StatusFlow({ challan: c }: { challan: Challan }) {
  const overdue = c.status === "overdue" || isOverdue(c);
  const steps = [
    { label: "DETECTED", state: "done" as const },
    { label: "ISSUED",   state: "done" as const },
    {
      label: c.status === "paid" ? "SETTLED" : overdue ? "OVERDUE" : c.status === "disputed" ? "DISPUTED" : c.status === "cancelled" ? "CANCELLED" : "PENDING",
      state: c.status === "paid" ? ("done" as const) : overdue ? ("alert" as const) : c.status === "disputed" ? ("warn" as const) : ("pending" as const),
    },
  ];

  return (
    <div className="flex items-center gap-1.5" aria-label="Settlement flow">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="h-px w-3 bg-border-strong" aria-hidden />}
          <span
            className={cn(
              "inline-flex items-center gap-1 font-mono text-2xs font-semibold tracking-[0.08em]",
              s.state === "done" && "text-threat-clear",
              s.state === "alert" && "text-threat-critical",
              s.state === "warn" && "text-threat-high",
              s.state === "pending" && "text-foreground-subtle"
            )}
          >
            {s.state === "done" ? (
              <Check className="h-2.5 w-2.5" />
            ) : s.state === "alert" || s.state === "warn" ? (
              <AlertTriangle className="h-2.5 w-2.5" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full border border-current" />
            )}
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Summary readout strip — replaces the four coloured stat cards ── */
function EnforcementSummary() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["challan-stats"],
    queryFn: () => challansApi.stats().then((r) => r.data as ChallanStats),
    refetchInterval: 60_000,
  });

  const rate = stats?.collection_rate ?? 0;
  const cells = [
    {
      label: "Fines Issued",
      value: isLoading ? "—" : `₹${formatCompact(stats?.total_issued ?? 0)}`,
      sub: "total enforcement value",
      state: "info",
    },
    {
      label: "Collected",
      value: isLoading ? "—" : `₹${formatCompact(stats?.total_collected ?? 0)}`,
      sub: "settled to treasury",
      state: "ok",
    },
    {
      label: "Pending Cases",
      value: isLoading ? "—" : String(stats?.pending_count ?? 0),
      sub: "awaiting settlement",
      state: (stats?.pending_count ?? 0) > 0 ? "warn" : "ok",
    },
    {
      label: "Collection Rate",
      value: isLoading ? "—" : `${rate}%`,
      sub: rate >= 70 ? "on target" : rate >= 40 ? "below target" : "recovery lagging",
      state: rate >= 70 ? "ok" : rate >= 40 ? "warn" : "alert",
    },
  ];

  return (
    <section className="op-surface" aria-label="Enforcement summary">
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border/70">
        {cells.map((c) => (
          <div key={c.label} className={cn("readout-cell", `readout-${c.state}`)}>
            <span className="data-label">{c.label}</span>
            <div className="mt-2">
              {isLoading
                ? <div className="skeleton h-7 w-16" />
                : <span className="data-value text-2xl font-semibold leading-none">{c.value}</span>}
            </div>
            <p className="mt-1.5 font-mono text-2xs text-foreground-subtle truncate">{c.sub}</p>
          </div>
        ))}
      </div>
      {/* Recovery progress rail */}
      <div className="px-5 py-2.5 border-t border-border/70 flex items-center gap-3">
        <span className="font-mono text-2xs uppercase tracking-[0.12em] text-foreground-subtle shrink-0">
          Recovery
        </span>
        <div className="flex-1 h-1 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, rate)}%` }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className={cn("h-full rounded-full", rate >= 70 ? "bg-sage-500" : rate >= 40 ? "bg-bronze-400" : "bg-peach-500")}
          />
        </div>
        <span className="font-mono text-2xs text-foreground tabular-nums shrink-0">{isLoading ? "—" : `${rate}%`}</span>
      </div>
    </section>
  );
}

/* ── Queue row ─────────────────────────────────────────────────────── */
function ChallanQueueRow({ challan: c, canViewPii, canDownloadPdf, onDownload }: {
  challan: Challan;
  canViewPii: boolean;
  canDownloadPdf: boolean;
  onDownload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY_CFG[getSeverity(c)];
  const overdue = isOverdue(c) || c.status === "overdue";

  return (
    <li className="relative border-b border-border/60 last:border-b-0">
      <span className={sev.rail} aria-hidden />

      {/* Row face */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "w-full text-left flex items-center gap-4 pl-5 pr-4 py-3 transition-colors",
          open ? "bg-muted/40" : "hover:bg-muted/30"
        )}
      >
        <div className="w-32 shrink-0 hidden sm:block">
          <p className="font-mono text-2xs text-foreground-subtle truncate">{c.challan_number}</p>
          <p className={cn("font-mono text-2xs font-semibold tracking-[0.08em] mt-0.5", sev.cls)}>{sev.label}</p>
        </div>

        <span className="plate-chip shrink-0">{c.plate_number}</span>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-foreground capitalize font-medium truncate">
            {c.violation_type.replace(/_/g, " ")}
          </p>
          {c.location && (
            <p className="text-2xs text-foreground-subtle truncate flex items-center gap-1 mt-0.5">
              <MapPin className="h-2.5 w-2.5 shrink-0" /> {c.location}
            </p>
          )}
        </div>

        {canViewPii && (
          <div className="hidden lg:block w-36 shrink-0 min-w-0">
            <p className="text-xs text-foreground-muted truncate flex items-center gap-1.5">
              <User className="h-3 w-3 text-foreground-subtle shrink-0" />
              {c.owner_name ?? "—"}
            </p>
          </div>
        )}

        <div className="w-20 shrink-0 text-right">
          <p className="font-display text-sm font-semibold tabular-nums text-foreground">
            ₹{c.fine_amount.toLocaleString("en-IN")}
          </p>
          <p className={cn(
            "font-mono text-2xs tabular-nums mt-0.5",
            overdue ? "text-threat-critical font-semibold" : "text-foreground-subtle"
          )}>
            {c.due_date ? `due ${format(new Date(c.due_date), "dd MMM")}` : format(new Date(c.issued_at), "dd MMM yy")}
          </p>
        </div>

        <div className="hidden md:block shrink-0 w-56">
          <StatusFlow challan={c} />
        </div>

        <ChevronDown className={cn(
          "h-4 w-4 text-foreground-subtle shrink-0 transition-transform duration-250",
          open && "rotate-180"
        )} />
      </button>

      {/* Case detail */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <CaseFile
              challan={c}
              overdue={!!overdue}
              canViewPii={canViewPii}
              canDownloadPdf={canDownloadPdf}
              onDownload={onDownload}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/* ── Case file — full investigative record for one challan ─────────── */
function CaseFile({ challan: c, overdue, canViewPii, canDownloadPdf, onDownload }: {
  challan: Challan;
  overdue: boolean;
  canViewPii: boolean;
  canDownloadPdf: boolean;
  onDownload: () => void;
}) {
  // Deterministic registry synthesis — same plate always yields the same
  // dossier, so this case file agrees with the vehicle intelligence page.
  const dossier = buildDossier(c.plate_number, c.violation_type);
  const docs = [
    { label: "Insurance", st: dossier.compliance.insurance },
    { label: "Registration", st: dossier.compliance.rc },
    { label: "PUC", st: dossier.compliance.puc },
    { label: "Fitness", st: dossier.compliance.fitness },
  ];

  return (
    <div className="pl-5 pr-4 pb-4 pt-1">
      <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
        {/* Case file header band */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-b border-border bg-muted/50 font-mono text-2xs uppercase tracking-[0.12em] text-foreground-subtle">
          <span className="flex items-center gap-1.5">
            <FileText className="h-3 w-3" /> Case File · {c.challan_number}
          </span>
          <span className="flex items-center gap-1.5">
            <Fingerprint className="h-3 w-3" /> {dossier.vaahanId}
          </span>
          <span className="ml-auto tabular-nums">{format(new Date(c.issued_at), "dd MMM yyyy")}</span>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_260px] gap-4">
          {/* Column 1 — reasoning + settlement timeline */}
          <div className="space-y-3 min-w-0">
            <div className="rounded-lg border border-border bg-surface/60 px-4 py-3">
              <p className="data-label mb-1.5">Enforcement Reasoning</p>
              <p className="text-xs leading-relaxed text-foreground-muted">{buildReasoning(c)}</p>
              {c.violation_description && (
                <p className="mt-2 text-2xs text-foreground-subtle italic">“{c.violation_description}”</p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-surface/60 px-4 py-3">
              <p className="data-label mb-2">Settlement Timeline</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <TimelineCell label="Issued" value={format(new Date(c.issued_at), "dd MMM yy")} />
                <TimelineCell
                  label="Due"
                  value={c.due_date ? format(new Date(c.due_date), "dd MMM yy") : "—"}
                  alert={overdue}
                />
                <TimelineCell
                  label="Settled"
                  value={c.paid_at ? format(new Date(c.paid_at), "dd MMM yy") : "—"}
                />
                <TimelineCell
                  label="Amount Paid"
                  value={c.paid_amount != null ? `₹${c.paid_amount.toLocaleString("en-IN")}` : "—"}
                />
              </div>
            </div>

            {/* Encounter history */}
            <div className="rounded-lg border border-border bg-surface/60 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="data-label">Encounter History</p>
                <span className={cn(
                  "font-mono text-2xs font-semibold uppercase tracking-[0.1em]",
                  dossier.risk.repeatOffender ? "text-threat-high" : "text-foreground-subtle"
                )}>
                  {dossier.risk.priorEncounters} prior · {dossier.risk.repeatOffender ? "repeat offender" : "no pattern"}
                </span>
              </div>
              {dossier.lastFlagged ? (
                <p className="text-2xs text-foreground-muted">
                  Last flagged for <span className="font-medium text-foreground">{dossier.lastFlagged.violation}</span>{" "}
                  <span className="font-mono text-foreground-subtle">({dossier.lastFlagged.daysAgo}d ago)</span>
                </p>
              ) : (
                <p className="text-2xs text-foreground-subtle">No previous flags on record.</p>
              )}
            </div>
          </div>

          {/* Column 2 — vehicle identity + document compliance */}
          <div className="space-y-3 min-w-0">
            <div className="rounded-lg border border-border bg-surface/60 px-4 py-3">
              <p className="data-label mb-2 flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5" /> Vehicle Identity
              </p>
              <p className="text-sm font-semibold text-foreground">
                {dossier.vehicle.make} {dossier.vehicle.model}
              </p>
              <p className="mt-0.5 font-mono text-2xs text-foreground-subtle">
                {dossier.vehicle.year} · {dossier.vehicle.color} · {dossier.vehicle.category}
              </p>
              <div className={cn(
                "mt-2.5 rounded-md border px-2.5 py-1.5 flex items-center justify-between font-mono text-2xs font-semibold uppercase tracking-[0.1em]",
                dossier.risk.band === "critical" || dossier.risk.band === "high" ? "threat-high"
                  : dossier.risk.band === "elevated" ? "threat-medium" : "threat-clear"
              )}>
                <span>Risk {dossier.risk.band}</span>
                <span className="tabular-nums">{dossier.risk.score}/100</span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface/60 px-4 py-3">
              <p className="data-label mb-2">Document Compliance</p>
              <div className="grid grid-cols-2 gap-1.5">
                {docs.map(({ label, st }) => (
                  <div
                    key={label}
                    className={cn(
                      "rounded-md border px-2 py-1.5",
                      st.ok
                        ? "border-sage-200 bg-sage-50/70 dark:border-sage-700/40 dark:bg-sage-900/20"
                        : "border-peach-200 bg-peach-50/70 dark:border-peach-700/40 dark:bg-peach-900/20"
                    )}
                  >
                    <p className="flex items-center gap-1 text-2xs font-semibold text-foreground">
                      {st.ok
                        ? <ShieldCheck className="h-2.5 w-2.5 text-sage-600 dark:text-sage-400" />
                        : <ShieldX className="h-2.5 w-2.5 text-peach-600 dark:text-peach-400" />}
                      {label}
                    </p>
                    <p className={cn(
                      "mt-0.5 font-mono text-2xs",
                      st.ok ? "text-sage-700 dark:text-sage-400" : "text-peach-700 dark:text-peach-400 font-semibold"
                    )}>
                      {st.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Column 3 — owner + actions */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface/60 px-4 py-3">
              <p className="data-label mb-2">Registered Owner</p>
              {canViewPii ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <User className="h-3 w-3 text-foreground-subtle" /> {c.owner_name ?? dossier.owner.name}
                  </p>
                  <p className="text-2xs font-mono text-foreground-muted flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-foreground-subtle" /> {c.owner_phone ?? dossier.owner.phoneMasked}
                  </p>
                  <p className="text-2xs text-foreground-subtle flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0 mt-px" /> {c.location ?? dossier.owner.address}
                  </p>
                </div>
              ) : (
                <p className="text-2xs font-mono uppercase tracking-[0.1em] text-foreground-subtle flex items-center gap-1.5">
                  <Lock className="h-3 w-3" /> PII restricted for your role
                </p>
              )}
            </div>

            {canDownloadPdf ? (
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(); }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface hover:bg-muted text-xs font-semibold text-sage-700 dark:text-sage-400 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Download e-Challan PDF
              </button>
            ) : (
              <p className="text-2xs font-mono uppercase tracking-[0.1em] text-foreground-subtle flex items-center justify-center gap-1.5 py-2">
                <Lock className="h-3 w-3" /> PDF export restricted
              </p>
            )}
            <a
              href={`/vehicles/${encodeURIComponent(c.plate_number)}`}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-2xs font-semibold uppercase tracking-[0.08em] text-sage-700 dark:text-sage-400 hover:underline"
            >
              <Fingerprint className="h-3.5 w-3.5" /> Full vehicle dossier
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineCell({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-2xs text-foreground-subtle uppercase tracking-[0.1em] font-semibold">{label}</p>
      <p className={cn(
        "mt-0.5 font-mono text-xs tabular-nums",
        alert ? "text-threat-critical font-semibold" : "text-foreground"
      )}>
        {value}
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ENFORCEMENT OPERATIONS QUEUE
   ════════════════════════════════════════════════════════════════════ */
export function ChallansView() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const role = useAuthStore((s) => s.user?.role);
  const canIssue = can(role, "challans:issue");
  const canDownloadPdf = can(role, "challans:download_pdf");
  const canViewPii = can(role, "evidence:view_pii");

  const { data, isLoading } = useQuery({
    queryKey: ["challans", page, statusFilter],
    queryFn: () => challansApi.list(page, 20, statusFilter === "all" ? undefined : statusFilter)
      .then((r) => r.data as PaginatedResponse<Challan>),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  const handleDownloadPdf = async (id: string, number: string) => {
    try {
      const { data: blob } = await challansApi.downloadPdf(id);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `challan-${number}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success("e-Challan PDF downloaded");
    } catch {
      toast.error("PDF generation failed");
    }
  };

  const filtered = (data?.items ?? []).filter((c: Challan) =>
    !search || c.plate_number.includes(search.toUpperCase()) ||
    c.challan_number.includes(search.toUpperCase())
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-screen-2xl mx-auto space-y-5">
        <EnforcementSummary />

        <section className="op-surface">
          {/* ── Queue toolbar ────────────────────────────────────── */}
          <header className="ops-header">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="ops-title">Enforcement Queue</span>
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
                {STATUS_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setStatusFilter(key); setPage(1); }}
                    className={cn(
                      "px-2.5 py-1 font-mono text-2xs font-semibold tracking-[0.08em] rounded-md transition-all",
                      statusFilter === key
                        ? "bg-surface text-foreground shadow-card border border-border"
                        : "text-foreground-subtle hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-foreground-subtle shrink-0" />
                <input
                  type="text"
                  placeholder="Plate / challan…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent font-mono text-xs text-foreground placeholder:text-foreground-subtle/60 outline-none w-36 uppercase"
                />
              </div>
              {canIssue ? (
                <button className="btn-primary btn-sm">
                  <Plus className="h-3.5 w-3.5" />
                  Issue Challan
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 px-3 h-7 rounded-md border border-border bg-muted/40 text-2xs font-mono uppercase tracking-wider text-foreground-subtle"
                  title="Your role cannot issue challans"
                >
                  <Lock className="h-3 w-3" /> Read-only
                </span>
              )}
            </div>
          </header>

          {/* ── Queue ───────────────────────────────────────────── */}
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="skeleton h-14 rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="h-8 w-8 text-foreground-subtle/50 mx-auto mb-2" />
              <p className="text-sm text-foreground-muted font-medium">No cases match this filter</p>
              <p className="text-2xs text-foreground-subtle mt-1">Adjust the status filter or search query.</p>
            </div>
          ) : (
            <ul>
              {filtered.map((c: Challan) => (
                <ChallanQueueRow
                  key={c.id}
                  challan={c}
                  canViewPii={canViewPii}
                  canDownloadPdf={canDownloadPdf}
                  onDownload={() => handleDownloadPdf(c.id, c.challan_number)}
                />
              ))}
            </ul>
          )}

          {/* ── Pagination ──────────────────────────────────────── */}
          {data && data.total > 20 && (
            <footer className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/30">
              <p className="font-mono text-2xs text-foreground-subtle uppercase tracking-[0.1em] tabular-nums">
                {data.total} cases · page {page}/{totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                  className="p-1.5 rounded-md text-foreground-subtle hover:bg-muted disabled:opacity-30 border border-border transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "h-7 w-7 rounded-md font-mono text-xs font-medium transition-all border",
                        p === page
                          ? "bg-sage-600 text-white border-sage-700"
                          : "text-foreground-subtle border-transparent hover:bg-muted"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="p-1.5 rounded-md text-foreground-subtle hover:bg-muted disabled:opacity-30 border border-border transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}
