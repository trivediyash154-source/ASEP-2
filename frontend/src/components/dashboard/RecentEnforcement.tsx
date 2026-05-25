"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

import { challansApi } from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, getChallanStatusTone, timeAgo } from "@/lib/utils";
import type { Challan, PaginatedResponse } from "@/lib/types";

export function RecentEnforcement() {
  const { data, isLoading } = useQuery({
    queryKey: ["challans", "recent"],
    queryFn: () => challansApi.list(1, 8).then((r) => r.data as PaginatedResponse<Challan>),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const items = data?.items ?? [];

  return (
    <section className="surface-panel">
      <header className="flex items-end justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-border">
        <div>
          <p className="section-eyebrow">Enforcement queue</p>
          <h3 className="font-display text-base font-semibold text-foreground tracking-tight mt-0.5">
            Recent challans
          </h3>
        </div>
        <a
          href="/challans"
          className="inline-flex items-center gap-1 text-xs font-medium text-sage-700 hover:text-sage-900 transition-colors"
        >
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </header>

      <div className="px-2 sm:px-3 py-2">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-foreground-subtle py-8 text-center">No challans issued yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Challan</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Violation</TableHead>
                <TableHead className="text-right">Fine</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-4">Issued</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => {
                const tone = getChallanStatusTone(c.status);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="pl-4">
                      <span className="data-mono text-[0.78125rem] text-foreground">{c.challan_number}</span>
                    </TableCell>
                    <TableCell>
                      <span className="plate-chip">{c.plate_number}</span>
                    </TableCell>
                    <TableCell className="text-foreground-muted">{c.violation_type}</TableCell>
                    <TableCell className="text-right font-display font-semibold tabular-nums">
                      {formatCurrency(Number(c.fine_amount))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tone.variant === "default" ? "neutral" : tone.variant} withDot size="sm">
                        {tone.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4 text-2xs font-mono text-foreground-subtle tabular-nums">
                      {timeAgo(c.issued_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}
