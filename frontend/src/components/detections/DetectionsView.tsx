"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertTriangle, Camera, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Eye, FileImage, Image as ImageIcon, MapPin, Search, Shield,
  ShieldAlert, ShieldCheck, Tag, X, ZoomIn,
} from "lucide-react";
import { detectionsApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Detection, PaginatedResponse } from "@/lib/types";
import { getApiUrl } from "@/lib/api/client";

function evidenceUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${getApiUrl()}/uploads/${path}`;
}

function confLevel(v?: number | null): "high" | "medium" | "low" | "none" {
  if (v == null) return "none";
  return v >= 0.85 ? "high" : v >= 0.65 ? "medium" : "low";
}

const CONF_COLORS = {
  high:   "text-sage-700 bg-sage-50 border-sage-200 dark:text-sage-300 dark:bg-sage-900/30 dark:border-sage-700/50",
  medium: "text-bronze-700 bg-bronze-50 border-bronze-200 dark:text-bronze-300 dark:bg-bronze-900/30 dark:border-bronze-700/50",
  low:    "text-peach-700 bg-peach-50 border-peach-200 dark:text-peach-300 dark:bg-peach-900/30 dark:border-peach-700/50",
  none:   "text-foreground-subtle",
};

function ConfBadge({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-foreground-subtle font-mono text-xs">—</span>;
  const pct = Math.round(value * 100);
  const level = confLevel(value);
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-2xs font-semibold tabular-nums",
      CONF_COLORS[level]
    )}>
      {pct}%
    </span>
  );
}

export function DetectionsView() {
  const [page, setPage] = useState(1);
  const [violationsOnly, setViolationsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Detection | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["detections-list", page, violationsOnly],
    queryFn: () => detectionsApi.list(page, 25, violationsOnly).then((r) => r.data as PaginatedResponse<Detection>),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["detection-stats"],
    queryFn: () => detectionsApi.stats().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const items: Detection[] = (data?.items ?? []).filter((d: Detection) =>
    !search || d.detected_plate?.includes(search.toUpperCase())
  );

  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-screen-2xl mx-auto space-y-5">

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Detections (24h)", value: (stats as Record<string, number> | undefined)?.total_24h ?? "—", icon: Activity, accent: "sage" },
            { label: "Violations (24h)", value: (stats as Record<string, number> | undefined)?.violations_24h ?? "—", icon: ShieldAlert, accent: "peach" },
            { label: "Success Rate", value: (stats as Record<string, number> | undefined)?.success_rate != null ? `${(stats as Record<string, number>).success_rate}%` : "—", icon: CheckCircle2, accent: "sage" },
            { label: "Avg Confidence", value: (stats as Record<string, number> | undefined)?.avg_confidence != null ? `${Math.round((stats as Record<string, number>).avg_confidence * 100)}%` : "—", icon: Shield, accent: "bronze" },
          ].map(({ label, value, icon: Icon, accent }, i) => {
            const pal = { sage: "bg-sage-50 border-sage-100 text-sage-800 dark:bg-sage-900/25 dark:border-sage-700/40 dark:text-sage-300", peach: "bg-peach-50 border-peach-100 text-peach-800 dark:bg-peach-900/25 dark:border-peach-700/40 dark:text-peach-300", bronze: "bg-bronze-50 border-bronze-100 text-bronze-800 dark:bg-bronze-900/25 dark:border-bronze-700/40 dark:text-bronze-300" }[accent as "sage" | "peach" | "bronze"];
            return (
              <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={cn("rounded-xl border p-4 flex items-center gap-3", pal)}>
                <Icon className="h-4 w-4 shrink-0 opacity-70" />
                <div>
                  <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
                  <p className="text-2xs font-mono text-foreground-subtle uppercase tracking-wider">{label}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Table card */}
        <div className="surface-panel overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-2">
                <Search className="h-3.5 w-3.5 text-foreground-subtle shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by plate..."
                  className="bg-transparent text-xs outline-none text-foreground placeholder:text-foreground-subtle w-36"
                />
              </div>
              <button
                onClick={() => { setViolationsOnly(!violationsOnly); setPage(1); }}
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
                  violationsOnly
                    ? "bg-peach-600 text-white border-peach-700 hover:bg-peach-700"
                    : "bg-muted/60 text-foreground-muted border-border hover:bg-muted"
                )}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {violationsOnly ? "Violations Only" : "All Records"}
              </button>
            </div>
            <p className="text-2xs text-foreground-subtle font-mono">
              {data?.total ?? 0} records · page {page}/{totalPages}
            </p>
          </div>

          {isError && (
            <div className="flex items-center gap-3 p-8 justify-center">
              <AlertTriangle className="h-5 w-5 text-peach-500" />
              <p className="text-sm text-foreground-muted">
                Failed to load detections.{" "}
                <button className="text-sage-700 dark:text-sage-400 hover:underline" onClick={() => window.location.reload()}>Retry</button>
              </p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Evidence", "Plate", "Vehicle", "OCR Conf.", "Veh. Conf.", "Status", "Violation", "Processing", "Timestamp"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle font-mono whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading
                  ? Array.from({ length: 8 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 9 }, (_, j) => (
                          <td key={j} className="px-4 py-3"><div className="skeleton h-3 rounded w-full max-w-[72px]" /></td>
                        ))}
                      </tr>
                    ))
                  : items.map((d) => (
                      <DetectionRow key={d.id} detection={d} onSelect={() => setSelected(d)} />
                    ))
                }
              </tbody>
            </table>

            {!isLoading && !isError && items.length === 0 && (
              <div className="py-16 text-center">
                <Eye className="h-8 w-8 text-foreground-subtle/50 mx-auto mb-2" />
                <p className="text-sm text-foreground-subtle font-medium">No detections found</p>
                <p className="text-xs text-foreground-subtle mt-1">
                  {violationsOnly ? "No violations recorded yet" : "Start a camera stream to see data"}
                </p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-2xs text-foreground-subtle font-mono">{data?.total} records total</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg text-foreground-subtle hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-foreground-subtle font-mono px-2 tabular-nums">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="p-1.5 rounded-lg text-foreground-subtle hover:bg-muted disabled:opacity-30 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Forensic inspector drawer */}
      <AnimatePresence>
        {selected && (
          <ForensicInspector detection={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function DetectionRow({ detection: d, onSelect }: { detection: Detection; onSelect: () => void }) {
  const frameUrl = evidenceUrl(d.frame_path);

  return (
    <tr
      onClick={onSelect}
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/40 group",
        d.is_violation && "bg-peach-50/30 hover:bg-peach-50/50 dark:bg-peach-900/10 dark:hover:bg-peach-900/20"
      )}
    >
      {/* Evidence thumbnail */}
      <td className="px-4 py-2.5">
        <div className="relative h-10 w-16 rounded-md overflow-hidden bg-muted border border-border shrink-0">
          {frameUrl ? (
            <img src={frameUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <FileImage className="h-3.5 w-3.5 text-foreground-subtle/50" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="h-3 w-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {d.is_violation && (
            <div className="absolute top-0 inset-x-0 h-1 bg-peach-500" />
          )}
        </div>
      </td>

      {/* Plate */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {d.detected_plate ? (
            <Link
              href={`/vehicles/${encodeURIComponent(d.detected_plate)}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-xs font-bold text-foreground hover:text-sage-700 dark:hover:text-sage-400 hover:underline plate-chip py-0.5"
              title="Open vehicle dossier"
            >
              {d.detected_plate}
            </Link>
          ) : (
            <span className="font-mono text-xs text-foreground-subtle italic">Unread</span>
          )}
        </div>
      </td>

      <td className="px-4 py-2.5">
        <span className="text-xs capitalize text-foreground-subtle">{d.vehicle_category ?? "—"}</span>
      </td>
      <td className="px-4 py-2.5"><ConfBadge value={d.ocr_confidence} /></td>
      <td className="px-4 py-2.5"><ConfBadge value={d.vehicle_confidence} /></td>
      <td className="px-4 py-2.5">
        {d.is_violation ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-2xs font-semibold bg-peach-50 border-peach-200 text-peach-800 dark:bg-peach-900/30 dark:border-peach-700/50 dark:text-peach-300">
            <ShieldAlert className="h-3 w-3" /> Violation
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-2xs font-semibold bg-sage-50 border-sage-200 text-sage-800 dark:bg-sage-900/30 dark:border-sage-700/50 dark:text-sage-300">
            <ShieldCheck className="h-3 w-3" /> Clear
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <span className="text-xs text-foreground-subtle capitalize">
          {d.violation_type?.replace(/_/g, " ") ?? "—"}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-xs font-mono text-foreground-subtle tabular-nums">
          {d.processing_time_ms != null ? `${d.processing_time_ms}ms` : "—"}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-xs font-mono text-foreground-subtle whitespace-nowrap">
          {format(new Date(d.timestamp), "dd MMM HH:mm:ss")}
        </span>
      </td>
    </tr>
  );
}

// ── Forensic Inspector — full evidence panel ───────────────────────────────────

function ForensicInspector({ detection: d, onClose }: { detection: Detection; onClose: () => void }) {
  const frameUrl = evidenceUrl(d.frame_path);
  const plateUrl = evidenceUrl(d.plate_crop_path);
  const isViolation = d.is_violation;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch justify-end"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-surface border-l border-border shadow-card-lg overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <header className={cn(
          "sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-4 border-b border-border",
          isViolation ? "bg-peach-50 dark:bg-peach-900/20" : "bg-sage-50 dark:bg-sage-900/20"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl border shrink-0",
              isViolation ? "bg-peach-100 border-peach-200" : "bg-sage-100 border-sage-200"
            )}>
              {isViolation
                ? <ShieldAlert className="h-5 w-5 text-peach-700 dark:text-peach-400" />
                : <ShieldCheck className="h-5 w-5 text-sage-700 dark:text-sage-400" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="plate-chip font-mono text-base">{d.detected_plate ?? "UNREAD"}</span>
                {isViolation && (
                  <span className="px-2 py-0.5 rounded-full bg-peach-100 border border-peach-200 text-peach-800 dark:bg-peach-900/40 dark:border-peach-700/50 dark:text-peach-300 text-2xs font-semibold uppercase tracking-wider">
                    {d.violation_type?.replace(/_/g, " ") ?? "Violation"}
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground-subtle font-mono mt-0.5">
                {format(new Date(d.timestamp), "dd MMM yyyy · HH:mm:ss.SSS")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-foreground-subtle hover:bg-muted hover:text-foreground transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 p-6 space-y-6">

          {/* Evidence ID */}
          <div className="flex items-center gap-2 text-2xs font-mono text-foreground-subtle bg-muted/60 border border-border rounded-lg px-3 py-2">
            <Tag className="h-3 w-3 shrink-0" />
            <span className="font-semibold text-foreground-muted">Evidence ID</span>
            <span className="ml-auto tabular-nums">{d.id}</span>
          </div>

          {/* Frame + plate crop */}
          <section>
            <p className="section-eyebrow mb-3">Forensic captures</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xs font-semibold text-foreground-subtle uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Camera className="h-3 w-3" /> Full Frame
                </p>
                <div className={cn(
                  "aspect-video bg-muted rounded-xl overflow-hidden border relative",
                  frameUrl ? "border-border" : "border-dashed border-border"
                )}>
                  {frameUrl ? (
                    <img src={frameUrl} alt="Evidence frame" className="w-full h-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <FileImage className="h-8 w-8 text-foreground-subtle/50" />
                      <p className="text-2xs text-foreground-subtle">No frame captured</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-2xs font-semibold text-foreground-subtle uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ImageIcon className="h-3 w-3" /> Plate Crop (OCR)
                </p>
                <div className={cn(
                  "aspect-video bg-muted rounded-xl overflow-hidden border relative",
                  plateUrl ? "border-border" : "border-dashed border-border"
                )}>
                  {plateUrl ? (
                    <img src={plateUrl} alt="Plate crop" className="w-full h-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <Eye className="h-8 w-8 text-foreground-subtle/50" />
                      <p className="text-2xs text-foreground-subtle">No crop saved</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* AI analysis */}
          <section>
            <p className="section-eyebrow mb-3">AI analysis</p>
            <div className="grid grid-cols-2 gap-3">
              <ForensicBlock title="OCR Results" icon={<Tag className="h-3.5 w-3.5" />}>
                <ForensicRow label="Plate Number">
                  <span className="font-mono font-bold text-foreground text-sm">
                    {d.detected_plate ?? "—"}
                  </span>
                </ForensicRow>
                <ForensicRow label="OCR Confidence"><ConfBadge value={d.ocr_confidence} /></ForensicRow>
                <ForensicRow label="Vehicle Conf."><ConfBadge value={d.vehicle_confidence} /></ForensicRow>
                <ForensicRow label="Plate Conf."><ConfBadge value={d.plate_confidence} /></ForensicRow>
              </ForensicBlock>

              <ForensicBlock title="Detection Info" icon={<Eye className="h-3.5 w-3.5" />}>
                <ForensicRow label="Vehicle Type">
                  <span className="capitalize text-foreground">{d.vehicle_category ?? "—"}</span>
                </ForensicRow>
                <ForensicRow label="Process Time">
                  <span className="font-mono text-foreground">
                    {d.processing_time_ms != null ? `${d.processing_time_ms}ms` : "—"}
                  </span>
                </ForensicRow>
                <ForensicRow label="Status">
                  {isViolation
                    ? <span className="inline-flex items-center gap-1 text-2xs font-semibold text-peach-700 dark:text-peach-400"><ShieldAlert className="h-3 w-3" /> Violation</span>
                    : <span className="inline-flex items-center gap-1 text-2xs font-semibold text-sage-700 dark:text-sage-400"><ShieldCheck className="h-3 w-3" /> Clear</span>
                  }
                </ForensicRow>
                <ForensicRow label="Record ID">
                  <span className="font-mono text-foreground-subtle">{String(d.id).slice(0, 8).toUpperCase()}</span>
                </ForensicRow>
              </ForensicBlock>
            </div>
          </section>

          {/* Violation detail */}
          {isViolation && d.violation_type && (
            <section>
              <p className="section-eyebrow mb-3">Violation details</p>
              <div className="rounded-xl border border-peach-200 bg-peach-50 dark:border-peach-700/40 dark:bg-peach-900/20 p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="h-5 w-5 text-peach-700 dark:text-peach-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-peach-900 dark:text-peach-100 capitalize">
                      {d.violation_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-2xs text-peach-600 dark:text-peach-400 font-mono mt-0.5">
                      Detected at {format(new Date(d.timestamp), "HH:mm:ss")} · {format(new Date(d.timestamp), "dd MMM yyyy")}
                    </p>
                  </div>
                </div>
                {d.detected_plate && (
                  <Link
                    href={`/vehicles/${encodeURIComponent(d.detected_plate)}`}
                    className="flex items-center gap-2 text-xs font-semibold text-sage-700 dark:text-sage-400 hover:underline mt-2"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    View full vehicle dossier →
                  </Link>
                )}
              </div>
            </section>
          )}

          {/* Timestamp + metadata strip */}
          <section className="flex flex-wrap gap-3 text-2xs text-foreground-subtle font-mono border-t border-border pt-4">
            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {format(new Date(d.timestamp), "dd MMM yyyy HH:mm:ss")}</span>
            {d.detected_plate && (
              <span className="flex items-center gap-1.5 ml-auto">
                <Activity className="h-3 w-3" />
                <Link href={`/vehicles/${encodeURIComponent(d.detected_plate)}`} className="text-sage-600 dark:text-sage-400 hover:underline">
                  Open dossier
                </Link>
              </span>
            )}
          </section>
        </div>
      </motion.aside>
    </motion.div>
  );
}

function ForensicBlock({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/60 rounded-xl border border-border p-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle mb-3 flex items-center gap-1.5">
        {icon} {title}
      </p>
      <div className="space-y-0 divide-y divide-border/60">{children}</div>
    </div>
  );
}

function ForensicRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-3">
      <span className="text-2xs text-foreground-subtle shrink-0">{label}</span>
      <span className="text-xs text-right">{children}</span>
    </div>
  );
}
