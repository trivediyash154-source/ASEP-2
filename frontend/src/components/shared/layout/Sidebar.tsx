"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Camera,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Moon,
  Radio,
  Settings,
  Shield,
  Sun,
  TrendingUp,
  Users,
  Crosshair,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth.store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NAV = [
  {
    group: "Operations",
    items: [
      { href: "/dashboard",  label: "Command Overview", icon: LayoutDashboard },
      { href: "/demo",       label: "Live Theatre",     icon: Radio,            live: true },
      { href: "/cameras",    label: "Surveillance",     icon: Camera,           live: true },
      { href: "/detections", label: "Detections",       icon: Shield },
    ],
  },
  {
    group: "Enforcement",
    items: [
      { href: "/challans",   label: "Challans",         icon: FileText },
      { href: "/evidence",   label: "Forensic Intel",   icon: FolderOpen },
      { href: "/analytics",  label: "Analytics",        icon: TrendingUp },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/system",     label: "System Health",    icon: Activity },
      { href: "/admin",      label: "Users & Roles",    icon: Users },
      { href: "/settings",   label: "Settings",         icon: Settings },
    ],
  },
];

const ROLE_BADGE: Record<string, { dot: string; label: string }> = {
  superadmin: { dot: "bg-status-danger",  label: "Superadmin" },
  admin:      { dot: "bg-peach-500",      label: "Admin" },
  operator:   { dot: "bg-sage-500",       label: "Operator" },
  viewer:     { dot: "bg-stone-400",      label: "Viewer" },
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const widthExpanded  = 256;
  const widthCollapsed = 72;

  return (
    <TooltipProvider delayDuration={150}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? widthCollapsed : widthExpanded }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden",
          "bg-surface border-r border-border"
        )}
        style={{ boxShadow: "1px 0 0 0 hsl(45 12% 88% / 0.6)" }}
      >
        {/* ─── Brand ──────────────────────────────────── */}
        <div className={cn(
          "flex items-center h-16 shrink-0 border-b border-border",
          collapsed ? "justify-center" : "px-4 gap-3"
        )}>
          {/* Logo mark — crosshair on sage */}
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-700 dark:bg-sage-800 shadow-sm ring-1 ring-sage-800/30 dark:ring-sage-600/30">
            <Crosshair className="h-4 w-4 text-sand-100" strokeWidth={1.75} />
            <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-peach-400 border-2 border-surface">
              <span className="absolute inset-0 rounded-full bg-peach-400 opacity-60 animate-ping" />
            </span>
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden min-w-0"
              >
                <p className="font-display text-sm font-semibold text-foreground tracking-tight leading-none">
                  VAAHAN AI
                </p>
                <p className="mt-1 text-2xs font-mono uppercase tracking-[0.22em] text-foreground-subtle leading-none">
                  MH · Enforcement
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Collapse handle ──────────────────────── */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "absolute top-[60px] -right-3 z-10",
            "flex h-6 w-6 items-center justify-center rounded-full",
            "bg-surface border border-border-strong text-foreground-subtle",
            "hover:text-foreground hover:border-sage-500",
            "shadow-sm transition-colors duration-150"
          )}
        >
          {collapsed ? <ChevronsRight className="h-3 w-3" /> : <ChevronsLeft className="h-3 w-3" />}
        </button>

        {/* ─── Operational status strip ─────────────── */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-b border-border"
            >
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-status-success opacity-60 animate-ping" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-status-success" />
                  </span>
                  <span className="text-2xs font-mono uppercase tracking-[0.14em] text-foreground-subtle">AI Online</span>
                </div>
                <span className="text-2xs font-mono text-foreground-subtle tabular-nums text-threat-low font-semibold">
                  THREAT: LOW
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Nav ──────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 no-scrollbar">
          {NAV.map((section, sectionIdx) => (
            <div key={section.group} className={cn(sectionIdx > 0 && "mt-4")}>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-4 mb-1 text-2xs font-semibold uppercase tracking-[0.18em] text-foreground-subtle/60"
                  >
                    {section.group}
                  </motion.p>
                )}
              </AnimatePresence>

              <ul className="px-2.5 space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href + "/"));

                  const ItemContent = (
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center rounded-lg select-none",
                        "transition-[background-color,color] duration-150",
                        collapsed
                          ? "h-9 w-9 mx-auto justify-center"
                          : "h-9 px-2.5 gap-2.5",
                        isActive
                          ? "bg-sage-100/80 dark:bg-sage-900/30 text-sage-900 dark:text-sage-100"
                          : "text-foreground-muted hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-bar"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-sage-600 dark:bg-sage-400"
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}

                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors duration-150",
                          isActive
                            ? "text-sage-700 dark:text-sage-300"
                            : "text-foreground-subtle group-hover:text-foreground"
                        )}
                        strokeWidth={1.75}
                      />

                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex-1 min-w-0 overflow-hidden whitespace-nowrap text-sm font-medium tracking-tight"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {/* Live dot */}
                      {"live" in item && item.live && !collapsed && (
                        <span className="status-dot-live h-1.5 w-1.5" />
                      )}
                      {"live" in item && item.live && collapsed && (
                        <span className="absolute top-1.5 right-1.5 status-dot-live h-1.5 w-1.5" />
                      )}
                    </Link>
                  );

                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{ItemContent}</TooltipTrigger>
                          <TooltipContent side="right" sideOffset={10}>
                            {item.label}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        ItemContent
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ─── Theme toggle ─────────────────────────── */}
        <ThemeToggleRow collapsed={collapsed} />

        {/* ─── User footer ──────────────────────────── */}
        <div className={cn("border-t border-border shrink-0", collapsed ? "p-2" : "p-3")}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={logout}
                  className="flex h-9 w-9 mx-auto items-center justify-center rounded-lg
                             text-foreground-subtle hover:text-status-danger hover:bg-peach-50 dark:hover:bg-peach-900/20
                             transition-colors duration-150"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-2 pr-2.5">
              <div className="relative">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-100 dark:bg-sage-800/50 text-sage-800 dark:text-sage-200 text-xs font-semibold ring-1 ring-sage-200 dark:ring-sage-700/50">
                  {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
                </div>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface",
                    ROLE_BADGE[user?.role ?? "viewer"]?.dot
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate leading-tight">
                  {user?.full_name ?? "—"}
                </p>
                <p className="text-2xs text-foreground-subtle truncate font-mono uppercase tracking-wider">
                  {ROLE_BADGE[user?.role ?? "viewer"]?.label}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={logout}
                    aria-label="Sign out"
                    className="shrink-0 rounded-md p-1.5 text-foreground-subtle hover:text-status-danger hover:bg-peach-50 dark:hover:bg-peach-900/20 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Sign out</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Layout spacer */}
      <div
        aria-hidden
        style={{ width: collapsed ? widthCollapsed : widthExpanded }}
        className="shrink-0 transition-[width] duration-250 ease-out-quart"
      />
    </TooltipProvider>
  );
}

function ThemeToggleRow({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (collapsed) {
    return (
      <div className="border-t border-border flex justify-center py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-lg
                         text-foreground-subtle hover:text-foreground hover:bg-muted
                         transition-colors duration-150"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {isDark ? "Light mode" : "Dark mode"}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-border px-3 py-2">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg
                   text-foreground-subtle hover:text-foreground hover:bg-muted
                   transition-colors duration-150"
      >
        {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
        <span className="text-sm font-medium">{isDark ? "Light mode" : "Dark mode"}</span>
        <span className="ml-auto text-2xs font-mono text-foreground-subtle bg-muted px-1.5 py-0.5 rounded border border-border">
          {isDark ? "☀" : "☾"}
        </span>
      </button>
    </div>
  );
}
