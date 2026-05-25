"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Bell, Database, Eye, RefreshCw, Save, Settings, Sliders, Zap,
} from "lucide-react";

import { settingsApi } from "@/lib/api/endpoints";
import { useAuthStore } from "@/lib/stores/auth.store";
import { cn } from "@/lib/utils";

interface SettingMeta {
  value: string;
  description: string;
  category: string;
  updated_by: string | null;
  updated_at: string | null;
}

type SettingsMap = Record<string, SettingMeta>;

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Settings; accent: string }> = {
  pipeline:      { label: "AI Pipeline",    icon: Zap,       accent: "bronze" },
  storage:       { label: "Storage",        icon: Database,  accent: "stone"  },
  enforcement:   { label: "Enforcement",    icon: Sliders,   accent: "sage"   },
  notifications: { label: "Notifications", icon: Bell,      accent: "peach"  },
  general:       { label: "General",        icon: Settings,  accent: "stone"  },
};

const NUMERIC_SETTINGS = new Set([
  "yolo_confidence", "plate_confidence", "ocr_confidence",
  "frame_skip", "evidence_retention_days", "violation_cooldown_s",
  "max_fps", "stream_reconnect_delay_s",
]);

const BOOL_SETTINGS = new Set(["notify_sms", "notify_email"]);

const SETTING_RANGES: Record<string, { min: number; max: number; step: number }> = {
  yolo_confidence:     { min: 0.1, max: 0.99, step: 0.01 },
  plate_confidence:    { min: 0.1, max: 0.99, step: 0.01 },
  ocr_confidence:      { min: 0.1, max: 0.99, step: 0.01 },
  frame_skip:          { min: 1,   max: 10,   step: 1     },
  evidence_retention_days: { min: 7, max: 365, step: 1   },
  violation_cooldown_s:    { min: 10, max: 3600, step: 10 },
  max_fps:             { min: 1,   max: 60,  step: 1      },
  stream_reconnect_delay_s: { min: 1, max: 60, step: 1   },
};

function accentClass(accent: string): { icon: string; border: string; bg: string } {
  return {
    bronze: { icon: "text-bronze-600", border: "border-bronze-200", bg: "bg-bronze-50" },
    sage:   { icon: "text-sage-600",   border: "border-sage-200",   bg: "bg-sage-50"   },
    peach:  { icon: "text-peach-600",  border: "border-peach-200",  bg: "bg-peach-50"  },
    stone:  { icon: "text-stone-500",  border: "border-stone-200",  bg: "bg-stone-50"  },
  }[accent] ?? { icon: "text-stone-500", border: "border-stone-200", bg: "bg-stone-50" };
}

export function SettingsView() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const { data: rawSettings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.getAll().then((r) => r.data as SettingsMap),
    refetchInterval: 30_000,
  });

  const [local, setLocal] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (rawSettings) {
      const vals: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawSettings)) {
        vals[k] = v.value;
      }
      setLocal(vals);
      setDirty(new Set());
    }
  }, [rawSettings]);

  const saveMut = useMutation({
    mutationFn: (body: Record<string, string>) => settingsApi.updateAll(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      setDirty(new Set());
      toast.success("Settings saved — restart pipeline to apply threshold changes");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  function handleChange(key: string, value: string) {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => new Set([...prev, key]));
  }

  function handleSave() {
    const changed: Record<string, string> = {};
    for (const key of dirty) {
      changed[key] = local[key];
    }
    saveMut.mutate(changed);
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl mx-auto space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton rounded-xl h-32" />
          ))}
        </div>
      </div>
    );
  }

  const categorized: Record<string, Array<[string, SettingMeta]>> = {};
  for (const [k, v] of Object.entries(rawSettings ?? {})) {
    if (!categorized[v.category]) categorized[v.category] = [];
    categorized[v.category].push([k, v]);
  }

  const categoryOrder = ["pipeline", "enforcement", "storage", "notifications", "general"];
  const sortedCategories = [
    ...categoryOrder.filter((c) => categorized[c]),
    ...Object.keys(categorized).filter((c) => !categoryOrder.includes(c)),
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-3xl mx-auto space-y-5">

        {/* Save bar */}
        {isAdmin && dirty.size > 0 && (
          <div className="sticky top-4 z-10 flex items-center justify-between gap-4
                          bg-stone-900 text-white px-5 py-3 rounded-xl shadow-card-lg">
            <span className="text-sm font-medium">
              {dirty.size} unsaved change{dirty.size !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (rawSettings) {
                    const vals: Record<string, string> = {};
                    for (const [k, v] of Object.entries(rawSettings)) vals[k] = v.value;
                    setLocal(vals);
                    setDirty(new Set());
                  }
                }}
                className="text-sm text-stone-400 hover:text-white transition-colors px-3 py-1.5"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saveMut.isPending}
                className="flex items-center gap-2 bg-sage-500 hover:bg-sage-400 text-white
                           text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMut.isPending ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* Category sections */}
        {sortedCategories.map((category) => {
          const items = categorized[category];
          const cat = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.general;
          const CatIcon = cat.icon;
          const palette = accentClass(cat.accent);

          return (
            <div key={category} className="surface-panel overflow-hidden">
              {/* Category header */}
              <div className={cn("flex items-center gap-3 px-5 py-4 border-b border-stone-100", palette.bg)}>
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-md", palette.bg)}>
                  <CatIcon className={cn("h-4 w-4", palette.icon)} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{cat.label}</p>
                </div>
              </div>

              {/* Settings rows */}
              <div className="divide-y divide-stone-50">
                {items.map(([key, meta]) => {
                  const isDirtyRow = dirty.has(key);
                  const val = local[key] ?? meta.value;
                  const range = SETTING_RANGES[key];
                  const isBool = BOOL_SETTINGS.has(key);
                  const isNum = NUMERIC_SETTINGS.has(key) && !isBool;

                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 transition-colors",
                        isDirtyRow && "bg-bronze-50/60"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono font-semibold text-stone-700">{key}</p>
                          {isDirtyRow && (
                            <span className="text-2xs font-mono bg-bronze-100 text-bronze-700 px-1.5 py-0.5 rounded border border-bronze-200">
                              modified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">{meta.description}</p>
                        {meta.updated_at && (
                          <p className="text-2xs text-stone-300 font-mono mt-0.5">
                            Updated {format(parseISO(meta.updated_at), "dd MMM HH:mm")}
                            {meta.updated_by && <span> by {meta.updated_by}</span>}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-3">
                        {isBool ? (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div
                              onClick={() => isAdmin && handleChange(key, val === "true" ? "false" : "true")}
                              className={cn(
                                "relative w-9 h-5 rounded-full border-2 transition-colors",
                                val === "true" ? "bg-sage-500 border-sage-600" : "bg-stone-200 border-stone-300",
                                !isAdmin && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <span className={cn(
                                "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform",
                                val === "true" ? "left-4" : "left-0.5"
                              )} />
                            </div>
                            <span className={cn(
                              "text-sm font-mono",
                              val === "true" ? "text-sage-700" : "text-stone-400"
                            )}>
                              {val === "true" ? "On" : "Off"}
                            </span>
                          </label>
                        ) : isNum && range ? (
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={range.min}
                              max={range.max}
                              step={range.step}
                              value={val}
                              disabled={!isAdmin}
                              onChange={(e) => handleChange(key, e.target.value)}
                              className="w-28 accent-sage-600"
                            />
                            <span className="text-sm font-mono font-semibold text-stone-700 w-12 text-right tabular-nums">
                              {Number(val).toFixed(val.includes(".") ? 2 : 0)}
                            </span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={val}
                            disabled={!isAdmin}
                            onChange={(e) => handleChange(key, e.target.value)}
                            className="text-sm font-mono border border-stone-200 rounded-lg px-3 py-1.5 w-36
                                       focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white
                                       disabled:bg-stone-50 disabled:text-stone-400"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {!isAdmin && (
          <div className="surface-panel p-5 flex items-center gap-3 bg-bronze-50 border-bronze-100">
            <Eye className="h-4 w-4 text-bronze-600 shrink-0" />
            <p className="text-sm text-bronze-800">
              You have <strong>read-only</strong> access to settings. Admin or Superadmin role required to make changes.
            </p>
          </div>
        )}

        {/* Restart note */}
        <div className="flex items-start gap-3 text-xs text-stone-400 px-2">
          <RefreshCw className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>Threshold changes (YOLO, OCR, plate confidence) take effect after stopping and restarting the camera pipeline. Other settings apply immediately.</p>
        </div>
      </div>
    </div>
  );
}
