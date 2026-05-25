"""Celery application factory with RedBeat scheduler."""
import warnings

# Suppress Celery's superuser SecurityWarning: containerized workers run as
# root by design (no shared host namespace). Filter must come before importing
# anything that triggers the warning, hence before `from celery import Celery`.
from celery.exceptions import SecurityWarning  # noqa: E402

warnings.filterwarnings("ignore", category=SecurityWarning)

from celery import Celery  # noqa: E402

from app.core.config import settings  # noqa: E402

celery_app = Celery(
    "enforcement",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.detection_tasks",
        "app.workers.tasks.notification_tasks",
        "app.workers.tasks.report_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Celery 6.x: opt in to startup retry explicitly so we don't get the
    # CPendingDeprecationWarning about `broker_connection_retry` behavior change.
    broker_connection_retry_on_startup=True,
    task_routes={
        "app.workers.tasks.detection_tasks.*": {"queue": "ai"},
        "app.workers.tasks.notification_tasks.*": {"queue": "notifications"},
        "app.workers.tasks.report_tasks.*": {"queue": "reports"},
    },
    beat_schedule={
        "mark-overdue-challans": {
            "task": "app.workers.tasks.report_tasks.mark_overdue_challans",
            "schedule": 3600,  # every hour
        },
        "cleanup-old-frames": {
            "task": "app.workers.tasks.detection_tasks.cleanup_old_evidence",
            "schedule": 86400,  # daily
        },
    },
)
