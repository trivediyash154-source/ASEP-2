/**
 * Demo-first auth store.
 *
 * The dashboard MUST load. To guarantee that:
 *
 *  1. `login()` and `loginAsPersona()` mint a local DemoSession synchronously,
 *     then fire the real backend login in the background as a best-effort —
 *     if it returns tokens, they are stored so backend-authenticated endpoints
 *     (controlled replay, /auth/me, WS rooms) get a real JWT. If it fails or
 *     times out, the demo session still gets the operator into the dashboard.
 *
 *  2. `fetchMe()` never blocks the gate. It tries the backend with a strict
 *     timeout; on success it enriches `user`. On failure it reconstructs
 *     `user` from the demo session. It NEVER leaves the UI in a "loading"
 *     state — `set({ isLoading: false })` runs in `finally`.
 *
 *  3. `logout()` clears both the demo session and the backend tokens.
 *
 * The public interface is backwards-compatible with previous callers:
 * `user`, `isAuthenticated`, `isLoading`, `lastError`, `login`, `logout`,
 * `fetchMe`. New: `loginAsPersona`.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { authApi } from "@/lib/api/endpoints";
import { clearTokens, setTokens, getAccessToken } from "@/lib/api/client";
import { log } from "@/lib/diagnostics/logger";
import {
  clearDemoSession,
  createDemoSession,
  getDemoSession,
  personaFromEmail,
  sessionToUser,
  type PersonaKey,
} from "@/lib/auth/demo-session";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Soft error surface for diagnostics; never blocks the gate. */
  lastError: string | null;

  // ── Actions ──
  /** Legacy email/password entrypoint — resolves to a persona, calls
   *  `loginAsPersona`. Kept so existing callers stay green. */
  login: (email: string, password: string) => Promise<void>;
  /** Mint a demo session immediately, attempt backend login in parallel. */
  loginAsPersona: (persona: PersonaKey) => Promise<void>;
  logout: () => void;
  /** Best-effort identity refresh. Never throws. Never hangs. */
  fetchMe: (opts?: { signal?: AbortSignal }) => Promise<void>;
}

/** Strict ceiling on backend calls during boot. Must fall comfortably under
 *  the dashboard-layout hard timeout (6.5s). */
const BACKEND_LOGIN_TIMEOUT_MS = 2500;
const BACKEND_ME_TIMEOUT_MS = 3000;
const CINEMATIC_LOGIN_DELAY_MS = 900; // operator never sees a bare "click → flip"

// ── Helpers ─────────────────────────────────────────────────────────

/** Race a promise against a wall-clock timeout. Whichever resolves/rejects
 *  first wins; the slower one is abandoned. Used to keep auth snappy. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function tryBackendLogin(
  email: string,
  password: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    const { data } = await withTimeout(
      authApi.login(email, password),
      BACKEND_LOGIN_TIMEOUT_MS,
      "backend-login",
    );
    return data;
  } catch (err) {
    log.warn("auth", "backend_login_skipped", {
      reason: (err as Error)?.message ?? "unknown",
    });
    return null;
  }
}

/** Demo password — matches the seeded backend hash so the parallel real
 *  login succeeds when the backend is healthy. UI ignores whatever the
 *  operator typed in the password field. */
const DEMO_PASSWORD = "Admin@1234";

// ── Store ───────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      lastError: null,

      // ── Persona login (primary) ─────────────────────────────────
      loginAsPersona: async (persona) => {
        set({ isLoading: true, lastError: null });
        let cinematicResolved = false;
        const cinematicGate = new Promise<void>((r) => {
          setTimeout(() => {
            cinematicResolved = true;
            r();
          }, CINEMATIC_LOGIN_DELAY_MS);
        });

        try {
          log.info("auth", "login_start", { persona });

          // 1. Mint the local session synchronously — this is what
          //    guarantees the dashboard renders.
          const session = createDemoSession(persona);

          // 2. Fire backend login in parallel — best-effort.
          //    If it succeeds, the access_token gets stored so the API
          //    client and WS bus pick up a real JWT. If it fails, the
          //    demo session still carries the operator through.
          const backendPromise = tryBackendLogin(session.email, DEMO_PASSWORD);

          // 3. Wait for whichever finishes first — but never longer than
          //    the cinematic gate, so the UI animation feels intentional.
          const tokens = await Promise.race([
            backendPromise,
            cinematicGate.then(() => null as Awaited<typeof backendPromise>),
          ]);

          // If we beat the cinematic gate, still wait for the animation.
          if (!cinematicResolved) await cinematicGate;

          // 4. If the backend ever returns (now or shortly after), store
          //    its tokens. We don't block the redirect on this.
          backendPromise
            .then((latetokens) => {
              const fresh = latetokens ?? tokens;
              if (fresh?.access_token && fresh?.refresh_token) {
                setTokens(fresh.access_token, fresh.refresh_token);
                log.info("auth", "backend_tokens_stored");
              }
            })
            .catch(() => { /* already logged in tryBackendLogin */ });

          // 5. Project the demo session into the User shape the rest of
          //    the app already expects.
          set({
            user: sessionToUser(session),
            isAuthenticated: true,
            lastError: null,
          });
          log.info("auth", "login_success", { persona, role: session.role });
        } catch (err) {
          // This branch is theoretical — `createDemoSession` cannot throw —
          // but we surface a soft error and keep going regardless.
          const msg = (err as Error)?.message ?? "Login failed (recovered)";
          log.error("auth", "login_unexpected_error", { error: msg });
          set({ lastError: msg });
          // Recovery: force a demo session anyway so the gate doesn't lock.
          try {
            const session = createDemoSession(persona);
            set({
              user: sessionToUser(session),
              isAuthenticated: true,
            });
          } catch {
            /* impossible — but defensive */
          }
        } finally {
          set({ isLoading: false });
        }
      },

      // ── Backwards-compatible email/password entrypoint ──────────
      login: async (email, password) => {
        // The login form already auto-fills credentials from the persona
        // cards. Resolve email → persona; ignore password (kept visually).
        const persona = personaFromEmail(email) ?? "operator";
        log.info("auth", "legacy_login_routing", { email, persona });
        await get().loginAsPersona(persona);
      },

      // ── Logout ──────────────────────────────────────────────────
      logout: () => {
        log.info("auth", "logout");
        clearTokens();
        clearDemoSession();
        set({ user: null, isAuthenticated: false, lastError: null });
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      },

      // ── Identity refresh (non-blocking) ─────────────────────────
      fetchMe: async (opts) => {
        const demo = getDemoSession();

        // Fast path: backend has no token AND we have a demo session.
        // Nothing to fetch — synthesise `user` and return immediately.
        if (!getAccessToken() && demo) {
          set({ user: sessionToUser(demo), isAuthenticated: true, lastError: null });
          return;
        }

        // No token AND no demo session → genuinely logged out.
        if (!getAccessToken() && !demo) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        // Have a token — try the backend, but cap latency and recover.
        try {
          const { data } = await withTimeout(
            authApi.me({ signal: opts?.signal }),
            BACKEND_ME_TIMEOUT_MS,
            "backend-me",
          );
          set({ user: data, isAuthenticated: true, lastError: null });
          log.info("auth", "fetchMe_backend_ok", { userId: data.id });
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          // 401 with a demo session still in play → backend tokens went
          // stale, but the demo continues. We just drop the stale tokens.
          if (status === 401) {
            clearTokens();
          }
          if (demo) {
            // Recover from the demo session — guarantees `user` is non-null.
            set({
              user: sessionToUser(demo),
              isAuthenticated: true,
              lastError: null,
            });
            log.info("auth", "fetchMe_recovered_from_demo_session");
          } else {
            // Truly stuck — no backend, no demo session, nothing to recover from.
            set({ user: null, isAuthenticated: false, lastError: null });
            log.warn("auth", "fetchMe_no_session", {
              error: (err as Error)?.message,
            });
          }
        }
      },
    }),
    {
      name: "auth-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
