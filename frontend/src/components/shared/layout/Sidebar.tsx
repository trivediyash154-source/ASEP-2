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
  Sliders,
  Sun,
  TrendingUp,
  User as UserIcon,
  Users,
  Crosshair,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth.store";
import { can, type Capability } from "@/lib/auth/permissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Command rail — permanently dark in both themes, like a hardware
 * console bolted to the left of the operations floor. Light/dark only
 * affects the work surface, never the rail.
 */

// Each nav item declares the *minimum* capability required to see it. The
// Sidebar reads the current role from the auth store and filters items
// whose required capability the role doesn't hold. Empty groups collapse
// away automatically.
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  live?: boolean;
  requires: Capability;
};
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: "Operations",
    items: [
      { href: "/dashboard",  label: "Command Overview", icon: LayoutDashboard, requires: "dashboard:view" },
      { href: "/demo",       label: "Live Theatre",     icon: Radio,           live: true, requires: "replay:run" },
      { href: "/cameras",    label: "Surveillance",     icon: Camera,          live: true, requires: "cameras:view" },
      { href: "/detections", label: "Detections",       icon: Shield,          requires: "detections:view" },
    ],
  },
  {
    group: "Enforcement",
    items: [
      { href: "/challans",   label: "Challans",         icon: FileText,        requires: "challans:view" },
      { href: "/evidence",   label: "Forensic Intel",   icon: FolderOpen,      requires: "evidence:view" },
      { href: "/analytics",  label: "Analytics",        icon: TrendingUp,      requires: "analytics:view" },
    ],
  },
  {
    group: "Administration",
    items: [
      { href: "/system",     label: "System Health",    icon: Activity,        requires: "system:view" },
      { href: "/admin",      label: "Users & Roles",    icon: Users,           requires: "admin:users" },
      { href: "/settings",   label: "Settings",         icon: Settings,        requires: "settings:read" },
    ],
  },
];

const ROLE_BADGE: Record<string, { dot: string; label: string }> = {
  superadmin: { dot: "bg-status-danger",  label: "Superadmin" },
  admin:      { dot: "bg-peach-500",      label: "Admin" },
  operator:   { dot: "bg-sage-500",       label: "Operator" },
  viewer:     { dot: "bg-stone-400",      label: "Viewer" },
};

/* Rail palette — explicit so the rail ignores the page theme */
const RAIL_BG = "#12100d";

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
        className="fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-stone-800/80 text-stone-300"
        style={{
          background: `linear-gradient(180deg, #15120e 0%, ${RAIL_BG} 38%, #100e0b 100%)`,
          boxShadow: "1px 0 0 0 rgba(255,255,255,0.03), 8px 0 32px -12px rgba(0,0,0,0.5)",
        }}
      >
        {/* Ambient sage bloom behind the brand */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, rgba(127,136,118,0.35), transparent 70%)" }}
        />

        {/* ─── Brand ──────────────────────────────────── */}
        <div className={cn(
          "relative flex items-center h-16 shrink-0 border-b border-white/[0.06]",
          collapsed ? "justify-center" : "px-4 gap-3"
        )}>
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-800 shadow-glow-sage ring-1 ring-sage-500/40">
            <Crosshair className="h-4 w-4 text-sand-100" strokeWidth={1.75} />
            <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-peach-400 border-2 border-[#12100d]">
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
                <p className="font-display text-sm font-semibold text-stone-100 tracking-tight leading-none">
                  VAAHAN AI
                </p>
                <p className="mt-1 text-2xs font-mono uppercase tracking-[0.22em] text-stone-500 leading-none">
                  Pune · Enforcement
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
            "bg-stone-900 border border-stone-700 text-stone-400",
            "hover:text-stone-100 hover:border-sage-500",
            "shadow-md transition-colors duration-150"
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
              className="overflow-hidden border-b border-white/[0.06]"
            >
              <div className="px-4 py-2.5 flex items-center justify-between font-mono text-2xs uppercase tracking-[0.14em]">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inset-0 rounded-full bg-status-success opacity-60 animate-ping" />
                    <span className="relative h-1.5 w-1.5 rounded-full bg-status-success" />
                  </span>
                  <span className="text-stone-500">AI Online</span>
                </div>
                <RailClock />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Nav (role-filtered) ──────────────────────────────────── */}
        <nav className="relative flex-1 overflow-y-auto overflow-x-hidden py-3 no-scrollbar">
          {NAV.map((section, sectionIdx) => {
            const visibleItems = section.items.filter((it) => can(user?.role, it.requires));
            // Hide the entire group if the role can't see any of its items —
            // keeps the rail visually tight for viewer / operator roles.
            if (visibleItems.length === 0) return null;
            return (
            <div key={section.group} className={cn(sectionIdx > 0 && "mt-4")}>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-4 mb-1 font-mono text-2xs font-semibold uppercase tracking-[0.2em] text-stone-600"
                  >
                    {section.group}
                  </motion.p>
                )}
              </AnimatePresence>

              <ul className="px-2.5 space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href + "/"));

                  const ItemContent = (
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center rounded-lg select-none",
                        "transition-[background-color,color,box-shadow] duration-150",
                        collapsed
                          ? "h-9 w-9 mx-auto justify-center"
                          : "h-9 px-2.5 gap-2.5",
                        isActive
                          ? "bg-sage-900/50 text-sage-100 ring-1 ring-sage-500/25"
                          : "text-stone-400 hover:bg-white/[0.05] hover:text-stone-100"
                      )}
                    >
                      {/* Active indicator — glowing rail */}
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-bar"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r-full bg-sage-400"
                          style={{ boxShadow: "0 0 10px 1px rgba(169,179,148,0.55)" }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}

                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors duration-150",
                          isActive
                            ? "text-sage-300"
                            : "text-stone-500 group-hover:text-stone-200"
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
            );
          })}
        </nav>

        {/* ─── Theme toggle ─────────────────────────── */}
        <ThemeToggleRow collapsed={collapsed} />

        {/* ─── User footer ──────────────────────────── */}
        <div className={cn("border-t border-white/[0.06] shrink-0", collapsed ? "p-2 space-y-1" : "p-3 space-y-1.5")}>
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/profile"
                    className="flex h-9 w-9 mx-auto items-center justify-center rounded-lg
                               text-stone-500 hover:text-stone-100 hover:bg-white/[0.05]
                               transition-colors duration-150"
                    aria-label="Profile"
                  >
                    <UserIcon className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>Profile</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/preferences"
                    className="flex h-9 w-9 mx-auto items-center justify-center rounded-lg
                               text-stone-500 hover:text-stone-100 hover:bg-white/[0.05]
                               transition-colors duration-150"
                    aria-label="Preferences"
                  >
                    <Sliders className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>Preferences</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={logout}
                    className="flex h-9 w-9 mx-auto items-center justify-center rounded-lg
                               text-stone-500 hover:text-peach-400 hover:bg-peach-900/20
                               transition-colors duration-150"
                    aria-label="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>Sign out</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 pr-2.5">
                <div className="relative">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sage-900/70 text-sage-200 text-xs font-semibold ring-1 ring-sage-600/40">
                    {user?.full_name?.charAt(0)?.toUpperCase() ?? "U"}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#12100d]",
                      ROLE_BADGE[user?.role ?? "viewer"]?.dot
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-stone-200 truncate leading-tight">
                    {user?.full_name ?? "—"}
                  </p>
                  <p className="text-2xs text-stone-500 truncate font-mono uppercase tracking-wider">
                    {ROLE_BADGE[user?.role ?? "viewer"]?.label}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Link
                  href="/profile"
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg
                             text-stone-500 hover:text-stone-100 hover:bg-white/[0.05]
                             text-2xs font-semibold uppercase tracking-wider transition-colors"
                >
                  <UserIcon className="h-3 w-3" /> Profile
                </Link>
                <Link
                  href="/preferences"
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg
                             text-stone-500 hover:text-stone-100 hover:bg-white/[0.05]
                             text-2xs font-semibold uppercase tracking-wider transition-colors"
                >
                  <Sliders className="h-3 w-3" /> Prefs
                </Link>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={logout}
                      aria-label="Sign out"
                      className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg text-stone-500 hover:text-peach-400 hover:bg-peach-900/20 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Sign out</TooltipContent>
                </Tooltip>
              </div>
            </>
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

/** Live IST clock in the rail's status strip. */
function RailClock() {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    setT(new Date());
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="text-stone-400 tabular-nums signal-live">
      {t ? t.toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--"}
    </span>
  );
}

function ThemeToggleRow({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (collapsed) {
    return (
      <div className="border-t border-white/[0.06] flex justify-center py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggle}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-lg
                         text-stone-500 hover:text-stone-100 hover:bg-white/[0.05]
                         transition-colors duration-150"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {isDark ? "Light surface" : "Dark surface"}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-white/[0.06] px-3 py-2">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg
                   text-stone-500 hover:text-stone-100 hover:bg-white/[0.05]
                   transition-colors duration-150"
      >
        {isDark ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
        <span className="text-sm font-medium">{isDark ? "Light surface" : "Dark surface"}</span>
        <span className="ml-auto text-2xs font-mono text-stone-500 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.08]">
          {isDark ? "☀" : "☾"}
        </span>
      </button>
    </div>
  );
}
