"""
Event-loop watchdog.

A single background task that proves the asyncio event loop is alive and
surfaces realtime-pipeline telemetry every WATCHDOG_INTERVAL_S seconds.

The core signal is *loop lag*: the task sleeps for a fixed interval and
measures how much longer than that it actually took to wake. If a synchronous
call is blocking the loop (a blocking C call, a flooded synchronous log write,
a non-offloaded inference), the sleep returns late and the lag spikes — which
is logged as a warning. This is the diagnostic that distinguishes a *soft-lock*
(loop blocked, low CPU, no crash) from a healthy idle system.
"""
from __future__ import annotations

import asyncio

from app.core.logging import get_logger
from app.services.stream_manager import stream_registry
from app.websockets.manager import ws_manager

logger = get_logger(__name__)

WATCHDOG_INTERVAL_S = 5.0
# A late wake-up beyond this means the loop was blocked between ticks.
LOOP_LAG_WARN_MS = 1000.0


async def run_watchdog() -> None:
    loop = asyncio.get_event_loop()
    logger.info("watchdog_started", interval_s=WATCHDOG_INTERVAL_S)

    while True:
        t0 = loop.time()
        try:
            await asyncio.sleep(WATCHDOG_INTERVAL_S)
        except asyncio.CancelledError:
            logger.info("watchdog_stopped")
            raise

        # How much longer than requested we actually slept == time the loop
        # spent unable to run this task (i.e. blocked on something synchronous).
        loop_lag_ms = round((loop.time() - t0 - WATCHDOG_INTERVAL_S) * 1000, 1)

        # Late import — demo_pipeline imports the ws_manager/stream_registry
        # this module also imports, so defer to avoid an import cycle at boot.
        from app.services.demo_pipeline import demo_pipelines

        streams = stream_registry.list_active()
        pipelines = []
        ocr_jobs_total = 0
        for cid, h in list(demo_pipelines._workers.items()):
            src = streams.get(cid)
            ocr_jobs_total += h.stats.ocr_attempts
            pipelines.append(
                {
                    "camera_id": cid,
                    "running": not h.task.done(),
                    "fps": round(src.metrics.fps, 1) if src else 0.0,
                    "queue_depth": src.buffer_depth if src else 0,
                    "frames": h.stats.frames_processed,
                    "ocr_attempts": h.stats.ocr_attempts,
                    "ocr_reliable": h.stats.ocr_reliable,
                    "stream_health": src.metrics.health if src else "NONE",
                    "last_error": h.stats.last_error,
                }
            )

        logger.info(
            "watchdog",
            loop_alive=True,
            loop_lag_ms=loop_lag_ms,
            active_streams=len(streams),
            ws_clients=ws_manager.active_count,
            active_pipelines=len(pipelines),
            ocr_jobs_total=ocr_jobs_total,
            pipelines=pipelines,
        )

        if loop_lag_ms > LOOP_LAG_WARN_MS:
            logger.warning(
                "watchdog_event_loop_lagging",
                loop_lag_ms=loop_lag_ms,
                hint=(
                    "event loop was blocked between ticks — a synchronous call "
                    "is running on the loop (blocking I/O, un-offloaded inference, "
                    "or a flooded synchronous log write)"
                ),
            )


async def start() -> asyncio.Task:
    """Spawn the watchdog and return its Task so the caller can cancel on shutdown."""
    return asyncio.create_task(run_watchdog(), name="event-loop-watchdog")
