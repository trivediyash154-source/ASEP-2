"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, Clock, Shield, ShieldAlert, ShieldCheck, ShieldOff,
  User, Users, XCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { adminApi } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/stores/auth.store";
import { cn } from "@/lib/utils";

type UserRole = "superadmin" | "admin" | "operator" | "viewer";

interface UserRecord {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  last_login: string | null;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
  user_email: string | null;
  user_name: string | null;
}

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; border: string; text: string; icon: typeof Shield }> = {
  superadmin: { label: "Superadmin", color: "bg-peach-100",  border: "border-peach-200",  text: "text-peach-800",  icon: ShieldAlert },
  admin:      { label: "Admin",      color: "bg-bronze-100", border: "border-bronze-200", text: "text-bronze-800", icon: ShieldCheck },
  operator:   { label: "Operator",   color: "bg-sage-100",   border: "border-sage-200",   text: "text-sage-800",   icon: Shield },
  viewer:     { label: "Viewer",     color: "bg-stone-100",  border: "border-stone-200",  text: "text-stone-600",  icon: ShieldOff },
};

function RoleBadge({ role }: { role: UserRole }) {
  const c = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
  const Icon = c.icon;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-2xs font-semibold font-mono",
      c.color, c.border, c.text
    )}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

export function AdminView() {
  const [tab, setTab] = useState<"users" | "audit">("users");
  const queryClient = useQueryClient();
  const { user: me } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats().then((r) => r.data as {
      total_users: number;
      active_users: number;
      audit_events: number;
      role_distribution: Record<string, number>;
    }),
    refetchInterval: 30_000,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.users(0, 100).then((r) => r.data as UserRecord[]),
    refetchInterval: 60_000,
    enabled: tab === "users",
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => adminApi.auditLogs(0, 50).then((r) => r.data as AuditLog[]),
    refetchInterval: 15_000,
    enabled: tab === "audit",
  });

  const roleUpdateMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.updateRole(userId, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: () => toast.error("Failed to update role"),
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.toggleActive(userId, isActive),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const isSuperadmin = me?.role === "superadmin";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-screen-xl mx-auto space-y-5">

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Users", value: stats.total_users, icon: Users, accent: "sage" },
              { label: "Active Users", value: stats.active_users, icon: User, accent: "sage" },
              { label: "Audit Events", value: stats.audit_events, icon: Clock, accent: "bronze" },
              { label: "Admin+ Roles", value: (stats.role_distribution["superadmin"] ?? 0) + (stats.role_distribution["admin"] ?? 0), icon: Shield, accent: "peach" },
            ].map(({ label, value, icon: Icon, accent }) => {
              const pal = { sage: "bg-sage-50 border-sage-100 text-sage-800", bronze: "bg-bronze-50 border-bronze-100 text-bronze-800", peach: "bg-peach-50 border-peach-100 text-peach-800" }[accent as "sage" | "bronze" | "peach"];
              return (
                <div key={label} className={cn("rounded-xl border p-4", pal)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-2xs font-mono uppercase tracking-wider text-stone-500">{label}</span>
                    <Icon className="h-3.5 w-3.5 text-stone-400" />
                  </div>
                  <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl w-fit">
          {(["users", "audit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                tab === t
                  ? "bg-white text-stone-900 shadow-card"
                  : "text-stone-500 hover:text-stone-700"
              )}
            >
              {t === "users" ? "User Management" : "Audit Log"}
            </button>
          ))}
        </div>

        {/* Users table */}
        {tab === "users" && (
          <div className="surface-panel overflow-hidden">
            {usersLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/70">
                      <th className="text-left px-5 py-3 text-2xs font-semibold uppercase tracking-[0.14em] text-stone-500 font-mono">User</th>
                      <th className="text-left px-5 py-3 text-2xs font-semibold uppercase tracking-[0.14em] text-stone-500 font-mono">Role</th>
                      <th className="text-left px-5 py-3 text-2xs font-semibold uppercase tracking-[0.14em] text-stone-500 font-mono hidden sm:table-cell">Last Login</th>
                      <th className="text-left px-5 py-3 text-2xs font-semibold uppercase tracking-[0.14em] text-stone-500 font-mono">Status</th>
                      {isSuperadmin && (
                        <th className="text-right px-5 py-3 text-2xs font-semibold uppercase tracking-[0.14em] text-stone-500 font-mono">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(users ?? []).map((u) => (
                      <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage-100 text-sage-800 text-xs font-semibold shrink-0">
                              {u.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-stone-800">{u.full_name}</p>
                              <p className="text-2xs text-stone-400 font-mono">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {isSuperadmin && u.id !== me?.id ? (
                            <select
                              value={u.role}
                              onChange={(e) => roleUpdateMut.mutate({ userId: u.id, role: e.target.value })}
                              className="text-2xs font-mono border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-sage-400"
                            >
                              {(["viewer", "operator", "admin", "superadmin"] as UserRole[]).map((r) => (
                                <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                              ))}
                            </select>
                          ) : (
                            <RoleBadge role={u.role as UserRole} />
                          )}
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <span className="text-xs text-stone-400 font-mono">
                            {u.last_login
                              ? format(parseISO(u.last_login), "dd MMM yyyy HH:mm")
                              : "Never"
                            }
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 text-2xs font-mono text-sage-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-2xs font-mono text-stone-400">
                              <XCircle className="h-3.5 w-3.5" /> Inactive
                            </span>
                          )}
                        </td>
                        {isSuperadmin && (
                          <td className="px-5 py-3.5 text-right">
                            {u.id !== me?.id && (
                              <button
                                onClick={() => toggleActiveMut.mutate({ userId: u.id, isActive: !u.is_active })}
                                className={cn(
                                  "text-2xs font-mono px-2.5 py-1 rounded-lg border transition-colors",
                                  u.is_active
                                    ? "border-peach-200 text-peach-700 hover:bg-peach-50"
                                    : "border-sage-200 text-sage-700 hover:bg-sage-50"
                                )}
                              >
                                {u.is_active ? "Deactivate" : "Activate"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Audit log */}
        {tab === "audit" && (
          <div className="surface-panel p-5 space-y-3">
            {auditLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
              </div>
            ) : (auditLogs ?? []).length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="h-8 w-8 text-stone-300 mx-auto mb-3" />
                <p className="text-sm text-stone-500">No audit events recorded yet</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                {(auditLogs ?? []).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-stone-100 bg-stone-50/60 text-xs font-mono"
                  >
                    <span className={cn(
                      "shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-2xs font-semibold uppercase tracking-wider",
                      log.action.includes("delete") || log.action.includes("fail")
                        ? "bg-peach-100 text-peach-700"
                        : log.action.includes("create") || log.action.includes("register")
                        ? "bg-sage-100 text-sage-700"
                        : "bg-stone-200 text-stone-600"
                    )}>
                      {log.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-stone-700 truncate">
                        {log.resource}
                        {log.resource_id && <span className="text-stone-400 ml-1">#{log.resource_id.slice(0, 8)}</span>}
                        {log.details && <span className="text-stone-400 ml-2">— {log.details}</span>}
                      </p>
                      <p className="text-2xs text-stone-400 mt-0.5">
                        {log.user_email ?? "system"} · {log.ip_address ?? "—"} · {format(parseISO(log.created_at), "dd MMM HH:mm:ss")}
                      </p>
                    </div>
                    {log.action.includes("fail") || log.action.includes("delete") ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-peach-500 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-sage-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
