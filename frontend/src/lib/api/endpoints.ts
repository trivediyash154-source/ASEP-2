/**
 * All API endpoint functions — typed, centralized, no magic strings elsewhere.
 */
import { apiClient } from "./client";
import type {
  AuthTokens,
  Camera,
  Challan,
  ChallanCreate,
  DashboardSummary,
  Detection,
  PaginatedResponse,
  SystemMetrics,
  User,
} from "@/lib/types";

// ── Auth ────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthTokens>("/auth/login", { email, password }),
  refresh: (refresh_token: string) =>
    apiClient.post<AuthTokens>("/auth/refresh", { refresh_token }),
  me: (opts?: { signal?: AbortSignal }) =>
    apiClient.get<User>("/auth/me", { signal: opts?.signal, timeout: 6000 }),
  register: (data: {
    email: string;
    username: string;
    full_name: string;
    password: string;
    role?: string;
  }) => apiClient.post<User>("/auth/register", data),
};

// ── Cameras ─────────────────────────────────────────────────────
export const camerasApi = {
  list: (skip?: number, limit?: number) =>
    apiClient.get<Camera[]>("/cameras", { params: { skip, limit } }),
  get: (id: string) => apiClient.get<Camera>(`/cameras/${id}`),
  create: (data: Partial<Camera>) => apiClient.post<Camera>("/cameras", data),
  update: (id: string, data: Partial<Camera>) =>
    apiClient.patch<Camera>(`/cameras/${id}`, data),
  start: (id: string) => apiClient.post(`/cameras/${id}/start`),
  stop: (id: string) => apiClient.post(`/cameras/${id}/stop`),
  activeList: () => apiClient.get<string[]>("/cameras/status/active"),
};

// ── Detections ───────────────────────────────────────────────────
export const detectionsApi = {
  list: (page?: number, pageSize?: number, violationsOnly?: boolean) =>
    apiClient.get<PaginatedResponse<Detection>>("/detections", {
      params: { page, page_size: pageSize, violations_only: violationsOnly },
    }),
  recent: (limit?: number) =>
    apiClient.get<Detection[]>("/detections/recent", { params: { limit } }),
  stats: () => apiClient.get("/detections/stats"),
};

// ── Challans ─────────────────────────────────────────────────────
export const challansApi = {
  list: (page?: number, pageSize?: number, status?: string) =>
    apiClient.get<PaginatedResponse<Challan>>("/challans", {
      params: { page, page_size: pageSize, status_filter: status },
    }),
  get: (id: string) => apiClient.get<Challan>(`/challans/${id}`),
  create: (data: ChallanCreate) => apiClient.post<Challan>("/challans", data),
  updateStatus: (id: string, data: { status: string; paid_amount?: number; payment_reference?: string }) =>
    apiClient.patch<Challan>(`/challans/${id}/status`, data),
  stats: () => apiClient.get("/challans/stats"),
  downloadPdf: (id: string) =>
    apiClient.get(`/challans/${id}/pdf`, { responseType: "blob" }),
};

// ── Analytics ────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () => apiClient.get<DashboardSummary>("/analytics/dashboard"),
  timeline: (hours?: number) =>
    apiClient.get("/analytics/timeline", { params: { hours } }),
  system: () => apiClient.get<SystemMetrics>("/analytics/system"),
  cameras: () => apiClient.get("/analytics/cameras"),
  violations: () =>
    apiClient.get<Array<{ type: string; count: number; pct: number }>>("/analytics/violations"),
  aiPerformance: () =>
    apiClient.get<{
      avg_processing_ms: number | null;
      vehicle_detection_pct: number | null;
      ocr_accuracy_pct: number | null;
      error_rate_pct: number;
      sample_size: number;
    }>("/analytics/ai-performance"),
};

// ── Admin ────────────────────────────────────────────────────────
export const adminApi = {
  stats: () => apiClient.get("/admin/stats"),
  users: (skip?: number, limit?: number) =>
    apiClient.get("/admin/users", { params: { skip, limit } }),
  updateRole: (userId: string, role: string) =>
    apiClient.patch(`/admin/users/${userId}/role`, { role }),
  toggleActive: (userId: string, isActive: boolean) =>
    apiClient.patch(`/admin/users/${userId}/active`, { is_active: isActive }),
  auditLogs: (skip?: number, limit?: number, action?: string) =>
    apiClient.get("/admin/audit-logs", { params: { skip, limit, action } }),
};

// ── Settings ─────────────────────────────────────────────────────
export const settingsApi = {
  getAll: () => apiClient.get<Record<string, { value: string; description: string; category: string; updated_by: string | null; updated_at: string | null }>>("/settings"),
  updateAll: (body: Record<string, string>) => apiClient.put("/settings", body),
  updateOne: (key: string, value: string) => apiClient.put(`/settings/${key}`, { value }),
};

// ── Health (root endpoint, no auth needed) ───────────────────────
const _API_URL_RAW = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface HealthResponse {
  status: "healthy" | "degraded";
  version: string;
  services: {
    database: "ok" | "error";
    redis: "ok" | "error";
  };
}

export const healthApi = {
  check: (): Promise<HealthResponse> =>
    fetch(`${_API_URL_RAW}/health`).then((r) => r.json() as Promise<HealthResponse>),
};
