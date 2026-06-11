"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Activity, Camera, Car, FileText, FolderOpen, LayoutDashboard,
  Moon, Radio, Search, Settings, Shield, Sun, TrendingUp, Users,
  CornerDownLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth.store";
import { can, type Capability } from "@/lib/auth/permissions";

/** Custom event other chrome (TopBar search) can dispatch to open the palette. */
export const OPEN_PALETTE_EVENT = "vaahan:open-palette";

interface PaletteItem {
  id: string;
  section: "Navigate" | "Actions" | "Vehicle Intel";
  label: string;
  hint?: string;
  icon: typeof LayoutDashboard;
  keywords: string;
  requires?: Capability;
  run: () => void;
}

const PLATE_RE = /^[A-Z0-9 -]{4,12}$/i;

/**
 * Global ⌘K command palette — navigate the platform, run quick actions,
 * and jump straight to a vehicle dossier by typing a plate. Custom
 * implementation (no cmdk dep): substring filter + arrow-key selection.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const role = useAuthStore((s) => s.user?.role);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  // Global hotkey + custom open event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") close();
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const go = useCallback((href: string) => {
    close();
    router.push(href);
  }, [close, router]);

  const items = useMemo<PaletteItem[]>(() => {
    const nav: PaletteItem[] = [
      { id: "n-dash",   section: "Navigate", label: "Command Overview",   icon: LayoutDashboard, keywords: "dashboard home overview kpi", requires: "dashboard:view",  run: () => go("/dashboard") },
      { id: "n-demo",   section: "Navigate", label: "Live Theatre",       icon: Radio,           keywords: "demo replay theatre live",    requires: "replay:run",      run: () => go("/demo") },
      { id: "n-cams",   section: "Navigate", label: "Surveillance Wall",  icon: Camera,          keywords: "cameras feeds streams wall",  requires: "cameras:view",    run: () => go("/cameras") },
      { id: "n-det",    section: "Navigate", label: "Detections Log",     icon: Shield,          keywords: "detections anpr reads log",   requires: "detections:view", run: () => go("/detections") },
      { id: "n-chal",   section: "Navigate", label: "Enforcement Queue",  icon: FileText,        keywords: "challans fines enforcement",  requires: "challans:view",   run: () => go("/challans") },
      { id: "n-evid",   section: "Navigate", label: "Forensic Evidence",  icon: FolderOpen,      keywords: "evidence forensics frames",   requires: "evidence:view",   run: () => go("/evidence") },
      { id: "n-ana",    section: "Navigate", label: "Analytics",          icon: TrendingUp,      keywords: "analytics charts trends",     requires: "analytics:view",  run: () => go("/analytics") },
      { id: "n-sys",    section: "Navigate", label: "System Health",      icon: Activity,        keywords: "system health cpu memory",    requires: "system:view",     run: () => go("/system") },
      { id: "n-adm",    section: "Navigate", label: "Users & Roles",      icon: Users,           keywords: "admin users roles",           requires: "admin:users",     run: () => go("/admin") },
      { id: "n-set",    section: "Navigate", label: "Settings",           icon: Settings,        keywords: "settings thresholds config",  requires: "settings:read",   run: () => go("/settings") },
    ];
    const actions: PaletteItem[] = [
      {
        id: "a-theme", section: "Actions",
        label: theme === "dark" ? "Switch to light surface" : "Switch to dark surface",
        icon: theme === "dark" ? Sun : Moon,
        keywords: "theme dark light mode toggle surface",
        run: () => { setTheme(theme === "dark" ? "light" : "dark"); close(); },
      },
    ];
    return [...nav.filter((i) => !i.requires || can(role, i.requires)), ...actions];
  }, [go, role, theme, setTheme, close]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q))
      : items;
    // Plate-shaped query → offer the dossier jump as the first result
    if (q && PLATE_RE.test(query.trim())) {
      const plate = query.trim().toUpperCase().replace(/\s+/g, "");
      return [
        {
          id: "v-plate",
          section: "Vehicle Intel" as const,
          label: `Open dossier · ${plate}`,
          hint: "vehicle intelligence",
          icon: Car,
          keywords: "",
          run: () => go(`/vehicles/${encodeURIComponent(plate)}`),
        },
        ...base,
      ];
    }
    return base;
  }, [items, query, go]);

  useEffect(() => setActive(0), [query]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  // Keep the active row in view
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastSection: string | null = null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[3px] flex items-start justify-center pt-[16vh] px-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onListKey}
            className={cn(
              "w-full max-w-xl overflow-hidden rounded-xl",
              "bg-surface border border-border shadow-popover"
            )}
          >
            {/* Input row */}
            <div className="flex items-center gap-3 px-4 h-12 border-b border-border">
              <Search className="h-4 w-4 text-foreground-subtle shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to… or type a plate (MH12AB1234)"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle/60 outline-none"
                spellCheck={false}
              />
              <span className="font-mono text-2xs text-foreground-subtle bg-muted px-1.5 py-0.5 rounded border border-border">
                ESC
              </span>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[44vh] overflow-y-auto py-1.5">
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-foreground-subtle font-mono uppercase tracking-[0.12em]">
                  No matches
                </p>
              ) : (
                filtered.map((item, idx) => {
                  const showSection = item.section !== lastSection;
                  lastSection = item.section;
                  const Icon = item.icon;
                  return (
                    <div key={item.id}>
                      {showSection && (
                        <p className="px-4 pt-2.5 pb-1 font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-foreground-subtle/70">
                          {item.section}
                        </p>
                      )}
                      <button
                        data-idx={idx}
                        onClick={item.run}
                        onMouseMove={() => setActive(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors duration-75",
                          idx === active ? "bg-sage-100/70 dark:bg-sage-900/30" : ""
                        )}
                      >
                        <span className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md border shrink-0",
                          idx === active
                            ? "bg-sage-200/60 border-sage-300 text-sage-800 dark:bg-sage-900/50 dark:border-sage-700/60 dark:text-sage-300"
                            : "bg-muted/60 border-border text-foreground-subtle"
                        )}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 min-w-0 text-sm text-foreground truncate">{item.label}</span>
                        {item.hint && (
                          <span className="font-mono text-2xs text-foreground-subtle uppercase tracking-[0.1em]">{item.hint}</span>
                        )}
                        {idx === active && (
                          <CornerDownLeft className="h-3.5 w-3.5 text-foreground-subtle shrink-0" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <footer className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/40 font-mono text-2xs text-foreground-subtle">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span className="ml-auto uppercase tracking-[0.14em]">VAAHAN AI Console</span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
