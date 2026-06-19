/**
 * Axios API client with JWT interceptors and automatic token refresh.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_PREFIX = "/api/v1";

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.host;
    const hostname = window.location.hostname;
    
    // Check if running behind a remote tunnel (e.g. IDX, Gitpod, Codespaces)
    if (hostname.includes("3000") || host.includes("3000")) {
      const proto = window.location.protocol;
      const newHost = host.replace("3000", "8000");
      return `${proto}//${newHost}`;
    }

    if (window.location.port === "" || window.location.port === "80" || window.location.port === "443") {
      return `${window.location.protocol}//${window.location.host}`;
    }
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

export function getWsUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.host;
    const hostname = window.location.hostname;
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";

    if (hostname.includes("3000") || host.includes("3000")) {
      const newHost = host.replace("3000", "8000");
      return `${wsProto}//${newHost}`;
    }

    if (window.location.port === "" || window.location.port === "80" || window.location.port === "443") {
      return `${wsProto}//${window.location.host}`;
    }
    return `${wsProto}//${window.location.hostname}:8000`;
  }
  return process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
}

export const apiClient = axios.create({
  baseURL: `${getApiUrl()}${API_PREFIX}`,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

if (typeof window !== "undefined") {
  apiClient.defaults.baseURL = `${getApiUrl()}${API_PREFIX}`;
}

// ── Request interceptor — inject access token ──────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle 401 and refresh token ─────────
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

/**
 * Redirect-to-login coordination.
 *
 * Without this we'd hit a classic page-reload loop: every 401 → window.location
 * → fresh page → fresh batch of API calls → fresh 401s → another reload, at
 * 30+ navigations/sec. This module-level flag de-duplicates concurrent 401s
 * AND silently swallows them when a demo session is active (demo sessions
 * are local-only — the backend will always 401 if there's no real JWT, and
 * that's expected, not a fatal condition).
 */
let isRedirectingToLogin = false;

function hasDemoSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem("vaahan.demo-session");
  } catch {
    return false;
  }
}

function redirectToLoginOnce(): void {
  if (typeof window === "undefined" || isRedirectingToLogin) return;
  // Demo session is the local fallback for unauthenticated backends —
  // do NOT kick the operator out of the dashboard just because /auth/me
  // 401'd. The dashboard layout already handles that case gracefully.
  if (hasDemoSession()) return;
  isRedirectingToLogin = true;
  // Already on /login? Don't navigate — would just clobber form state.
  if (window.location.pathname === "/login") {
    isRedirectingToLogin = false;
    return;
  }
  window.location.href = "/login";
}

// Password the persona cards authenticate with. Kept in sync with the demo
// persona registry (auth.store.ts DEMO_PASSWORD).
const DEMO_PASSWORD = "Admin@1234";

/** Email of the active local demo persona, read straight from storage so this
 *  module stays free of an import cycle with the auth store / demo-session. */
function demoSessionEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("vaahan.demo-session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string };
    return parsed?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Self-heal a stale demo session.
 *
 * Returning operators can land on the dashboard with a `vaahan.demo-session`
 * but NO valid backend JWT (token expired, or the backend was down when they
 * first logged in). Without this, every data query 401s forever and the pages
 * sit in perpetual skeletons. Since the persona credentials are known and all
 * personas authenticate, we mint a fresh JWT on demand and retry the request.
 * Returns the new access token, or null if there is no demo session to heal.
 */
async function mintTokenFromDemo(): Promise<string | null> {
  const email = demoSessionEmail();
  if (!email) return null;
  try {
    const { data } = await axios.post(`${getApiUrl()}${API_PREFIX}/auth/login`, {
      email,
      password: DEMO_PASSWORD,
    });
    if (data?.access_token && data?.refresh_token) {
      setTokens(data.access_token, data.refresh_token);
      return data.access_token;
    }
  } catch {
    /* fall through — caller handles null */
  }
  return null;
}

/** Obtain a fresh access token: try the refresh-token rotation first, then fall
 *  back to re-minting from the demo persona. Null if neither is possible. */
async function obtainNewToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      const { data } = await axios.post(`${getApiUrl()}${API_PREFIX}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      if (data?.access_token && data?.refresh_token) {
        setTokens(data.access_token, data.refresh_token);
        return data.access_token;
      }
    } catch {
      /* fall through to demo mint */
    }
  }
  return mintTokenFromDemo();
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && original && !original._retry) {
      // De-dupe concurrent 401s: only one token acquisition runs; the rest
      // queue and replay once it resolves (or reject if it couldn't).
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshSubscribers.push((token) => {
            if (token) {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(original));
            } else {
              reject(error);
            }
          });
        });
      }

      original._retry = true;
      isRefreshing = true;
      try {
        const newToken = await obtainNewToken();
        refreshSubscribers.forEach((cb) => cb(newToken ?? ""));
        refreshSubscribers = [];
        if (newToken) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(original);
        }
        // Could not refresh and no demo session to mint from → real logout.
        clearTokens();
        redirectToLoginOnce();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Token helpers ────────────────────────────────────────────────
const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
