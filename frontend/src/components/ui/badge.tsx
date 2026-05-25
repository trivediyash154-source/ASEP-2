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
        default: "bg-stone-100 text-foreground border-border",
        sage:    "bg-sage-100 text-sage-800 border-sage-200",
        peach:   "bg-peach-50 text-peach-800 border-peach-200",
        bronze:  "bg-bronze-50 text-bronze-800 border-bronze-200",
        success: "bg-sage-100 text-sage-800 border-sage-200",
        warning: "bg-bronze-50 text-bronze-800 border-bronze-200",
        danger:  "bg-[hsl(0_45%_96%)] text-[hsl(0_40%_38%)] border-[hsl(0_45%_88%)]",
        info:    "bg-[hsl(210_30%_96%)] text-[hsl(210_30%_32%)] border-[hsl(210_30%_88%)]",
        neutral: "bg-stone-100 text-foreground-muted border-border",
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
