"""
Centralized application constants — no magic strings anywhere else.
"""
from enum import Enum


class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


class CameraStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"
    MAINTENANCE = "maintenance"


class DetectionStatus(str, Enum):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ChallanStatus(str, Enum):
    ISSUED = "issued"
    PAID = "paid"
    DISPUTED = "disputed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class VehicleCategory(str, Enum):
    CAR = "car"
    MOTORCYCLE = "motorcycle"
    TRUCK = "truck"
    BUS = "bus"
    AUTO_RICKSHAW = "auto_rickshaw"
    TEMPO = "tempo"
    TRAILER = "trailer"
    TRACTOR = "tractor"


class NotificationType(str, Enum):
    SMS = "sms"
    EMAIL = "email"
    PUSH = "push"
    SYSTEM = "system"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    BOUNCED = "bounced"


class AuditAction(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    EXPORT = "export"
    APPROVE = "approve"
    REJECT = "reject"


# Fine amounts by violation type (INR)
FINE_AMOUNTS = {
    "expired_registration": 2000,
    "expired_insurance": 1500,
    "no_pollution_certificate": 1000,
    "second_offense": 5000,
}

# Detection confidence thresholds
CONFIDENCE_THRESHOLDS = {
    "vehicle_detection": 0.60,
    "plate_detection": 0.55,
    "ocr_confidence": 0.70,
}

# Redis key prefixes
REDIS_KEYS = {
    "camera_stream": "stream:camera:",
    "detection_cache": "detect:cache:",
    "rate_limit": "ratelimit:",
    "ws_connections": "ws:conn:",
    "system_metrics": "metrics:system:",
    "active_sessions": "session:active:",
}

# WebSocket event types
WS_EVENTS = {
    "detection": "detection_event",
    "alert": "alert_event",
    "camera_status": "camera_status",
    "system_metrics": "system_metrics",
    "challan_issued": "challan_issued",
}

# Pagination defaults
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# File extensions
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mkv", ".mov", ".webm"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Indian plate regex pattern
PLATE_PATTERN = r"^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$"
