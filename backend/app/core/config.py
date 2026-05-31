"""
Central configuration management using pydantic-settings.
All environment variables are validated and typed here.
"""
from functools import lru_cache
from typing import List, Optional

from pydantic import AnyHttpUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────
    APP_NAME: str = "AI Enforcement Platform"
    APP_ENV: str = "development"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = Field(..., min_length=32)
    API_V1_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    # ── Database ─────────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "enforcement_db"
    POSTGRES_USER: str = "enforcement_user"
    POSTGRES_PASSWORD: str = Field(..., min_length=8)

    # Echo every SQL statement to the logger. Must stay False in any running
    # system: under realtime load the synchronous log writes happen on the
    # event-loop thread, and when the log sink (Docker driver / terminal)
    # applies backpressure the write() syscall blocks the loop — the system
    # soft-locks with low CPU and /health hangs. Decoupled from DEBUG on
    # purpose so dev can keep DEBUG=true (docs, token-less WS) without the flood.
    DB_ECHO: bool = False

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── Redis ────────────────────────────────────────────────
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None

    @property
    def redis_url(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/0"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    # ── Celery ───────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── JWT ──────────────────────────────────────────────────
    JWT_SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── AI / ML ──────────────────────────────────────────────
    YOLO_MODEL_PATH: str = "/app/ai/models/yolov8n.pt"
    YOLO_CONFIDENCE_THRESHOLD: float = 0.5
    YOLO_IOU_THRESHOLD: float = 0.45
    OCR_ENGINE: str = "easyocr"
    GPU_ENABLED: bool = False
    MAX_FPS: int = 30
    FRAME_SKIP: int = 2
    AI_WORKERS: int = 2

    # ── Cameras ──────────────────────────────────────────────
    RTSP_TIMEOUT: int = 10
    MAX_CAMERAS: int = 50
    STREAM_BUFFER_SIZE: int = 10

    # ── Notifications ────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@enforcement.gov"
    SMTP_TLS: bool = True

    SMS_PROVIDER: str = "twilio"
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # ── Storage ──────────────────────────────────────────────
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50
    EVIDENCE_RETENTION_DAYS: int = 90

    # ── Rate Limiting ────────────────────────────────────────
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60

    # ── Monitoring ───────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
