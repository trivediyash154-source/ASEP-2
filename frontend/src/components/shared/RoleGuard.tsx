"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";

import { useAuthStore } from "@/lib/stores/auth.store";
import { can, roleLabel, type Capability } from "@/lib/auth/permissions";

interface Props {
  /** One or more capabilities; the user must hold ALL of them. */
  capability: Capability | Capability[];
  /** Optional friendly label for the panel header */
  label?: string;
  children: React.ReactNode;
}

/**
 * Route-level RBAC guard.
 *
 *   <RoleGuard capability="admin:users">…</RoleGuard>
 *
 * Renders children if the current user holds the capability; otherwise
 * renders a tactical "Not authorised" panel. This is UI-only — the backend
 * MUST still enforce the same rule (otherwise direct API calls bypass the
 * UI entirely).
 *
 * SSR note: on first render `useAuthStore` may not be hydrated. We wait
 * one paint with a `mounted` flag so the guard doesn't flash unauthorised
 * for legitimate users while the persisted store rehydrates.
 */
export function RoleGuard({ capability, label, children }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const caps = Array.isArray(capability) ? capability : [capability];
  const ok = mounted && caps.every((c) => can(role, c));

  // Initial paint — render nothing rather than flash the unauthorised UI.
  if (!mounted) return null;

  if (!ok) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="surface-panel-elevated max-w-md w-full p-6 sm:p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-status-danger/15 text-status-danger flex items-center justify-center ring-1 ring-status-danger/30">
            <ShieldOff className="h-5 w-5" />
          </div>
          <p className="section-eyebrow mt-4">Access denied</p>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground">
            Not authorised{label ? ` for ${label}` : ""}
          </h2>
          <p className="mt-2 text-xs text-foreground-muted">
            Your role — <span className="font-mono font-semibold text-foreground">{roleLabel(role)}</span> —
            does not grant the required capability.
            Required: <span className="font-mono">{caps.join(", ")}</span>
          </p>
          <p className="mt-3 text-2xs text-foreground-subtle">
            If you need access, contact a Super Admin. All access requests are audit-logged.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center justify-center h-9 px-4 rounded-lg bg-sage-600 text-white text-sm font-semibold hover:bg-sage-700 transition-colors"
          >
            Back to Command Center
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
