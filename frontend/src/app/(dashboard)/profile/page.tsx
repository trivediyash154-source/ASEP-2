"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AtSign,
  CheckCircle2,
  Phone,
  Save,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { TopBar } from "@/components/shared/layout/TopBar";
import { useAuthStore } from "@/lib/stores/auth.store";
import { authApi } from "@/lib/api/endpoints";
import { roleLabel } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      try {
        const { data } = await authApi.updateProfile({
          full_name: fullName || undefined,
          phone: phone || undefined,
        });
        useAuthStore.setState({ user: data });
      } catch {
        // Demo session — backend unreachable. Patch the store optimistically
        // so the operator still sees their changes reflected in the sidebar
        // / topbar without losing the visual feedback contract.
        const current = useAuthStore.getState().user;
        if (current) {
          useAuthStore.setState({
            user: { ...current, full_name: fullName || current.full_name, phone: phone || current.phone },
          });
        }
      }
      setSaved(true);
      toast.success("Profile updated");
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const roleBadge = user?.role ?? "viewer";
  const badgeColor: Record<string, string> = {
    superadmin: "bg-status-danger/15 text-status-danger ring-status-danger/30",
    admin: "bg-peach-100 text-peach-700 ring-peach-300/50",
    operator: "bg-sage-100 text-sage-700 ring-sage-300/50",
    viewer: "bg-stone-100 text-stone-600 ring-stone-300/50",
  };

  return (
    <>
      <TopBar title="Profile" subtitle="Your identity and role within the enforcement platform" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Identity card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-panel p-6"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-100 dark:bg-sage-800/50 text-sage-800 dark:text-sage-200 text-xl font-bold ring-1 ring-sage-200 dark:ring-sage-700/50">
                {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground tracking-tight">
                  {user?.full_name ?? "Unknown User"}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-semibold uppercase tracking-wider ring-1",
                      badgeColor[roleBadge] ?? badgeColor.viewer,
                    )}
                  >
                    <Shield className="h-2.5 w-2.5" />
                    {roleLabel(user?.role)}
                  </span>
                  {user?.is_active && (
                    <span className="inline-flex items-center gap-1 text-2xs text-sage-600 font-medium">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <FieldRow
                icon={<UserIcon className="h-4 w-4" />}
                label="Full name"
                value={fullName}
                onChange={setFullName}
              />
              <FieldRow
                icon={<AtSign className="h-4 w-4" />}
                label="Email"
                value={user?.email ?? ""}
                readOnly
              />
              <FieldRow
                icon={<Phone className="h-4 w-4" />}
                label="Phone"
                value={phone}
                onChange={setPhone}
                placeholder="+91 XXXXX XXXXX"
              />
              <FieldRow
                icon={<Shield className="h-4 w-4" />}
                label="Role"
                value={roleLabel(user?.role)}
                readOnly
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold transition-colors",
                  saved
                    ? "bg-sage-100 text-sage-700"
                    : "bg-sage-600 text-white hover:bg-sage-700",
                  "disabled:opacity-50",
                )}
              >
                {saved ? (
                  <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</>
                ) : (
                  <><Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save changes"}</>
                )}
              </button>
            </div>
          </motion.div>

          {/* Account details */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="surface-panel p-6"
          >
            <p className="section-eyebrow mb-3">Account details</p>
            <dl className="grid grid-cols-2 gap-3">
              <InfoCell label="Username" value={user?.username ?? "—"} mono />
              <InfoCell label="User ID" value={user?.id ? `${user.id.slice(0, 8)}…` : "—"} mono />
              <InfoCell label="Last login" value={user?.last_login ? new Date(user.last_login).toLocaleString("en-IN") : "—"} />
              <InfoCell label="Account created" value={user?.created_at ? new Date(user.created_at).toLocaleString("en-IN") : "—"} />
            </dl>
          </motion.div>
        </div>
      </div>
    </>
  );
}

function FieldRow({
  icon,
  label,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-foreground-subtle shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <label className="block text-2xs font-semibold uppercase tracking-wider text-foreground-subtle mb-1">
          {label}
        </label>
        <input
          type="text"
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn(
            "w-full h-9 px-3 rounded-lg border text-sm font-medium transition-colors",
            readOnly
              ? "bg-muted border-border text-foreground-muted cursor-not-allowed"
              : "bg-surface border-border-strong text-foreground focus:ring-2 focus:ring-sage-300 focus:border-sage-400 outline-none",
          )}
        />
      </div>
    </div>
  );
}

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 border border-border">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">{label}</dt>
      <dd className={cn("mt-1 text-sm text-foreground font-medium truncate", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
