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
    "expired_pollution_certificate": 1000,
    "unregistered_vehicle": 5000,
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

# Indian plate regex pattern. Anchored, uppercase-only. Normalization
# pipeline (see ocr._normalize_plate) is responsible for upper-casing and
# stripping separators before this regex runs.
#
# Accepted variants (in order):
#   1) Standard / Delhi alphanumeric / VIP-short
#        2 state letters · 1–2 district digits · 1–3 series letters · 1–4 number digits
#        e.g.  MH02AB1234   DL3CAB1234   MH02A7
#   2) Bharat (BH) series
#        2 year digits · "BH" · 4 number digits · 2 series letters
#        e.g.  22BH1234AA
#   3) Temporary / transit (conservative; explicit "TMP" infix prevents
#      collisions with the standard variant)
#        2 state letters · "TMP" · 1–2 district digits · 0–2 series letters · 1–4 number digits
#        e.g.  MHTMP12AB1234   DLTMP1A99
#
# Uses non-capturing groups (?:...) — we never need the alternation index.
PLATE_PATTERN = (
    r"^(?:"
    r"[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}"          # Standard / Delhi alpha / VIP / No-series
    r"|[0-9]{2}BH[0-9]{4}[A-Z]{2}"                       # Bharat series
    r"|[A-Z]{2}TMP[0-9]{1,2}[A-Z]{0,2}[0-9]{1,4}"        # Temporary / transit (old style)
    r"|T[0-9]{4}[A-Z]{2}[0-9]{4}[A-Z]{1,2}"              # MoRTH Temporary / transit (new style)
    r")$"
)

