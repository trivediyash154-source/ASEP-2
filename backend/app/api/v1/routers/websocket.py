"""
WebSocket endpoints.

All endpoints validate the JWT token passed as a query parameter.
A background Redis subscriber relays messages published by Celery tasks
(e.g. challan_issued) into the relevant WebSocket rooms.

Endpoints:
  /ws/detections      — global feed of all detection events
  /ws/camera/{id}     — feed for a specific camera
  /ws/alerts          — violation alerts + challan_issued events
  /ws/metrics         — system resource stream (CPU/memory every 5s)
"""

import asyncio
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import decode_token
from app.websockets.manager import ws_manager

logger = get_logger(__name__)
router = APIRouter(tags=["WebSockets"])

# How often to push a keepalive ping (seconds)
PING_INTERVAL = 25
# Max consecutive failures before abandoning a connection
MAX_SEND_FAILURES = 3


# ── Auth helper ───────────────────────────────────────────────────

async def _authenticate_ws(token: Optional[str]) -> Optional[str]:
    """
    Validates a JWT token passed as a query parameter.
    Returns the user_id string on success, or None if invalid.
    Permits connection in DEBUG mode without a token for local development.
    """
    if not token:
        if settings.DEBUG:
            logger.warning("ws_no_token_debug_mode_allowing")
            return "anonymous"
        return None

    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except Exception:
        return None


# ── Global detection feed ─────────────────────────────────────────

@router.websocket("/ws/detections")
async def ws_global_detections(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    user_id = await _authenticate_ws(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    conn_id = str(uuid.uuid4())
    await ws_manager.connect(websocket, conn_id, user_id=user_id)
    ws_manager.subscribe(conn_id, "global:detections")

    try:
        await ws_manager.send_to(conn_id, {
            "type": "connected",
            "connection_id": conn_id,
            "room": "global:detections",
        })
        await _keepalive_loop(conn_id)
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(conn_id)
        logger.debug("ws_disconnected", conn_id=conn_id, room="global:detections")


# ── Per-camera feed ───────────────────────────────────────────────

@router.websocket("/ws/camera/{camera_id}")
async def ws_camera_feed(
    websocket: WebSocket,
    camera_id: str,
    token: Optional[str] = Query(None),
):
    user_id = await _authenticate_ws(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    conn_id = str(uuid.uuid4())
    room = f"camera:{camera_id}"
    await ws_manager.connect(websocket, conn_id, user_id=user_id)
    ws_manager.subscribe(conn_id, room)
    ws_manager.subscribe(conn_id, "global:detections")

    try:
        await ws_manager.send_to(conn_id, {"type": "subscribed", "room": room})
        await _keepalive_loop(conn_id)
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(conn_id)


# ── Alerts channel ────────────────────────────────────────────────

@router.websocket("/ws/alerts")
async def ws_alerts(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    user_id = await _authenticate_ws(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    conn_id = str(uuid.uuid4())
    await ws_manager.connect(websocket, conn_id, user_id=user_id)
    ws_manager.subscribe(conn_id, "global:alerts")

    try:
        await ws_manager.send_to(conn_id, {"type": "subscribed", "room": "global:alerts"})
        await _keepalive_loop(conn_id)
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(conn_id)


# ── System metrics stream ─────────────────────────────────────────

@router.websocket("/ws/metrics")
async def ws_system_metrics(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    user_id = await _authenticate_ws(token)
    if not user_id:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    conn_id = str(uuid.uuid4())
    await ws_manager.connect(websocket, conn_id, user_id=user_id)

    failures = 0
    try:
        while True:
            try:
                metrics = await _collect_system_metrics()
                await ws_manager.send_to(conn_id, metrics)
                failures = 0
            except Exception as e:
                failures += 1
                logger.error("metrics_collection_failed", error=str(e), failures=failures)
                if failures >= MAX_SEND_FAILURES:
                    logger.error("metrics_ws_max_failures_disconnecting", conn_id=conn_id)
                    break

            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(conn_id)


# ── Redis pub/sub relay ───────────────────────────────────────────

async def start_redis_relay() -> asyncio.Task:
    """
    Background task started at app startup.
    Subscribes to the Redis 'ws:broadcasts' channel and routes messages
    to the correct WebSocket rooms.

    Celery tasks publish here via _broadcast_challan_issued().
    """
    return asyncio.create_task(_redis_relay_loop(), name="redis-ws-relay")


async def _redis_relay_loop() -> None:
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe("ws:broadcasts")
        logger.info("redis_ws_relay_started", channel="ws:broadcasts")

        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            try:
                payload = json.loads(message["data"])
                room = payload.get("room", "global:alerts")
                event = payload.get("event", {})
                await ws_manager.broadcast_to_room(room, event)
                logger.debug("redis_relayed", room=room, event_type=event.get("event_type"))
            except json.JSONDecodeError:
                logger.warning("redis_relay_bad_json", data=message["data"][:200])
            except Exception as e:
                logger.error("redis_relay_dispatch_error", error=str(e))

    except asyncio.CancelledError:
        logger.info("redis_ws_relay_stopped")
    except Exception as e:
        logger.error("redis_ws_relay_crashed", error=str(e))
        # Reconnect after 10 seconds
        await asyncio.sleep(10)
        await _redis_relay_loop()


# ── Helpers ───────────────────────────────────────────────────────

async def _keepalive_loop(conn_id: str) -> None:
    """Sends a ping every PING_INTERVAL seconds to keep the connection alive."""
    failures = 0
    while True:
        await asyncio.sleep(PING_INTERVAL)
        try:
            await ws_manager.send_to(conn_id, {"type": "ping"})
            failures = 0
        except Exception:
            failures += 1
            if failures >= MAX_SEND_FAILURES:
                break


async def _collect_system_metrics() -> dict:
    """Collects real CPU/memory/disk metrics. Async-safe (no blocking calls)."""
    import psutil
    loop = asyncio.get_event_loop()

    # cpu_percent with interval blocks — run in executor
    cpu = await loop.run_in_executor(None, lambda: psutil.cpu_percent(interval=0.5))
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    gpu_metrics = await _get_gpu_metrics()

    from app.ai.pipeline import pipeline_manager
    from app.services.demo_pipeline import demo_pipelines

    # Include both regular and demo pipeline cameras in the active count
    demo_active = [
        cid for cid, h in demo_pipelines._workers.items()
        if not h.task.done()
    ]
    all_active = pipeline_manager.get_active_cameras() + demo_active

    # Merge pipeline statuses: regular + demo
    combined_pipeline_status = {**pipeline_manager.pipeline_status()}
    for cid in demo_active:
        h = demo_pipelines._handle(cid)
        if h:
            combined_pipeline_status[cid] = {
                "running": True,
                "fps": round(h.stats.last_yolo_ms and (1000 / h.stats.last_yolo_ms) or 0, 1),
                "frames": h.stats.frames_processed,
                "errors": 0,
            }

    return {
        "type": "system_metrics",
        "cpu": round(cpu, 1),
        "cpu_cores": psutil.cpu_count(logical=True),
        "memory": round(mem.percent, 1),
        "memory_used_gb": round(mem.used / 1e9, 2),
        "memory_total_gb": round(mem.total / 1e9, 2),
        "disk": round(disk.percent, 1),
        "disk_used_gb": round(disk.used / 1e9, 2),
        "disk_total_gb": round(disk.total / 1e9, 2),
        "active_connections": ws_manager.active_count,
        "active_cameras": len(all_active),
        "pipeline_status": combined_pipeline_status,
        "gpu": gpu_metrics,
    }


async def _get_gpu_metrics() -> dict:
    try:
        import pynvml
        loop = asyncio.get_event_loop()

        def _read_gpu() -> dict:
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            name = pynvml.nvmlDeviceGetName(handle)
            util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
            temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
            return {
                "available": True,
                "name": name if isinstance(name, str) else name.decode(),
                "usage_percent": util.gpu,
                "memory_used_gb": round(mem_info.used / 1e9, 2),
                "memory_total_gb": round(mem_info.total / 1e9, 2),
                "temperature_c": temp,
            }

        return await loop.run_in_executor(None, _read_gpu)
    except Exception:
        return {"available": False}
