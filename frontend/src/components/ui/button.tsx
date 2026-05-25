"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none",
    "rounded-lg font-medium tracking-tight",
    "transition-[background-color,box-shadow,transform,color,border-color] duration-150 ease-out-quart",
    "disabled:opacity-55 disabled:pointer-events-none",
    "focus-visible:outline-none focus-visible:ring-focus",
    "active:scale-[0.985]",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-sage-600 text-white shadow-sm hover:bg-sage-700 hover:shadow-card-md",
        secondary:
          "bg-surface text-foreground border border-border shadow-xs hover:bg-stone-50 hover:border-border-strong",
        ghost:
          "text-foreground-muted hover:bg-stone-100 hover:text-foreground",
        accent:
          "bg-peach-400 text-peach-900 shadow-sm hover:bg-peach-500 hover:text-white hover:shadow-card-md",
        bronze:
          "bg-bronze-500 text-white shadow-sm hover:bg-bronze-600 hover:shadow-card-md",
        outline:
          "border border-border-strong text-foreground bg-transparent hover:bg-stone-50",
        danger:
          "bg-status-danger text-white shadow-sm hover:brightness-105",
        link:
          "text-sage-700 underline-offset-4 hover:underline px-0 h-auto active:scale-100",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading, leadingIcon, trailingIcon, children, disabled, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : leadingIcon}
        {children}
        {!loading && trailingIcon}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
