"""
AI Vehicle Expiry Enforcement System — FastAPI Application Entry Point
"""
import time
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from pathlib import Path

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.v1 import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.db.session import check_database_health, engine
from app.ai.detector import vehicle_detector
from app.ai.ocr import plate_ocr
from app.middleware.rate_limit import RateLimitMiddleware

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle management."""
    configure_logging()
    logger.info("enforcement_platform_starting", version=settings.APP_VERSION, env=settings.APP_ENV)

    # First-boot bootstrap: idempotent migrations + demo user seeding.
    # Skipped automatically in production (operators run alembic manually
    # against a managed DB), but ensures dev/demo starts work out of the box.
    if settings.APP_ENV.lower() not in ("production", "prod"):
        from scripts.bootstrap import bootstrap as _bootstrap
        await _bootstrap()

    # Initialize Redis
    redis_client = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    app.state.redis = redis_client

    # Load AI models — raises if no engines available
    try:
        vehicle_detector.load()
        plate_ocr.load()
        logger.info(
            "ai_models_loaded",
            ocr_engines=plate_ocr.engines_loaded,
            yolo_device="cuda" if settings.GPU_ENABLED else "cpu",
        )
    except RuntimeError as e:
        # RuntimeError = config/install problem; log it but allow startup
        # so the API is still usable for non-AI endpoints
        logger.error("ai_models_load_failed", error=str(e), hint="Check model paths and OCR installs")
    except Exception as e:
        logger.error("ai_models_load_unexpected", error=str(e))

    # Validate notification credentials at startup. The function itself emits
    # the appropriate log records (INFO in dev, WARN in prod, ERROR for invalid
    # credentials), so we don't re-echo them here — just keep the structured
    # status on app.state for /health and dashboard consumption.
    from app.workers.tasks.notification_tasks import validate_notification_credentials
    app.state.notification_status = validate_notification_credentials()

    # Start Redis → WebSocket relay task
    from app.api.v1.routers.websocket import start_redis_relay
    relay_task = await start_redis_relay()
    app.state.redis_relay = relay_task

    # Start synthetic live-activity generator (dev/demo only — no-op in prod)
    from app.services.live_activity import start as start_live_activity
    app.state.live_activity_task = await start_live_activity()

    # Verify DB connectivity
    db_healthy = await check_database_health()
    if not db_healthy:
        logger.error("database_connection_failed_at_startup")

    logger.info("enforcement_platform_ready")
    yield

    # Graceful shutdown
    logger.info("enforcement_platform_shutting_down")
    from app.ai.pipeline import pipeline_manager
    from app.services.demo_pipeline import demo_pipelines
    from app.services.stream_manager import stream_registry
    await pipeline_manager.stop_all()
    await demo_pipelines.stop_all()
    await stream_registry.shutdown_all()
    if hasattr(app.state, "redis_relay"):
        app.state.redis_relay.cancel()
    if hasattr(app.state, "live_activity_task"):
        app.state.live_activity_task.cancel()
    await redis_client.aclose()
    await engine.dispose()
    logger.info("enforcement_platform_shutdown_complete")


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Enterprise AI Vehicle Expiry Enforcement Platform",
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    # ── Middleware stack (order matters — outermost executes first) ───────────
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # CORS setup — allow any origin in development to support arbitrary LAN IPs and tunnels
    if settings.APP_ENV.lower() != "production":
        app.add_middleware(
            CORSMiddleware,
            allow_origin_regex=r"https?://.*",
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining"],
        )

    # ── Prometheus metrics ────────────────────────────────────────────────────
    Instrumentator(
        should_group_status_codes=True,
        excluded_handlers=["/health", "/metrics"],
    ).instrument(app).expose(app, endpoint="/metrics")

    # ── API Routes ────────────────────────────────────────────────────────────
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # ── Static file serving for evidence uploads ──────────────────────────────
    # Nginx handles this in production (mounted at /var/uploads:ro). This mount
    # ensures /uploads/* also works when accessing FastAPI directly (dev + Docker
    # with NEXT_PUBLIC_API_URL pointing to port 8000).
    uploads_dir = Path(settings.UPLOAD_DIR)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

    # ── Health check ──────────────────────────────────────────────────────────
    @app.get("/health", tags=["Health"])
    async def health_check(request: Request):
        db_ok = await check_database_health()
        redis_ok = False
        try:
            await request.app.state.redis.ping()
            redis_ok = True
        except Exception:
            pass

        overall = db_ok and redis_ok
        return JSONResponse(
            status_code=status.HTTP_200_OK if overall else status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "healthy" if overall else "degraded",
                "version": settings.APP_VERSION,
                "services": {
                    "database": "ok" if db_ok else "error",
                    "redis": "ok" if redis_ok else "error",
                },
            },
        )

    # ── Request timing header ─────────────────────────────────────────────────
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start = time.perf_counter()
        response: Response = await call_next(request)
        response.headers["X-Process-Time"] = f"{(time.perf_counter() - start) * 1000:.2f}ms"
        response.headers["X-Platform"] = "AI-Enforcement-v1"
        return response

    # ── Global exception handler ──────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error("unhandled_exception", path=str(request.url), error=str(exc), exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal error occurred. Our team has been notified."},
        )

    return app


app = create_application()
