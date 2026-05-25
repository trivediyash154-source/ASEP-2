"""
Analytics aggregation service — powers dashboard KPI cards and charts.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Any, Dict, List

import psutil
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.camera import Camera
from app.models.challan import Challan
from app.models.detection import Detection
from app.repositories.detection_repo import DetectionRepository
from app.repositories.challan_repo import ChallanRepository
from app.core.constants import ChallanStatus, CameraStatus, DetectionStatus
from app.core.logging import get_logger

logger = get_logger(__name__)


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.detection_repo = DetectionRepository(db)
        self.challan_repo = ChallanRepository(db)

    async def get_dashboard_summary(self) -> Dict[str, Any]:
        """Single query batch for dashboard KPI cards."""
        detection_stats, challan_stats, camera_count = await asyncio.gather(
            self.detection_repo.get_stats_last_24h(),
            self.challan_repo.revenue_stats(),
            self._get_active_camera_count(),
        )

        total_24h = detection_stats["total"]
        violations_24h = detection_stats["violations"]
        success_rate = round((total_24h - violations_24h) / max(total_24h, 1) * 100, 1)

        return {
            "kpis": {
                "total_scans_24h": total_24h,
                "violations_24h": violations_24h,
                "success_rate": success_rate,
                "avg_confidence": detection_stats["avg_confidence"],
                "active_cameras": camera_count,
                "pending_challans": challan_stats["pending_count"],
                "revenue_pending": challan_stats["total_issued"] - challan_stats["total_collected"],
                "revenue_collected": challan_stats["total_collected"],
            }
        }

    async def get_detection_timeline(self, hours: int = 24) -> List[Dict[str, Any]]:
        return await self.detection_repo.hourly_detection_counts(hours)

    async def get_system_metrics(self) -> Dict[str, Any]:
        """Real-time system resource usage for the monitoring panel."""
        cpu = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        gpu_metrics = await self._get_gpu_metrics()

        return {
            "cpu": {
                "usage_percent": cpu,
                "core_count": psutil.cpu_count(),
            },
            "memory": {
                "total_gb": round(mem.total / 1e9, 2),
                "used_gb": round(mem.used / 1e9, 2),
                "usage_percent": mem.percent,
            },
            "disk": {
                "total_gb": round(disk.total / 1e9, 2),
                "used_gb": round(disk.used / 1e9, 2),
                "usage_percent": round(disk.percent, 1),
            },
            "gpu": gpu_metrics,
        }

    async def get_camera_analytics(self) -> List[Dict[str, Any]]:
        result = await self.db.execute(
            select(
                Camera.camera_id,
                Camera.name,
                Camera.status,
                Camera.total_detections,
                Camera.error_count,
                Camera.last_seen,
            )
        )
        return [
            {
                "camera_id": row.camera_id,
                "name": row.name,
                "status": row.status,
                "total_detections": row.total_detections,
                "error_count": row.error_count,
                "last_seen": row.last_seen.isoformat() if row.last_seen else None,
            }
            for row in result
        ]

    async def get_violation_breakdown(self) -> List[Dict[str, Any]]:
        """Count violations grouped by type for the analytics pie chart."""
        result = await self.db.execute(
            select(Detection.violation_type, func.count().label("count"))
            .where(Detection.violation_type.isnot(None))
            .where(Detection.is_violation == True)  # noqa: E712
            .group_by(Detection.violation_type)
            .order_by(func.count().desc())
        )
        rows = result.all()
        total = sum(r.count for r in rows) or 1
        return [
            {"type": r.violation_type, "count": r.count, "pct": round(r.count / total * 100, 1)}
            for r in rows
        ]

    async def get_ai_performance(self) -> Dict[str, Any]:
        """Real AI performance metrics derived from stored detection records."""
        processed = await self.db.execute(
            select(
                func.count().label("total"),
                func.avg(Detection.processing_time_ms).label("avg_ms"),
                func.avg(Detection.vehicle_confidence).label("avg_veh"),
                func.avg(Detection.ocr_confidence).label("avg_ocr"),
            )
            .where(Detection.status == DetectionStatus.PROCESSED)
        )
        row = processed.one_or_none()

        failed_count = (await self.db.execute(
            select(func.count()).select_from(Detection).where(Detection.status == DetectionStatus.FAILED)
        )).scalar_one()

        total = (row.total or 0) if row else 0
        combined = total + failed_count

        return {
            "avg_processing_ms": round(row.avg_ms) if row and row.avg_ms else None,
            "vehicle_detection_pct": round((row.avg_veh or 0) * 100, 1) if row and row.avg_veh else None,
            "ocr_accuracy_pct": round((row.avg_ocr or 0) * 100, 1) if row and row.avg_ocr else None,
            "error_rate_pct": round(failed_count / max(combined, 1) * 100, 1),
            "sample_size": total,
        }

    async def _get_active_camera_count(self) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Camera).where(Camera.status == CameraStatus.ACTIVE)
        )
        return result.scalar_one()

    async def _get_gpu_metrics(self) -> Dict[str, Any]:
        try:
            import pynvml
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            return {
                "available": True,
                "usage_percent": util.gpu,
                "memory_used_gb": round(info.used / 1e9, 2),
                "memory_total_gb": round(info.total / 1e9, 2),
            }
        except Exception:
            return {"available": False}
