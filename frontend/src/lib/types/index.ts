/**
 * Shared TypeScript types matching the backend Pydantic schemas exactly.
 */

export type UserRole = "superadmin" | "admin" | "operator" | "viewer";
export type CameraStatus = "active" | "inactive" | "error" | "maintenance";
export type DetectionStatus = "pending" | "processed" | "failed" | "skipped";
export type ChallanStatus = "issued" | "paid" | "disputed" | "cancelled" | "overdue";
export type NotificationType = "sms" | "email" | "push" | "system";
export type VehicleCategory = "car" | "motorcycle" | "truck" | "bus" | "auto_rickshaw" | "tempo";

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  phone?: string;
  avatar_url?: string;
  last_login?: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface Camera {
  id: string;
  name: string;
  camera_id: string;
  location: string;
  latitude?: number;
  longitude?: number;
  status: CameraStatus;
  is_active: boolean;
  resolution_width?: number;
  resolution_height?: number;
  fps?: number;
  last_seen?: string;
  total_detections: number;
  error_count: number;
  description?: string;
  stream_url?: string;
  rtsp_url?: string;
  created_at: string;
}

export interface Detection {
  id: string;
  camera_id?: string;
  vehicle_id?: string;
  detected_plate?: string;
  ocr_confidence?: number;
  vehicle_confidence?: number;
  plate_confidence?: number;
  vehicle_category?: string;
  bounding_box?: Record<string, number>;
  timestamp: string;
  status: DetectionStatus;
  is_violation: boolean;
  violation_type?: string;
  processing_time_ms?: number;
  frame_path?: string;
  plate_crop_path?: string;
  created_at: string;
}

export interface Challan {
  id: string;
  challan_number: string;
  plate_number: string;
  violation_type: string;
  violation_description?: string;
  fine_amount: number;
  status: ChallanStatus;
  issued_at: string;
  due_date?: string;
  paid_at?: string;
  paid_amount?: number;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  location?: string;
  created_at: string;
}

export interface ChallanCreate {
  plate_number: string;
  violation_type: string;
  violation_description?: string;
  fine_amount: number;
  location?: string;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  due_date?: string;
  detection_id?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardSummary {
  kpis: {
    total_scans_24h: number;
    violations_24h: number;
    success_rate: number;
    avg_confidence: number;
    active_cameras: number;
    pending_challans: number;
    revenue_pending: number;
    revenue_collected: number;
  };
}

export interface SystemMetrics {
  cpu: { usage_percent: number; core_count: number };
  memory: { total_gb: number; used_gb: number; usage_percent: number };
  disk: { total_gb: number; used_gb: number; usage_percent: number };
  gpu: { available: boolean; usage_percent?: number; memory_used_gb?: number; memory_total_gb?: number };
}

export interface DetectionViolation {
  type: string;
  description: string;
  fine: number;
  days_overdue: number;
}

export interface DetectionEvent {
  event_type: string;
  camera_id: string;
  timestamp: string;
  detection: {
    detection_id: string;
    plate_number?: string;
    vehicle_type: string;
    vehicle_confidence: number;
    plate_confidence: number;
    ocr_confidence: number;
    ocr_quality_score?: number;
    ocr_engine?: string;
    is_valid_plate_format?: boolean;
    bounding_box: number[];
    plate_bounding_box?: number[];
    // Backend-computed violation status — never guess this on the frontend
    is_violation: boolean;
    violation_type?: string;
    violations?: DetectionViolation[];
    total_fine?: number;
    processing_time_ms: number;
    frame_number: number;
    frame_path?: string;
    plate_path?: string;
  };
}
