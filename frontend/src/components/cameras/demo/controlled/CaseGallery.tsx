"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";

import type { DemoCaseSummary } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

interface Props {
  cases: DemoCaseSummary[];
  loading?: boolean;
  onSelect: (c: DemoCaseSummary) => void;
}

const SEVERITY: Record<DemoCaseSummary["severity"], { ring: string; chip: string; label: string; icon: typeof CheckCircle2 }> = {
  info:     { ring: "ring-sage-400/50",   chip: "bg-sage-500/15 text-sage-700 dark:text-sage-200",        label: "CLEAN",     icon: CheckCircle2 },
  low:      { ring: "ring-peach-400/40",  chip: "bg-peach-500/15 text-peach-700 dark:text-peach-200",     label: "LOW",       icon: Sparkles },
  medium:   { ring: "ring-peach-500/60",  chip: "bg-peach-500/20 text-peach-800 dark:text-peach-100",     label: "MEDIUM",    icon: AlertTriangle },
  high:     { ring: "ring-[#bd8658]/70",  chip: "bg-[#bd8658]/20 text-[#7a4a28] dark:text-[#fcc99a]",     label: "HIGH",      icon: AlertTriangle },
  critical: { ring: "ring-status-danger/70", chip: "bg-status-danger/15 text-status-danger",              label: "CRITICAL",  icon: ShieldAlert },
};

export function CaseGallery({ cases, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[16/10] rounded-xl bg-stone-200/40 dark:bg-stone-800/40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
      {cases.map((c, idx) => {
        const sev = SEVERITY[c.severity];
        const SevIcon = sev.icon;
        return (
          <motion.button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: idx * 0.035, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -3 }}
            className={cn(
              "group relative text-left rounded-xl overflow-hidden border border-border bg-surface",
              "transition-[transform,box-shadow,border-color] duration-200",
              "hover:border-border-strong hover:shadow-card-md focus-visible:outline-none focus-visible:ring-focus",
              "ring-1", sev.ring,
            )}
          >
            <div className="relative aspect-[16/10] bg-black overflow-hidden">
              <Image
                src={c.image}
                alt={c.title}
                fill
                sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                priority={idx < 4}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/30 pointer-events-none" />
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <span className={cn("inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[10px] font-bold uppercase tracking-[0.14em]", sev.chip)}>
                  <SevIcon className="h-3 w-3" />
                  {sev.label}
                </span>
              </div>
              <div className="absolute top-2 right-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/85 bg-black/45 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                {c.camera_code}
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                <div className="font-mono text-xs font-bold tracking-wider text-white drop-shadow">
                  {c.plate}
                </div>
                <div className="font-mono text-[10px] text-white/70 tabular-nums">
                  conf {(c.ocr_confidence * 100).toFixed(0)}%
                </div>
              </div>
              {/* Scan line */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-y-[200px] transition-all duration-700" />
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold tracking-tight text-foreground leading-tight line-clamp-1">
                {c.title}
              </p>
              <p className="mt-0.5 text-2xs text-foreground-subtle line-clamp-1 font-mono uppercase tracking-[0.12em]">
                {c.thumbnail_caption}
              </p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
