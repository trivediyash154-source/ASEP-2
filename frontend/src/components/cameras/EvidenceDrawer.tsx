"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertOctagon,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Fingerprint,
  GaugeCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { useCamerasStore, type LiveDetectionEvent } from "@/lib/stores/cameras.store";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";
import type { Detection } from "@/lib/types";

import { CameraFeedCanvas } from "./primitives/CameraFeedCanvas";
import { AIConfidenceBadge } from "./primitives/AIConfidenceBadge";

/**
 * Slide-in evidence panel. Triggered by clicking any detection — on the
 * feed, in the side stream, or in the incident rail. Shows the detection
 * frame (with bbox re-drawn at this scale), all OCR/AI metadata, vehicle
 * intelligence summary, violation details, and quick actions.
 */
export function EvidenceDrawer() {
  const selectedId = useCamerasStore((s) => s.selectedDetectionId);
  const close = () => useCamerasStore.getState().selectDetection(null);
  const events = useCamerasStore((s) => s.events);
  const liveEvent = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  );

  // Deep-fetch from API so vehicles that scrolled off the live stream still work
  const { data: fullDetection } = useQuery<Detection | null>({
    queryKey: ["detection", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const r = await apiClient.get<Detection>(`/detections/${selectedId}`);
      return r.data;
    },
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  // Esc closes
  useEffect(() => {
    if (!selectedId) return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId]);

  return (
    <AnimatePresence>
      {selectedId && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-stone-900/30 backdrop-blur-[2px]"
            onClick={close}
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[540px] bg-surface border-l border-border shadow-popover flex flex-col"
          >
            <DrawerBody event={liveEvent} detection={fullDetection ?? null} onClose={close} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ════════════════════════════════════════════════════════════════════
// Drawer body
// ════════════════════════════════════════════════════════════════════

interface DrawerBodyProps {
  event: LiveDetectionEvent | null;
  detection: Detection | null;
  onClose: () => void;
}

function DrawerBody({ event, detection, onClose }: DrawerBodyProps) {
  // Prefer the live event (richer payload), fall back to the API row
  const e = event;
  const d = detection;
  const plate = e?.plate ?? d?.detected_plate ?? "—";
  const violation = e?.is_violation ?? d?.is_violation ?? false;
  const violationType = e?.violation_type ?? d?.violation_type ?? null;
  const cameraId = e?.camera_id ?? d?.camera_id ?? "";
  const cameraCode = e?.camera_code;
  const cameraLocation = e?.camera_location;
  const timestamp = e?.timestamp ?? d?.timestamp ?? new Date().toISOString();

  const copyPlate = () => {
    navigator.clipboard.writeText(plate).then(
      () => toast.success("Plate copied", { description: plate }),
      () => toast.error("Copy failed")
    );
  };

  return (
    <>
      {/* Header */}
      <header className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow flex items-center gap-1.5">
            <Fingerprint className="h-3 w-3" />
            Evidence packet
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground tracking-tight">
            {plate}
          </h2>
          <p className="mt-0.5 text-xs text-foreground-muted">
            {cameraCode ? `${cameraCode} · ` : ""}
            {cameraLocation ?? "Unknown location"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close evidence drawer"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-surface hover:bg-stone-50 text-foreground-subtle hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Mini feed re-render */}
        {cameraId && (
          <div className="relative">
            <CameraFeedCanvas
              cameraId={cameraId}
              cameraCode={cameraCode}
              density="comfortable"
              online
              hud="full"
              aspectRatio="16 / 9"
            />
          </div>
        )}

        {/* Verdict banner */}
        <div
          className={cn(
            "mx-5 mt-5 rounded-xl border p-4 flex items-start gap-3",
            violation
              ? "bg-peach-50 border-peach-200"
              : "bg-sage-50 border-sage-200"
          )}
        >
          <div
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
              violation
                ? "bg-peach-200 text-peach-800"
                : "bg-sage-200 text-sage-800"
            )}
          >
            {violation ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-display text-base font-semibold tracking-tight",
                violation ? "text-peach-900" : "text-sage-900"
              )}
            >
              {violation ? (violationType ?? "Violation detected") : "Compliant pass"}
            </p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {violation
                ? "Vehicle flagged against registry compliance database."
                : "All compliance checks passed."}
            </p>
            {violation && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-peach-800">
                <AlertOctagon className="h-3.5 w-3.5" />
                Auto-recommended fine · {formatCurrency(suggestedFine(violationType))}
              </div>
            )}
          </div>
        </div>

        {/* Metadata grid */}
        <section className="px-5 py-5 grid grid-cols-2 gap-3">
          <Metric
            label="OCR confidence"
            value={e?.ocr_confidence ?? d?.ocr_confidence}
            asPercent
          />
          <Metric
            label="Vehicle conf."
            value={e?.vehicle_confidence ?? d?.vehicle_confidence}
            asPercent
          />
          <Metric
            label="Plate conf."
            value={e?.plate_confidence ?? d?.plate_confidence}
            asPercent
          />
          <Metric
            label="Inference"
            value={e?.processing_time_ms ?? d?.processing_time_ms}
            suffix="ms"
          />
        </section>

        {/* Identity */}
        <section className="px-5 pb-5">
          <header className="flex items-center justify-between mb-2.5">
            <h3 className="section-title">Vehicle dossier</h3>
            <span className="text-2xs text-foreground-subtle font-mono">
              Auto-resolved from registry
            </span>
          </header>
          <dl className="surface-sunken p-4 space-y-2.5 text-sm">
            <Row label="Plate" value={plate} mono action={<button onClick={copyPlate} className="inline-flex items-center gap-1 text-2xs text-sage-700 hover:text-sage-900"><Copy className="h-3 w-3" /> Copy</button>} />
            {e?.vehicle_make && <Row label="Make / Model" value={`${e.vehicle_make} ${e.vehicle_model ?? ""}`} />}
            {e?.vehicle_color && <Row label="Color" value={e.vehicle_color} />}
            {e?.vehicle_year && <Row label="Year" value={String(e.vehicle_year)} />}
            {e?.vehicle_category && (
              <Row
                label="Category"
                value={e.vehicle_category.replace("_", " ")}
                capitalize
              />
            )}
            <Row label="Detected at" value={new Date(timestamp).toLocaleString("en-IN", { hour12: false })} mono />
            <Row label="Time ago" value={timeAgo(timestamp)} />
          </dl>
        </section>

        {/* AI assessment */}
        <section className="px-5 pb-6">
          <header className="flex items-center justify-between mb-2.5">
            <h3 className="section-title flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-sage-700" />
              AI assessment
            </h3>
          </header>
          <div className="surface-sunken p-4 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <GaugeCircle className="h-4 w-4 text-sage-700" />
              <div className="flex-1">
                <p className="text-2xs uppercase tracking-[0.14em] text-foreground-subtle font-semibold">
                  Combined OCR + ANPR confidence
                </p>
                <ConfidenceBar value={averageConfidence(e, d)} />
              </div>
            </div>
            <p className="text-xs text-foreground-muted leading-relaxed text-pretty">
              {violation
                ? "Recommend issuing challan. Vehicle registered to a verified owner; contact details on file. Notification routed via SMS + email queue."
                : "No enforcement action required. Detection added to compliance audit trail."}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <AIConfidenceBadge value={e?.ocr_confidence ?? d?.ocr_confidence} label="OCR" surface="light" />
              <AIConfidenceBadge value={e?.vehicle_confidence ?? d?.vehicle_confidence} label="OBJ" surface="light" />
              <AIConfidenceBadge value={e?.plate_confidence ?? d?.plate_confidence} label="PLT" surface="light" />
            </div>
          </div>
        </section>
      </div>

      {/* Footer actions */}
      <footer className="px-5 py-3 border-t border-border bg-stone-50/60 flex items-center justify-between gap-2">
        <a
          href={`/vehicles/${encodeURIComponent(plate)}`}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-sage-300 bg-sage-50 text-xs font-semibold text-sage-800 hover:bg-sage-100"
        >
          <Fingerprint className="h-3 w-3" />
          Open dossier
          <ExternalLink className="h-3 w-3" />
        </a>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-surface text-xs font-medium text-foreground hover:bg-stone-50">
            <Download className="h-3 w-3" />
            Export packet
          </button>
          {violation && (
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-peach-500 text-white text-xs font-semibold hover:bg-peach-600">
              Issue challan
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>
      </footer>
    </>
  );
}

function suggestedFine(violationType: string | null): number {
  switch (violationType) {
    case "Blacklisted Vehicle":     return 10000;
    case "Expired Registration":    return 5000;
    case "Speeding":                return 3000;
    case "Expired Insurance":       return 2000;
    case "Expired Pollution Cert":  return 1500;
    case "Signal Jump":             return 1500;
    default:                        return 1500;
  }
}

function averageConfidence(e: LiveDetectionEvent | null, d: Detection | null): number | undefined {
  const vals = [
    e?.ocr_confidence ?? d?.ocr_confidence,
    e?.vehicle_confidence ?? d?.vehicle_confidence,
    e?.plate_confidence ?? d?.plate_confidence,
  ].filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function Metric({
  label,
  value,
  asPercent,
  suffix,
}: {
  label: string;
  value?: number;
  asPercent?: boolean;
  suffix?: string;
}) {
  const display =
    value === undefined || value === null
      ? "—"
      : asPercent
      ? `${(value * 100).toFixed(1)}%`
      : `${value}${suffix ?? ""}`;
  return (
    <div className="surface-sunken px-3 py-2.5">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">{label}</p>
      <p className="mt-1 font-display text-base font-semibold text-foreground tabular-nums">{display}</p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  capitalize,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-foreground-subtle font-semibold uppercase tracking-[0.12em] shrink-0">{label}</dt>
      <dd className={cn("text-sm text-foreground text-right", mono && "font-mono", capitalize && "capitalize")}>
        <span>{value}</span>
        {action && <span className="ml-2">{action}</span>}
      </dd>
    </div>
  );
}

function ConfidenceBar({ value }: { value?: number }) {
  if (value === undefined) return <p className="text-sm text-foreground-subtle">—</p>;
  const pct = Math.round(value * 100);
  return (
    <div className="mt-1.5 flex items-center gap-2.5">
      <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sage-500 to-sage-600"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-display text-sm font-semibold tabular-nums text-foreground">{pct}%</span>
    </div>
  );
}
