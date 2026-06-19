"""Open N concurrent WebSocket clients, hold them, then close. Stress test."""
import asyncio
import sys
import time

import websockets

N = int(sys.argv[1]) if len(sys.argv) > 1 else 120
HOLD_S = int(sys.argv[2]) if len(sys.argv) > 2 else 25
ENDPOINTS = [
    "ws://127.0.0.1:8000/api/v1/ws/metrics",
    "ws://127.0.0.1:8000/api/v1/ws/detections",
    "ws://127.0.0.1:8000/api/v1/ws/alerts",
]


async def client(i, deadline, stats):
    url = ENDPOINTS[i % len(ENDPOINTS)]
    try:
        async with websockets.connect(url, open_timeout=8, close_timeout=3) as ws:
            stats["connected"] += 1
            while time.time() < deadline:
                try:
                    await asyncio.wait_for(ws.recv(), timeout=2)
                except asyncio.TimeoutError:
                    pass
    except Exception as e:
        stats["errors"] += 1
        stats["last_err"] = str(e)[:80]


async def main():
    stats = {"connected": 0, "errors": 0, "last_err": ""}
    deadline = time.time() + HOLD_S
    tasks = [asyncio.create_task(client(i, deadline, stats)) for i in range(N)]
    # let them all connect
    await asyncio.sleep(3)
    print(f"opened={stats['connected']}/{N} errors={stats['errors']}", flush=True)
    await asyncio.gather(*tasks, return_exceptions=True)
    print(f"final connected_peak~{stats['connected']} errors={stats['errors']} "
          f"last_err={stats['last_err']}", flush=True)


asyncio.run(main())
