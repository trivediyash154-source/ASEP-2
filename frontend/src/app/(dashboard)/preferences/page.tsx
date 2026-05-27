"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Globe,
  Monitor,
  Moon,
  PanelLeftClose,
  Save,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { TopBar } from "@/components/shared/layout/TopBar";
import { authApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "vaahan.preferences";

export default function PreferencesPage() {
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [compactSidebar, setCompactSidebar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Hydrate preferences ────────────────────────────────────────────
  // Backend is source of truth (per-user, audit-logged); localStorage is
  // a fallback for demo sessions where the backend may be unreachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await authApi.getPreferences();
        if (cancelled) return;
        if (data?.theme && data.theme !== "system") setTheme(data.theme);
        setNotifications(data?.notifications_enabled ?? true);
        setTimezone(data?.timezone ?? "Asia/Kolkata");
        setCompactSidebar(data?.compact_sidebar ?? false);
      } catch {
        // Backend unavailable — load whatever the demo had locally.
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          const parsed = JSON.parse(raw);
          if (parsed.theme) setTheme(parsed.theme);
          if (typeof parsed.notifications === "boolean") setNotifications(parsed.notifications);
          if (parsed.timezone) setTimezone(parsed.timezone);
          if (typeof parsed.compactSidebar === "boolean") setCompactSidebar(parsed.compactSidebar);
        } catch {
          /* corrupt local cache — ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setSaving(true);
    const payload = {
      theme: theme ?? "system",
      notifications_enabled: notifications,
      timezone,
      compact_sidebar: compactSidebar,
    };
    try {
      // Primary persistence — backend (per-user, audit-logged).
      await authApi.updatePreferences(payload);
    } catch {
      // Backend unreachable on this demo — still cache locally so the
      // operator's choices survive a reload.
    }
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ theme, notifications, timezone, compactSidebar }),
      );
      setSaved(true);
      toast.success("Preferences saved");
      setTimeout(() => setSaved(false), 2000);
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  const themeOptions: { id: string; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <>
      <TopBar title="Preferences" subtitle="Theme, notifications, timezone, and display settings" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-2xl mx-auto space-y-6">
          {/* Theme */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface-panel p-6"
          >
            <p className="section-eyebrow mb-1">Appearance</p>
            <h3 className="font-display text-sm font-semibold text-foreground mb-4">Theme</h3>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((opt) => {
                const active = theme === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                      active
                        ? "border-sage-500 bg-sage-50 dark:bg-sage-900/30 ring-2 ring-sage-200 dark:ring-sage-700/40"
                        : "border-border bg-surface hover:border-border-strong hover:bg-muted/40",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        active ? "text-sage-700 dark:text-sage-300" : "text-foreground-subtle",
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        active ? "text-sage-700 dark:text-sage-300" : "text-foreground-muted",
                      )}
                    >
                      {opt.label}
                    </span>
                    {active && (
                      <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-sage-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="surface-panel p-6"
          >
            <p className="section-eyebrow mb-1">Alerts</p>
            <h3 className="font-display text-sm font-semibold text-foreground mb-4">Notifications</h3>
            <div className="space-y-3">
              <ToggleRow
                icon={notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                label="Detection alerts"
                description="Receive real-time alerts for new violations and critical detections"
                checked={notifications}
                onToggle={() => setNotifications(!notifications)}
              />
              <ToggleRow
                icon={<PanelLeftClose className="h-4 w-4" />}
                label="Compact sidebar"
                description="Start with the sidebar collapsed for more workspace"
                checked={compactSidebar}
                onToggle={() => setCompactSidebar(!compactSidebar)}
              />
            </div>
          </motion.div>

          {/* Timezone */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="surface-panel p-6"
          >
            <p className="section-eyebrow mb-1">Regional</p>
            <h3 className="font-display text-sm font-semibold text-foreground mb-4">Timezone</h3>
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-foreground-subtle shrink-0" />
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border border-border-strong bg-surface text-sm font-medium text-foreground focus:ring-2 focus:ring-sage-300 focus:border-sage-400 outline-none"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
              </select>
            </div>
          </motion.div>

          {/* Save */}
          <div className="flex justify-end pb-6">
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
                <><Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save preferences"}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors text-left"
    >
      <span className="text-foreground-subtle shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-2xs text-foreground-muted">{description}</p>
      </div>
      <div
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors shrink-0",
          checked ? "bg-sage-600" : "bg-stone-300 dark:bg-stone-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </div>
    </button>
  );
}
