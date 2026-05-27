/**
 * Centralised RBAC permission map.
 *
 * Single source of truth for which roles can do what — referenced by the
 * Sidebar (to hide nav items), by `RoleGuard` (to block direct route hits),
 * and by individual feature panels (to conditionally render action buttons).
 *
 * Server-side enforcement is the *real* security boundary. This map is for
 * UX only — never trust a UI hide for security.
 */
import type { UserRole } from "@/lib/types";

export type Capability =
  | "dashboard:view"
  | "cameras:view"
  | "cameras:control"
  | "detections:view"
  | "challans:view"
  | "challans:issue"
  | "challans:update"
  | "challans:download_pdf"
  | "evidence:view"
  | "evidence:view_pii"        // owner contact + paid_amount
  | "analytics:view"
  | "replay:run"
  | "system:view"
  | "settings:read"
  | "settings:write"
  | "admin:users"
  | "admin:audit_logs"
  | "profile:self"
  | "preferences:self";

/** Capabilities granted to each role. Override at runtime via the auth
 *  store — this is the *static* contract. */
const ROLE_CAPABILITIES: Record<UserRole, Set<Capability>> = {
  superadmin: new Set<Capability>([
    "dashboard:view", "cameras:view", "cameras:control",
    "detections:view", "challans:view", "challans:issue", "challans:update",
    "challans:download_pdf", "evidence:view", "evidence:view_pii",
    "analytics:view", "replay:run", "system:view",
    "settings:read", "settings:write",
    "admin:users", "admin:audit_logs",
    "profile:self", "preferences:self",
  ]),
  admin: new Set<Capability>([
    "dashboard:view", "cameras:view", "cameras:control",
    "detections:view", "challans:view", "challans:issue", "challans:update",
    "challans:download_pdf", "evidence:view", "evidence:view_pii",
    "analytics:view", "replay:run", "system:view",
    "settings:read", "settings:write",
    "admin:audit_logs",                 // admin sees audit logs but NOT user mgmt
    "profile:self", "preferences:self",
  ]),
  operator: new Set<Capability>([
    "dashboard:view", "cameras:view", "cameras:control",
    "detections:view", "challans:view", "challans:issue", "challans:update",
    "challans:download_pdf", "evidence:view", "evidence:view_pii",
    "analytics:view", "replay:run",
    "system:view", "settings:read",
    // No settings:write, no admin
    "profile:self", "preferences:self",
  ]),
  viewer: new Set<Capability>([
    "dashboard:view", "cameras:view",
    "detections:view", "challans:view",
    "evidence:view",                      // images yes; PII no
    "analytics:view",
    // No issue/update/PDF, no replay, no system, no settings, no admin
    "profile:self", "preferences:self",
  ]),
};

/** Does this role grant the capability? Returns false for null/undefined
 *  role so callers don't need to handle the "no user" case. */
export function can(role: UserRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

/** Does this role grant *any* of the listed capabilities? Useful for "show
 *  this group of nav items if the user has at least one entry in it". */
export function canAny(role: UserRole | null | undefined, caps: Capability[]): boolean {
  if (!role) return false;
  const set = ROLE_CAPABILITIES[role];
  if (!set) return false;
  return caps.some((c) => set.has(c));
}

/** Human-readable role label for the UI. */
export function roleLabel(role: UserRole | null | undefined): string {
  switch (role) {
    case "superadmin": return "Super Admin";
    case "admin":      return "Admin";
    case "operator":   return "Field Operator";
    case "viewer":     return "Read-only Viewer";
    default:           return "Guest";
  }
}
