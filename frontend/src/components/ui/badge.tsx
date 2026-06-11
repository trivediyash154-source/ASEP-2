import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 rounded-full",
    "px-2 py-0.5 text-2xs font-semibold tracking-[0.04em]",
    "border whitespace-nowrap",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-stone-100 text-foreground border-border dark:bg-stone-800/60",
        sage:    "bg-sage-100 text-sage-800 border-sage-200 dark:bg-sage-900/40 dark:text-sage-300 dark:border-sage-700/50",
        peach:   "bg-peach-50 text-peach-800 border-peach-200 dark:bg-peach-900/30 dark:text-peach-300 dark:border-peach-700/50",
        bronze:  "bg-bronze-50 text-bronze-800 border-bronze-200 dark:bg-bronze-900/30 dark:text-bronze-300 dark:border-bronze-700/50",
        success: "bg-sage-100 text-sage-800 border-sage-200 dark:bg-sage-900/40 dark:text-sage-300 dark:border-sage-700/50",
        warning: "bg-bronze-50 text-bronze-800 border-bronze-200 dark:bg-bronze-900/30 dark:text-bronze-300 dark:border-bronze-700/50",
        danger:  "bg-[hsl(0_45%_96%)] text-[hsl(0_40%_38%)] border-[hsl(0_45%_88%)] dark:bg-[hsl(0_40%_20%/0.4)] dark:text-[hsl(0_55%_72%)] dark:border-[hsl(0_35%_34%)]",
        info:    "bg-[hsl(210_30%_96%)] text-[hsl(210_30%_32%)] border-[hsl(210_30%_88%)] dark:bg-[hsl(210_25%_22%/0.5)] dark:text-[hsl(210_35%_72%)] dark:border-[hsl(210_20%_34%)]",
        neutral: "bg-stone-100 text-foreground-muted border-border dark:bg-stone-800/60",
        outline: "bg-transparent text-foreground border-border-strong",
      },
      size: {
        sm: "h-5 px-1.5 text-[0.625rem]",
        md: "h-[1.375rem] px-2 text-2xs",
        lg: "h-6 px-2.5 text-xs",
      },
      dot: {
        true: "pl-1.5",
        false: "",
      },
    },
    defaultVariants: { variant: "default", size: "md", dot: false },
  }
);

const dotColors: Record<string, string> = {
  default: "bg-foreground-subtle",
  sage:    "bg-sage-600",
  peach:   "bg-peach-500",
  bronze:  "bg-bronze-500",
  success: "bg-status-success",
  warning: "bg-status-warning",
  danger:  "bg-status-danger",
  info:    "bg-status-info",
  neutral: "bg-foreground-subtle",
  outline: "bg-foreground-subtle",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  withDot?: boolean;
  pulse?: boolean;
}

export function Badge({ className, variant, size, withDot, pulse, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, dot: withDot }), className)} {...props}>
      {withDot && (
        <span className="relative inline-flex items-center justify-center">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[variant ?? "default"])} />
          {pulse && (
            <span
              className={cn(
                "absolute inset-0 rounded-full opacity-60",
                dotColors[variant ?? "default"]
              )}
              style={{ animation: "pulseRing 2s cubic-bezier(0.16, 1, 0.3, 1) infinite" }}
            />
          )}
        </span>
      )}
      {children}
    </span>
  );
}

export { badgeVariants };
