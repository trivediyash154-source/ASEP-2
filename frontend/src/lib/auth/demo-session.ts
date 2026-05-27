/**
 * Demo session — local, deterministic, never-fails authentication.
 *
 * The platform is a demonstration of an AI enforcement system. The backend
 * has real auth (JWT + bcrypt + refresh rotation), and we still attempt
 * backend login on every persona-pick — but the operator console must NOT
 * be blocked on that succeeding. This file is the local fallback that
 * guarantees the dashboard always loads.
 *
 * Persistence: `localStorage["vaahan.demo-session"]` holds the typed session.
 * No cookies, no third-party storage. Cleared by `logout()` or by clicking
 * "Sign out" in the user dropdown.
 */
import type { User, UserRole } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────

export type PersonaKey = "operator" | "command" | "auditor";

export interface DemoSession {
  /** Stable UUID-shaped id, unique per persona */
  id: string;
  name: string;
  role: UserRole;
  email: string;
  /** 1 (read-only) – 5 (superadmin). Used for UI gating */
  accessLevel: number;
  /** ISO timestamp when the session was minted */
  createdAt: string;
  /** Per-persona capability flags surfaced in the sidebar / panels */
  permissions: string[];
  /** Tag so we never confuse a real backend user with a demo one */
  source: "demo";
}

interface PersonaDefinition {
  id: string;          // canonical UUID
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  accessLevel: number;
  permissions: string[];
}

// ── Persona registry ──────────────────────────────────────────────

/** UUIDs are intentionally stable across sessions so historical
 *  audit-log rows stay associated with the same persona. */
export const PERSONAS: Record<PersonaKey, PersonaDefinition> = {
  command: {
    id: "8d1188ba-2be8-48ac-95b9-5b4093debfaa",
    email: "admin@enforcement.gov",
    username: "admin",
    full_name: "System Administrator",
    role: "superadmin",
    accessLevel: 5,
    permissions: [
      "cameras:manage",
      "challans:issue",
      "challans:override",
      "users:manage",
      "settings:write",
      "evidence:export",
      "audit:read",
    ],
  },
  operator: {
    id: "2475b703-deba-4715-b730-4a618fbed892",
    email: "operator@enforcement.gov",
    username: "operator",
    full_name: "Field Operator",
    role: "operator",
    accessLevel: 3,
    permissions: [
      "cameras:view",
      "cameras:control",
      "challans:issue",
      "evidence:view",
      "replay:run",
    ],
  },
  auditor: {
    id: "ff5f57a6-970c-457f-b514-36a9305d63a2",
    email: "viewer@enforcement.gov",
    username: "viewer",
    full_name: "Read-only Analyst",
    role: "viewer",
    accessLevel: 1,
    permissions: ["evidence:view", "audit:read", "analytics:view"],
  },
};

const STORAGE_KEY = "vaahan.demo-session";
/** Session lifetime — 24 hours is plenty for a demo, short enough to
 *  re-prompt the next day. */
const TTL_MS = 24 * 60 * 60 * 1000;

// ── Public API ────────────────────────────────────────────────────

export function personaFromEmail(email: string): PersonaKey | null {
  const e = email.trim().toLowerCase();
  for (const [key, p] of Object.entries(PERSONAS)) {
    if (p.email.toLowerCase() === e) return key as PersonaKey;
  }
  return null;
}

export function createDemoSession(personaKey: PersonaKey): DemoSession {
  const p = PERSONAS[personaKey];
  if (!p) {
    // Defensive: never throw in a demo. Fall back to operator.
    return createDemoSession("operator");
  }
  const session: DemoSession = {
    id: p.id,
    name: p.full_name,
    role: p.role,
    email: p.email,
    accessLevel: p.accessLevel,
    createdAt: new Date().toISOString(),
    permissions: [...p.permissions],
    source: "demo",
  };
  persistSession(session);
  return session;
}

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoSession> & { createdAt?: string };
    if (
      !parsed ||
      parsed.source !== "demo" ||
      !parsed.id ||
      !parsed.email ||
      !parsed.role ||
      !parsed.createdAt
    ) {
      return null;
    }
    // TTL check — silently expire stale sessions
    const age = Date.now() - Date.parse(parsed.createdAt);
    if (!Number.isFinite(age) || age < 0 || age > TTL_MS) {
      clearDemoSession();
      return null;
    }
    return parsed as DemoSession;
  } catch {
    // Corrupt JSON — wipe and let the caller re-mint.
    clearDemoSession();
    return null;
  }
}

export function clearDemoSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage disabled — nothing we can do */
  }
}

export function isAuthenticated(): boolean {
  return getDemoSession() !== null;
}

/** Map a demo session into the User shape the rest of the app already
 *  expects from the backend. Lets us keep `useAuthStore.user` typed. */
export function sessionToUser(s: DemoSession): User {
  return {
    id: s.id,
    email: s.email,
    username: PERSONAS[keyForRole(s.role)].username,
    full_name: s.name,
    role: s.role,
    is_active: true,
    is_verified: true,
    phone: undefined,
    avatar_url: undefined,
    last_login: s.createdAt,
    created_at: s.createdAt,
  };
}

// ── Internals ─────────────────────────────────────────────────────

function persistSession(s: DemoSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage quota or disabled — session lives only for this tab */
  }
}

function keyForRole(role: UserRole): PersonaKey {
  switch (role) {
    case "superadmin":
    case "admin":
      return "command";
    case "viewer":
      return "auditor";
    case "operator":
    default:
      return "operator";
  }
}
