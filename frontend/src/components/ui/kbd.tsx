import { cn } from "@/lib/utils";

export function Kbd({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5",
        "rounded-md border border-border bg-stone-50 text-2xs font-medium",
        "font-mono text-foreground-muted shadow-xs",
        className
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
