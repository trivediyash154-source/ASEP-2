"""
WebSocket connection manager.
Supports per-camera subscriptions, broadcast, and room-based messaging.
"""
import asyncio
import contextlib
import json
from collections import defaultdict
from typing import Any, Dict, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect

from app.core.logging import get_logger

logger = get_logger(__name__)

# A send to a dead / half-open / backpressured client can otherwise hang on the
# TCP buffer indefinitely, stalling the whole broadcast (and any caller awaiting
# it). Bound every send so one bad client is dropped fast instead.
WS_SEND_TIMEOUT_S = 3.0
# Hard ceiling on concurrent connections. A frontend reconnect storm cannot grow
# the connection table without bound and exhaust memory/file descriptors.
MAX_CONNECTIONS = 400


class ConnectionManager:
    def __init__(self) -> None:
        # All active connections
        self._connections: Dict[str, WebSocket] = {}
        # Room subscriptions: room_id → set of connection_ids
        self._rooms: Dict[str, Set[str]] = defaultdict(set)
        # Connection metadata
        self._metadata: Dict[str, Dict[str, Any]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        connection_id: str,
        user_id: Optional[str] = None,
    ) -> None:
        # Bound the connection table so a reconnect storm can't grow it without
        # limit. At capacity we evict the OLDEST socket (dict is insertion-
        # ordered) to make room — that reaps a storm's own stale entries while
        # keeping the accept path's contract unchanged for callers.
        while len(self._connections) >= MAX_CONNECTIONS:
            oldest_id = next(iter(self._connections))
            oldest_ws = self._connections.get(oldest_id)
            logger.warning(
                "ws_evicting_oldest_at_capacity",
                evicted=oldest_id, active=len(self._connections), cap=MAX_CONNECTIONS,
            )
            self.disconnect(oldest_id)
            if oldest_ws is not None:
                with contextlib.suppress(Exception):
                    await oldest_ws.close(code=1013)  # try again later
        await websocket.accept()
        self._connections[connection_id] = websocket
        self._metadata[connection_id] = {"user_id": user_id, "rooms": set()}
        logger.info("ws_connected", connection_id=connection_id, user_id=user_id)

    def disconnect(self, connection_id: str) -> None:
        self._connections.pop(connection_id, None)
        meta = self._metadata.pop(connection_id, {})
        for room in meta.get("rooms", set()):
            self._rooms[room].discard(connection_id)
        logger.info("ws_disconnected", connection_id=connection_id)

    def subscribe(self, connection_id: str, room: str) -> None:
        self._rooms[room].add(connection_id)
        if connection_id in self._metadata:
            self._metadata[connection_id]["rooms"].add(room)

    def unsubscribe(self, connection_id: str, room: str) -> None:
        self._rooms[room].discard(connection_id)
        if connection_id in self._metadata:
            self._metadata[connection_id]["rooms"].discard(room)

    async def send_to(self, connection_id: str, data: Any) -> None:
        ws = self._connections.get(connection_id)
        if ws is None:
            return
        try:
            payload = json.dumps(data) if not isinstance(data, str) else data
            # Timeout-bounded so a stalled client can never block the broadcast
            # gather (and therefore the event loop) — it's dropped instead.
            await asyncio.wait_for(ws.send_text(payload), timeout=WS_SEND_TIMEOUT_S)
        except asyncio.TimeoutError:
            logger.warning("ws_send_timeout", connection_id=connection_id)
            self.disconnect(connection_id)
            with contextlib.suppress(Exception):
                await ws.close(code=1011)
        except Exception as e:
            logger.warning("ws_send_failed", connection_id=connection_id, error=str(e))
            self.disconnect(connection_id)

    async def broadcast_to_room(self, room: str, data: Any) -> None:
        connection_ids = list(self._rooms.get(room, set()))
        if not connection_ids:
            return
        payload = json.dumps(data) if not isinstance(data, str) else data
        tasks = [self.send_to(cid, payload) for cid in connection_ids]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_all(self, data: Any) -> None:
        payload = json.dumps(data) if not isinstance(data, str) else data
        tasks = [self.send_to(cid, payload) for cid in list(self._connections.keys())]
        await asyncio.gather(*tasks, return_exceptions=True)

    @property
    def active_count(self) -> int:
        return len(self._connections)

    def get_room_count(self, room: str) -> int:
        return len(self._rooms.get(room, set()))


ws_manager = ConnectionManager()
