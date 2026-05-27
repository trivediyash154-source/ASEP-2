/**
 * All API endpoint functions — typed, centralized, no magic strings elsewhere.
 */
import { apiClient, getApiUrl } from "./client";
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
  updateProfile: (data: { full_name?: string; phone?: string; avatar_url?: string }) =>
    apiClient.put<User>("/auth/me", data),
  getPreferences: () =>
    apiClient.get<{
      theme: string;
      notifications_enabled: boolean;
      default_camera: string | null;
      timezone: string;
      compact_sidebar: boolean;
    }>("/auth/me/preferences"),
  updatePreferences: (data: Record<string, unknown>) =>
    apiClient.put("/auth/me/preferences", data),
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

// ── Controlled Demo Replay ───────────────────────────────────────

export interface DemoCaseSummary {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  thumbnail_caption: string;
  plate: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  is_violation: boolean;
  violation_type: string | null;
  threat_score: number;
  camera_code: string;
  location: string;
  ocr_confidence: number;
  vehicle_category: string;
  vehicle_make: string;
  vehicle_model: string;
}

export interface DemoStage {
  key: string;
  label: string;
  latency_ms: number;
  detail: string;
}

export interface DemoReplayPayload {
  case_id: string;
  case_title: string;
  case_subtitle: string;
  image: string;
  detection_id: string;
  challan_id: string | null;
  challan_number: string | null;
  camera: { id: string; code: string; name: string; location: string };
  vehicle: {
    plate: string; category: string; make: string;
    model: string; color: string; year: number;
  };
  owner: { name: string; phone: string; email: string; city: string };
  outcome: {
    is_violation: boolean;
    violation_type: string | null;
    fine_amount_inr: number;
    severity: "info" | "low" | "medium" | "high" | "critical";
    threat_score: number;
  };
  compliance: {
    registration: boolean; insurance: boolean;
    puc: boolean; blacklist: boolean;
  };
  telemetry: {
    ocr_confidence: number;
    vehicle_confidence: number;
    plate_confidence: number;
    frame_quality: number;
    ocr_engine: string;
    total_latency_ms: number;
  };
  history: {
    detections_30d: number;
    repeat_offences: number;
    last_district: string;
    encounter_history: Array<{ date: string; camera: string; result: string }>;
  };
  bounding_box: { x1: number; y1: number; x2: number; y2: number };
  plate_bounding_box: { x1: number; y1: number; x2: number; y2: number };
  stages: DemoStage[];
  decision_trace: DecisionSignal[];
  timestamp: string;
}

export interface DecisionSignal {
  signal: string;
  source: string;
  evidence: string;
  weight: number;
  contribution: number;
  outcome: "PASS" | "FLAG" | "CRITICAL" | "RECOVERED" | "ENHANCED";
}

export const demoApi = {
  cases: () =>
    apiClient.get<{ cases: DemoCaseSummary[] }>("/demo/cases").then((r) => r.data.cases),
  replay: (caseId: string) =>
    apiClient.post<DemoReplayPayload>(`/demo/replay/${caseId}`).then((r) => r.data),
};

// ── Health (root endpoint, no auth needed) ───────────────────────
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
    fetch(`${getApiUrl()}/health`).then((r) => r.json() as Promise<HealthResponse>),
};
