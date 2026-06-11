"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

import { challansApi } from "@/lib/api/endpoints";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCompact } from "@/lib/utils";
import { differenceInCalendarDays, format } from "date-fns";
import type { Challan, PaginatedResponse } from "@/lib/types";

/**
 * Right zone of the command center — the live enforcement queue.
 * Open cases ordered as they need attention: what's owed, by whom,
 * and how close to (or past) the payment deadline.
 */
export function EnforcementQueuePanel({ className }: { className?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["challans", "queue-panel"],
    queryFn: () => challansApi.list(1, 12, "issued").then((r) => r.data as PaginatedResponse<Challan>),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const items = data?.items ?? [];

  return (
    <section className={cn("op-surface flex flex-col min-h-0", className)} aria-label="Enforcement queue">
      <header className="ops-header shrink-0">
        <span className="ops-title">Enforcement Queue</span>
        <span className="ops-meta">{data?.total ?? "—"} open</span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="h-full flex items-center justify-center px-6 py-10">
            <span className="font-mono text-2xs uppercase tracking-[0.16em] text-foreground-subtle">
              Queue clear
            </span>
          </div>
        ) : (
          <ul>
            {items.map((c) => {
              const overdue = c.due_date && new Date(c.due_date) < new Date();
              const daysLeft = c.due_date
                ? differenceInCalendarDays(new Date(c.due_date), new Date())
                : null;
              return (
                <li key={c.id} className="relative px-4 py-2.5 border-b border-border/60 hover:bg-muted/30 transition-colors">
                  <span className={overdue ? "severity-rail-critical" : c.fine_amount >= 5000 ? "severity-rail-high" : "severity-rail-medium"} aria-hidden />
                  <div className="flex items-center justify-between gap-2">
                    <span className="plate-chip text-[0.6875rem] py-0 shrink-0">{c.plate_number}</span>
                    <span className="font-display text-sm font-semibold tabular-nums text-foreground shrink-0">
                      ₹{c.fine_amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-2xs text-foreground-muted capitalize truncate">
                      {c.violation_type.replace(/_/g, " ")}
                    </span>
                    <span className={cn(
                      "font-mono text-2xs tabular-nums shrink-0",
                      overdue ? "text-threat-critical font-semibold" : "text-foreground-subtle"
                    )}>
                      {overdue
                        ? `overdue ${Math.abs(daysLeft ?? 0)}d`
                        : daysLeft != null
                          ? `due ${daysLeft}d`
                          : format(new Date(c.issued_at), "dd MMM")}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="shrink-0 px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
        <span className="font-mono text-2xs text-foreground-subtle uppercase tracking-[0.1em]">
          {data ? `${formatCompact(data.total)} cases` : "—"}
        </span>
        <a
          href="/challans"
          className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-[0.1em] text-sage-700 dark:text-sage-400 hover:text-sage-900 dark:hover:text-sage-300 transition-colors"
        >
          Open queue <ArrowUpRight className="h-3 w-3" />
        </a>
      </footer>
    </section>
  );
}
