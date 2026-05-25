import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  sizeVariant?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-8 text-xs",
  md: "h-9 text-sm",
  lg: "h-11 text-base",
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", leadingIcon, trailingIcon, sizeVariant = "md", ...props }, ref) => {
    const wrapper = leadingIcon || trailingIcon;

    const baseInput = cn(
      "w-full rounded-lg border border-border bg-surface text-foreground",
      "placeholder:text-foreground-subtle/80",
      "transition-[border-color,box-shadow] duration-150",
      "outline-none focus:border-sage-500 focus:ring-focus",
      "disabled:opacity-50 disabled:bg-stone-100",
      sizeClasses[sizeVariant],
      leadingIcon ? "pl-9" : "px-3",
      trailingIcon ? "pr-9" : "pr-3",
      !leadingIcon && !trailingIcon && "px-3",
      className
    );

    if (!wrapper) {
      return <input type={type} ref={ref} className={baseInput} {...props} />;
    }

    return (
      <div className="relative w-full">
        {leadingIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle pointer-events-none [&_svg]:h-4 [&_svg]:w-4">
            {leadingIcon}
          </span>
        )}
        <input type={type} ref={ref} className={baseInput} {...props} />
        {trailingIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle [&_svg]:h-4 [&_svg]:w-4">
            {trailingIcon}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "block text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle mb-1.5",
        className
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";

export { Input, Label };
