"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle, ChevronLeft, ChevronRight, Clock, Download,
  FileText, Filter, IndianRupee, Plus, Search, TrendingUp, XCircle,
} from "lucide-react";
import { challansApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Challan } from "@/lib/types";

const STATUS_TABS = [
  { key: "all",      label: "All" },
  { key: "issued",   label: "Issued" },
  { key: "paid",     label: "Paid" },
  { key: "overdue",  label: "Overdue" },
  { key: "disputed", label: "Disputed" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  issued:   "badge-info",
  paid:     "badge-active",
  overdue:  "badge-error",
  disputed: "badge-warning",
  cancelled:"badge-neutral",
};

export function ChallansView() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["challans", page, statusFilter],
    queryFn: () => challansApi.list(page, 20, statusFilter === "all" ? undefined : statusFilter)
      .then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["challan-stats"],
    queryFn: () => challansApi.stats().then((r) => r.data),
    refetchInterval: 60_000,
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  const handleDownloadPdf = async (id: string, number: string) => {
    try {
      const { data: blob } = await challansApi.downloadPdf(id);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `challan-${number}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch {
      toast.error("PDF generation failed");
    }
  };

  const filtered = (data?.items ?? []).filter((c: Challan) =>
    !search || c.plate_number.includes(search.toUpperCase()) ||
    c.challan_number.includes(search.toUpperCase())
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-screen-2xl mx-auto space-y-5">

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Issued", icon: IndianRupee,
              value: statsLoading ? "—" : `₹${((stats?.total_issued ?? 0) / 1000).toFixed(0)}K`,
              color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100",
            },
            {
              label: "Collected", icon: CheckCircle,
              value: statsLoading ? "—" : `₹${((stats?.total_collected ?? 0) / 1000).toFixed(0)}K`,
              color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100",
            },
            {
              label: "Pending Count", icon: Clock,
              value: statsLoading ? "—" : (stats?.pending_count ?? 0),
              color: "text-amber-600", bg: "bg-amber-50 border-amber-100",
            },
            {
              label: "Collection Rate", icon: TrendingUp,
              value: statsLoading ? "—" : `${stats?.collection_rate ?? 0}%`,
              color: "text-blue-600", bg: "bg-blue-50 border-blue-100",
            },
          ].map(({ label, icon: Icon, value, color, bg }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn("rounded-xl border p-4", bg)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
            </motion.div>
          ))}
        </div>

        {/* Table card */}
        <div className="card-section overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
            {/* Status tabs */}
            <div className="flex items-center gap-0.5">
              {STATUS_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => { setStatusFilter(key); setPage(1); }}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                    statusFilter === key
                      ? "bg-indigo-600 text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search plate / challan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none w-40"
                />
              </div>
              <button className="btn-primary btn-sm">
                <Plus className="h-3.5 w-3.5" />
                Issue Challan
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {["Challan #", "Plate", "Violation", "Fine", "Owner", "Status", "Issued", "Due", ""].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 8 }, (_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 9 }, (_, j) => (
                          <td key={j}><div className="skeleton h-3 rounded w-full max-w-[100px]" /></td>
                        ))}
                      </tr>
                    ))
                  : filtered.map((c: Challan) => (
                      <ChallanRow
                        key={c.id}
                        challan={c}
                        onDownload={() => handleDownloadPdf(c.id, c.challan_number)}
                      />
                    ))
                }
              </tbody>
            </table>

            {!isLoading && filtered.length === 0 && (
              <div className="py-16 text-center">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No challans found</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                {data.total} total · page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-ghost btn-sm disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "h-7 w-7 rounded text-xs font-medium transition-all",
                        p === page
                          ? "bg-indigo-600 text-white"
                          : "text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-ghost btn-sm disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChallanRow({ challan: c, onDownload }: { challan: Challan; onDownload: () => void }) {
  return (
    <tr>
      <td>
        <span className="font-mono text-xs text-indigo-600 font-semibold">{c.challan_number}</span>
      </td>
      <td>
        <span className="font-mono font-bold text-slate-900 text-xs">{c.plate_number}</span>
      </td>
      <td>
        <span className="text-xs text-slate-600 capitalize">
          {c.violation_type.replace(/_/g, " ")}
        </span>
      </td>
      <td>
        <span className="font-mono font-semibold text-slate-800 text-xs">
          ₹{c.fine_amount.toLocaleString()}
        </span>
      </td>
      <td>
        <div>
          <p className="text-xs text-slate-700 font-medium">{c.owner_name ?? "—"}</p>
          {c.owner_phone && (
            <p className="text-2xs text-slate-400 font-mono">{c.owner_phone}</p>
          )}
        </div>
      </td>
      <td>
        <span className={cn("badge", STATUS_BADGE[c.status] ?? "badge-neutral")}>
          {c.status}
        </span>
      </td>
      <td>
        <span className="text-xs text-slate-500 font-mono">
          {format(new Date(c.issued_at), "dd MMM yy")}
        </span>
      </td>
      <td>
        <span className={cn(
          "text-xs font-mono",
          c.due_date && new Date(c.due_date) < new Date() && c.status === "issued"
            ? "text-red-600 font-semibold" : "text-slate-500"
        )}>
          {c.due_date ? format(new Date(c.due_date), "dd MMM yy") : "—"}
        </span>
      </td>
      <td>
        <button
          onClick={onDownload}
          className="btn-icon btn-sm"
          title="Download PDF"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}
