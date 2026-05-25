import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-14",
        "border border-dashed border-border-strong rounded-xl bg-stone-50/40",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-4 h-12 w-12 rounded-full bg-stone-100 border border-border flex items-center justify-center text-foreground-subtle [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold font-display tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-foreground-muted max-w-md text-pretty">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
