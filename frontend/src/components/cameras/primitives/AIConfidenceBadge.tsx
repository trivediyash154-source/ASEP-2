import { cn } from "@/lib/utils";

interface Props {
  /** Value between 0 and 1 */
  value?: number;
  label?: string;
  size?: "xs" | "sm";
  surface?: "dark" | "light";
  className?: string;
}

/**
 * Compact AI confidence indicator. On the dark feed surface it uses
 * de-saturated brand tones for readability; on light cards it uses the
 * regular sage/bronze/peach scale.
 */
export function AIConfidenceBadge({ value, label = "OCR", size = "sm", surface = "dark", className }: Props) {
  if (value === undefined || value === null) return null;
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.9 ? "high"
    : value >= 0.75 ? "med"
    : "low";

  const styles = {
    dark: {
      high: "bg-emerald-500/15 text-emerald-200 border-emerald-300/30",
      med:  "bg-bronze-400/15  text-bronze-200  border-bronze-300/30",
      low:  "bg-peach-400/15   text-peach-200   border-peach-300/30",
    },
    light: {
      high: "bg-sage-100 text-sage-800 border-sage-200",
      med:  "bg-bronze-50 text-bronze-800 border-bronze-200",
      low:  "bg-peach-50 text-peach-800 border-peach-200",
    },
  }[surface][tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-mono font-semibold tabular-nums",
        size === "xs"
          ? "h-4 px-1.5 text-[0.625rem] tracking-[0.04em]"
          : "h-5 px-2 text-[0.6875rem] tracking-[0.04em]",
        styles,
        className
      )}
    >
      <span className="opacity-70 uppercase">{label}</span>
      <span>{pct}%</span>
    </span>
  );
}
