/**
 * Zustand auth store — persists user session and provides login/logout actions.
 *
 * `fetchMe` accepts a `signal` so callers (notably the dashboard layout's
 * verification gate) can impose their own hard timeout and abort the request
 * if the backend stalls. Without this, axios would hold the request for its
 * own 30s timeout *plus* the refresh-token retry — long enough for the UI
 * to feel hard-frozen.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authApi } from "@/lib/api/endpoints";
import { clearTokens, setTokens, getAccessToken } from "@/lib/api/client";
import { log } from "@/lib/diagnostics/logger";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Filled by `fetchMe` when the verification call fails — UI can surface this. */
  lastError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: (opts?: { signal?: AbortSignal }) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      lastError: null,

      login: async (email, password) => {
        set({ isLoading: true, lastError: null });
        try {
          log.info("auth", "login_start", { email });
          const { data } = await authApi.login(email, password);
          setTokens(data.access_token, data.refresh_token);
          await get().fetchMe();
          set({ isAuthenticated: true });
          log.info("auth", "login_success");
        } catch (err) {
          const msg = (err as Error)?.message ?? "Login failed";
          set({ lastError: msg });
          log.error("auth", "login_failed", { error: msg });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        log.info("auth", "logout");
        clearTokens();
        set({ user: null, isAuthenticated: false, lastError: null });
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      },

      fetchMe: async (opts) => {
        // Fast path — no token at all, skip the round-trip entirely.
        // This is what unblocks the "VERIFYING SESSION" screen when there's
        // simply no session to verify.
        if (!getAccessToken()) {
          log.info("auth", "fetchMe_no_token");
          set({ user: null, isAuthenticated: false });
          return;
        }
        try {
          log.info("auth", "fetchMe_start");
          const { data } = await authApi.me({ signal: opts?.signal });
          set({ user: data, isAuthenticated: true, lastError: null });
          log.info("auth", "fetchMe_success", { userId: data.id });
        } catch (err) {
          const aborted = (err as { name?: string })?.name === "CanceledError" ||
            (err as { name?: string })?.name === "AbortError";
          const status = (err as { response?: { status?: number } })?.response?.status;
          // 401 means the token is stale — treat as logged-out, not as an error.
          if (status === 401) {
            log.info("auth", "fetchMe_unauthorized");
            clearTokens();
            set({ user: null, isAuthenticated: false, lastError: null });
            return;
          }
          const msg = aborted
            ? "Session check timed out"
            : (err as Error)?.message ?? "Session check failed";
          log.warn("auth", "fetchMe_failed", { aborted, status, error: msg });
          set({ user: null, isAuthenticated: false, lastError: msg });
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
