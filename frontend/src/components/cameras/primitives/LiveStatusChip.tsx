import { cn } from "@/lib/utils";

type Variant = "live" | "maintenance" | "error" | "offline";

const variants: Record<
  Variant,
  { dot: string; ring: string; text: string; bg: string; label: string }
> = {
  live:        { dot: "bg-emerald-400",   ring: "ring-emerald-400/30",   text: "text-emerald-300", bg: "bg-emerald-500/10", label: "LIVE" },
  maintenance: { dot: "bg-bronze-400",    ring: "ring-bronze-400/30",    text: "text-bronze-300",  bg: "bg-bronze-500/10",  label: "MAINT" },
  error:       { dot: "bg-peach-400",     ring: "ring-peach-400/30",     text: "text-peach-300",   bg: "bg-peach-500/10",   label: "FAULT" },
  offline:     { dot: "bg-stone-400",     ring: "ring-stone-400/30",     text: "text-stone-300",   bg: "bg-stone-700/40",   label: "OFFLINE" },
};

interface Props {
  variant: Variant;
  label?: string;
  pulse?: boolean;
  className?: string;
}

/**
 * Tactical status chip designed to sit on top of the dark feed surface.
 * Use only inside CCTV-like dark contexts — the chrome above the feed
 * uses the regular Badge primitive.
 */
export function LiveStatusChip({ variant, label, pulse = true, className }: Props) {
  const v = variants[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-5 px-2 rounded-md border",
        "font-mono text-[0.625rem] font-semibold tracking-[0.16em] uppercase",
        "backdrop-blur-[2px]",
        v.bg,
        v.text,
        "border-current/20",
        className
      )}
    >
      <span className="relative inline-flex items-center justify-center">
        <span className={cn("h-1.5 w-1.5 rounded-full ring-2", v.dot, v.ring)} />
        {pulse && variant === "live" && (
          <span
            className={cn("absolute inset-0 rounded-full opacity-70", v.dot)}
            style={{ animation: "pulseRing 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite" }}
          />
        )}
      </span>
      {label ?? v.label}
    </span>
  );
}
