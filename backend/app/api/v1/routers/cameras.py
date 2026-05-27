"""Camera management endpoints."""
import asyncio
import time
import uuid
from typing import List, Optional

import cv2
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.pipeline import pipeline_manager
from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import decode_token
from app.db.session import get_db
from app.middleware.auth_middleware import get_current_active_user, require_operator
from app.models.camera import Camera
from app.schemas.camera import CameraCreate, CameraResponse, CameraUpdate
from app.core.constants import CameraStatus
from app.services.demo_pipeline import demo_pipelines
from app.services.stream_manager import stream_registry
from app.websockets.manager import ws_manager

logger = get_logger(__name__)

router = APIRouter(prefix="/cameras", tags=["Cameras"])


# ── Auth helper for media/WS endpoints (token in query string) ────────


async def _resolve_user_id_from_query(token: Optional[str]) -> Optional[str]:
    """Best-effort token validation for endpoints that can't carry a header
    (e.g. <img src=...> for MJPEG, browser WebSocket)."""
    if not token:
        return "anonymous" if settings.DEBUG else None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except Exception:
        return None


@router.get("/", response_model=List[CameraResponse])
async def list_cameras(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    result = await db.execute(select(Camera).offset(skip).limit(limit))
    return [CameraResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
async def create_camera(
    body: CameraCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator),
):
    camera = Camera(**body.model_dump())
    db.add(camera)
    await db.flush()
    await db.refresh(camera)
    return CameraResponse.model_validate(camera)


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(
    camera_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_active_user),
):
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    return CameraResponse.model_validate(camera)


@router.patch("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: uuid.UUID,
    body: CameraUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator),
):
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(camera, field, value)
    db.add(camera)
    await db.flush()
    await db.refresh(camera)
    return CameraResponse.model_validate(camera)


@router.post("/{camera_id}/start", status_code=status.HTTP_202_ACCEPTED)
async def start_camera_stream(
    camera_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator),
):
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")
    if not camera.rtsp_url and not camera.stream_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No stream URL configured")

    from app.websockets.manager import ws_manager

    async def on_detection_event(event: dict) -> None:
        await ws_manager.broadcast_to_room(f"camera:{camera.camera_id}", event)
        await ws_manager.broadcast_to_room("global:detections", event)

    stream_url = camera.rtsp_url or camera.stream_url
    await pipeline_manager.start_camera(
        camera_id=camera.camera_id,
        db_camera_id=str(camera.id),
        stream_url=stream_url,
        event_callback=on_detection_event,
    )

    camera.status = CameraStatus.ACTIVE
    db.add(camera)
    await db.flush()

    return {"message": "Stream started", "camera_id": camera.camera_id}


@router.post("/{camera_id}/stop", status_code=status.HTTP_202_ACCEPTED)
async def stop_camera_stream(
    camera_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_operator),
):
    camera = await db.get(Camera, camera_id)
    if not camera:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Camera not found")

    await pipeline_manager.stop_camera(camera.camera_id)
    camera.status = CameraStatus.INACTIVE
    db.add(camera)
    await db.flush()

    return {"message": "Stream stopped", "camera_id": camera.camera_id}


@router.get("/status/active", response_model=List[str])
async def get_active_cameras(_=Depends(get_current_active_user)):
    return pipeline_manager.get_active_cameras()


# ════════════════════════════════════════════════════════════════════
# DEMO LIVE STREAM — mobile camera ingestion + ANPR + WS broadcast
# ════════════════════════════════════════════════════════════════════


class DemoConnectRequest(BaseModel):
    """Request body for /cameras/demo/{camera_id}/connect.

    Accepts:
      * IP Webcam / DroidCam: http://<phone-ip>:8080/video
      * RTSP:                  rtsp://user:pass@<ip>:554/stream
      * USB webcam index:      "0" or 0
    """
    source_url: str = Field(..., min_length=1, max_length=500)


class DemoProbeRequest(BaseModel):
    source_url: str = Field(..., min_length=1, max_length=500)


@router.post("/demo/probe")
async def demo_probe(body: DemoProbeRequest, _=Depends(get_current_active_user)):
    """Quickly test whether a stream URL is reachable from this backend.

    For HTTP/MJPEG, opens a short GET and reads the first chunk so we can
    distinguish:
      * unreachable      (network/DNS error)
      * reachable but wrong content (HTML 404, plaintext, etc.)
      * looks-like-a-stream (multipart/x-mixed-replace or image/*)

    For RTSP / USB index this just echoes that we can't probe without
    opening cv2.VideoCapture — those still go through the regular /connect
    path which now has a 9s opener.
    """
    import socket
    from urllib.parse import urlparse
    import httpx

    url = body.source_url.strip()
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()

    if scheme in ("rtsp",):
        return {"reachable": True, "kind": "rtsp", "hint": "RTSP probe skipped — try /connect."}
    if not scheme or url.isdigit():
        return {"reachable": True, "kind": "local", "hint": "Local index — not network-probed."}
    if scheme not in ("http", "https"):
        return {"reachable": False, "kind": "unknown", "error": f"Unsupported scheme: {scheme!r}"}

    # TCP-level reachability first — gives a fast, clear error.
    host = parsed.hostname
    port = parsed.port or (443 if scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=3.0):
            pass
    except OSError as exc:
        return {
            "reachable": False,
            "kind": "tcp_error",
            "error": f"Cannot reach {host}:{port} — {exc}",
            "hint": (
                "Make sure the phone and this machine are on the same Wi-Fi, the camera "
                "app is running, and any phone-side firewall is off. If the backend "
                "runs in Docker, confirm Docker can reach LAN IPs."
            ),
        }

    # HTTP-level probe — first chunk only.
    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            async with client.stream("GET", url) as resp:
                ct = resp.headers.get("content-type", "").lower()
                first_bytes = b""
                try:
                    async for chunk in resp.aiter_bytes():
                        first_bytes = chunk[:64]
                        break
                except Exception:
                    pass
                looks_like_mjpeg = ct.startswith("multipart/") or ct.startswith("image/")
                return {
                    "reachable": True,
                    "kind": "mjpeg" if looks_like_mjpeg else "http",
                    "status": resp.status_code,
                    "content_type": ct or None,
                    "hint": (
                        None if looks_like_mjpeg
                        else "Reachable, but didn't look like an MJPEG stream. Double-check the "
                             "URL path (e.g. /video for IP Webcam, /video for DroidCam, "
                             "/mjpegfeed for Iriun)."
                    ),
                }
    except httpx.HTTPError as exc:
        return {"reachable": False, "kind": "http_error", "error": str(exc)}


@router.post("/demo/{camera_id}/connect", status_code=status.HTTP_202_ACCEPTED)
async def demo_connect(
    camera_id: str,
    body: DemoConnectRequest,
    _=Depends(require_operator),
):
    """Open a live stream and start the ANPR pipeline for this demo camera.

    Idempotent: if a worker is already running for this `camera_id`
    it is cleanly torn down and restarted with the new source.
    """
    source: int | str = body.source_url.strip()
    if isinstance(source, str) and source.isdigit():
        source = int(source)

    result = await demo_pipelines.start(camera_id, source)
    if result.get("status") == "failed":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result.get("reason", "Stream open failed"),
        )
    return {"status": result["status"], "camera_id": camera_id, "source": str(source)}


@router.post("/demo/{camera_id}/disconnect", status_code=status.HTTP_202_ACCEPTED)
async def demo_disconnect(camera_id: str, _=Depends(require_operator)):
    stopped = await demo_pipelines.stop(camera_id)
    return {"stopped": stopped, "camera_id": camera_id}


@router.get("/demo/{camera_id}/status")
async def demo_status(camera_id: str, _=Depends(get_current_active_user)):
    return demo_pipelines.status(camera_id)


@router.get("/demo/{camera_id}/diagnostics")
async def demo_diagnostics(camera_id: str, _=Depends(get_current_active_user)):
    """Full pipeline state for debugging: stream open, frames processed,
    model load state, OCR engines, active tracks, recent plates, last error."""
    return demo_pipelines.diagnostics(camera_id)


@router.get("/demo/{camera_id}/mjpeg")
async def demo_mjpeg(camera_id: str, token: Optional[str] = Query(None)):
    """Multipart MJPEG passthrough so a plain <img> tag can render the feed.

    JWT must be passed as `?token=` because browsers don't send
    Authorization headers on <img> requests. Encoded at the consumer
    side (JPEG quality 78, capped at MAX_BROWSER_FPS).
    """
    user_id = await _resolve_user_id_from_query(token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing token")

    source = stream_registry.get(camera_id)
    if source is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No live stream for that camera")

    MAX_BROWSER_FPS = 18
    period = 1.0 / MAX_BROWSER_FPS

    async def gen():
        boundary = b"--frame"
        last_t = 0.0
        while True:
            now = time.perf_counter()
            wait = period - (now - last_t)
            if wait > 0:
                await asyncio.sleep(wait)
            last_t = time.perf_counter()

            frame = source.latest_frame()
            if frame is None:
                await asyncio.sleep(0.05)
                continue

            ok, buf = await asyncio.to_thread(
                cv2.imencode, ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 78]
            )
            if not ok:
                continue
            chunk = (
                boundary
                + b"\r\nContent-Type: image/jpeg\r\nContent-Length: "
                + str(buf.size).encode()
                + b"\r\n\r\n"
                + buf.tobytes()
                + b"\r\n"
            )
            try:
                yield chunk
            except (asyncio.CancelledError, GeneratorExit):
                logger.info("mjpeg_client_disconnected", camera_id=camera_id)
                return

    return StreamingResponse(
        gen(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@router.websocket("/demo/{camera_id}/stream")
async def demo_stream_ws(
    websocket: WebSocket,
    camera_id: str,
    token: Optional[str] = Query(None),
):
    """Per-camera structured-event channel: detections, telemetry, heartbeats."""
    user_id = await _resolve_user_id_from_query(token)
    if user_id is None:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    conn_id = str(uuid.uuid4())
    room = f"demo:{camera_id}"
    await ws_manager.connect(websocket, conn_id, user_id=user_id)
    ws_manager.subscribe(conn_id, room)

    try:
        await ws_manager.send_to(conn_id, {"type": "subscribed", "room": room})
        # Echo current source state so the UI can boot the right HUD
        src = stream_registry.get(camera_id)
        await ws_manager.send_to(conn_id, {
            "type": "stream_state",
            "camera_id": camera_id,
            "running": src is not None,
            "telemetry": src.metrics.as_dict() if src else None,
        })
        # Hold the connection open; pings come from the client
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("demo_stream_ws_error", error=str(exc), camera_id=camera_id)
    finally:
        ws_manager.disconnect(conn_id)
