#!/usr/bin/env python3
"""
3-CASE LIVE PIPELINE AUDIT — proof, not claims.

Drives the RUNNING backend through the exact phone-camera path:
  POST /cameras/demo/{cam}/connect  (same endpoint MobileCameraConnect uses)
  MJPEG ingest → decode → YOLO → handheld plate fallback → OCR → regex
  → compliance (registry/synthetic) → persistence → evidence → challan
  → WS broadcast (per-camera + global dashboard feed).

Nothing downstream is mocked; the only synthetic element is the image
source (cert_plate_server renders a printed plate held to a wall —
equivalent to a phone showing a plate image: no vehicle in frame).

CASE 1  MH12AB1234  — staged demo plate (known registry)
CASE 2  MH05AB6263  — NOT in DB → exact OCR + synthetic profile required
CASE 3  KA03MN4567  — plate-only frame (no vehicle) → handheld fallback OCR

Run inside the backend container:
  docker exec enforcement-backend python /app/scripts/audit_3case.py
"""
import asyncio
import json
import os
import sys
import time
import uuid as _uuid
from datetime import datetime

import httpx
import websockets

API = "http://127.0.0.1:8000/api/v1"
WS_BASE = "ws://127.0.0.1:8000/api/v1"
PLATE_SRV = "http://127.0.0.1:8089"
CAM = "audit-cam"
EMAIL = "admin@enforcement.gov"
PASSWORD = "Admin@1234"
TIMEOUT_S = 45

CASES = [
    ("CASE1", "MH12AB1234", "staged/known plate"),
    ("CASE2", "MH05AB6263", "unknown plate -> synthetic profile"),
    ("CASE3", "KA03MN4567", "plate-only frame -> handheld fallback"),
]


async def wait_quiet(ws, quiet_s=3.5, max_s=20.0):
    deadline = time.time() + max_s
    last = time.time()
    while time.time() < deadline:
        if time.time() - last >= quiet_s:
            return
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=0.3)
        except (asyncio.TimeoutError, TimeoutError):
            continue
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        t = msg.get("type")
        if (t == "stream_frame" and msg.get("plate_read")) or (t == "ocr_attempt" and msg.get("text")):
            last = time.time()


async def wait_read(ws, timeout_s):
    """Wait for first non-duplicate plate_read; record ocr attempts + modes."""
    attempts, modes, texts = 0, set(), []
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=max(0.2, deadline - time.time()))
        except (asyncio.TimeoutError, TimeoutError):
            break
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        t = msg.get("type")
        if t == "ocr_attempt":
            attempts += 1
            if msg.get("mode"):
                modes.add(msg["mode"])
            if msg.get("text"):
                texts.append(msg["text"])
        elif t == "stream_frame" and msg.get("plate_read"):
            pr = msg["plate_read"]
            if pr.get("is_duplicate"):
                continue
            return pr, attempts, modes, texts
    return None, attempts, modes, texts


async def collect_global(ws, sink, stop):
    while not stop.is_set():
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=0.5)
        except (asyncio.TimeoutError, TimeoutError):
            continue
        except Exception:
            return
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        if msg.get("type") == "detection":
            sink.append(msg)


async def db_check(results):
    sys.path.insert(0, "/app")
    from sqlalchemy import select
    from app.core.config import settings
    from app.db.session import AsyncSessionFactory
    from app.models.detection import Detection
    from app.models.challan import Challan
    from app.models.vehicle import Vehicle

    async with AsyncSessionFactory() as session:
        for r in results:
            det_id = r.get("detection_id")
            if not det_id:
                continue
            det = await session.get(Detection, _uuid.UUID(det_id))
            r["db_detection_row"] = det is not None
            if det is None:
                continue
            r["db_plate_text"] = det.detected_plate
            r["db_is_violation"] = det.is_violation
            r["db_violation_type"] = det.violation_type
            fp, cp = det.frame_path, det.plate_crop_path
            r["evidence_frame_file"] = (
                os.path.join(settings.UPLOAD_DIR, fp) if fp and os.path.exists(os.path.join(settings.UPLOAD_DIR, fp)) else None
            )
            r["evidence_crop_file"] = (
                os.path.join(settings.UPLOAD_DIR, cp) if cp and os.path.exists(os.path.join(settings.UPLOAD_DIR, cp)) else None
            )
            ch = (await session.execute(
                select(Challan).where(Challan.detection_id == det.id)
            )).scalar_one_or_none()
            r["challan"] = (
                {"number": ch.challan_number, "fine": float(ch.fine_amount), "owner": ch.owner_name}
                if ch else None
            )

        # pre-existence check for the unknown plates
        for plate in ("MH05AB6263", "KA03MN4567"):
            v = (await session.execute(
                select(Vehicle).where(Vehicle.plate_number == plate)
            )).scalars().first()
            print(f"  [registry] vehicle row for {plate}: "
                  f"{'EXISTS (created by synthetic pipeline)' if v else 'ABSENT'}")


async def main() -> int:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
        r.raise_for_status()
        token = r.json()["access_token"]
        auth = {"Authorization": f"Bearer {token}"}

        # plate server up, blanked
        (await client.get(f"{PLATE_SRV}/health")).raise_for_status()
        await client.get(f"{PLATE_SRV}/set")

        # pre-existence of unknown plates in registry (before pipeline runs)
        sys.path.insert(0, "/app")
        from sqlalchemy import select
        from app.db.session import AsyncSessionFactory
        from app.models.vehicle import Vehicle
        async with AsyncSessionFactory() as session:
            for plate in ("MH05AB6263", "KA03MN4567"):
                v = (await session.execute(
                    select(Vehicle).where(Vehicle.plate_number == plate)
                )).scalars().first()
                print(f"[pre] registry row for {plate}: {'EXISTS' if v else 'ABSENT'}")

        # dashboard counters BEFORE
        stats_before = (await client.get(f"{API}/detections/stats", headers=auth)).json()
        print(f"[pre] detections stats: {json.dumps(stats_before)}")

        # ── STAGE 1-2: phone connect (exact endpoint the UI uses) ──
        r = await client.post(
            f"{API}/cameras/demo/{CAM}/connect",
            json={"source_url": f"{PLATE_SRV}/video"},
            headers=auth,
        )
        print(f"[connect] HTTP {r.status_code}: {r.json()}")
        if r.status_code not in (200, 202):
            return 1

        # ── STAGE 3-4: frames received & decoded (diagnostics) ──
        await asyncio.sleep(3)
        d0 = (await client.get(f"{API}/cameras/demo/{CAM}/diagnostics", headers=auth)).json()
        await asyncio.sleep(3)
        d1 = (await client.get(f"{API}/cameras/demo/{CAM}/diagnostics", headers=auth)).json()
        print(f"[frames] t0 diagnostics: {json.dumps(d0)[:400]}")
        print(f"[frames] t1 diagnostics: {json.dumps(d1)[:400]}")

        results = []
        global_events = []
        stop = asyncio.Event()

        async with websockets.connect(
            f"{WS_BASE}/cameras/demo/{CAM}/stream?token={token}", max_size=2**22
        ) as ws_cam, websockets.connect(
            f"{WS_BASE}/ws/detections?token={token}", max_size=2**22
        ) as ws_global:
            collector = asyncio.create_task(collect_global(ws_global, global_events, stop))
            await asyncio.sleep(2.0)

            for tag, plate, desc in CASES:
                await wait_quiet(ws_cam)
                t0 = time.time()
                await client.get(f"{PLATE_SRV}/set", params={"plate": plate})
                read, attempts, modes, texts = await wait_read(ws_cam, TIMEOUT_S)
                latency = round(time.time() - t0, 1)
                await client.get(f"{PLATE_SRV}/set")
                comp = (read or {}).get("compliance") or {}
                row = {
                    "case": tag,
                    "desc": desc,
                    "intended": plate,
                    "read": (read or {}).get("plate_text"),
                    "exact": bool(read) and read.get("plate_text") == plate,
                    "ocr_conf": (read or {}).get("ocr_confidence"),
                    "ocr_attempts": attempts,
                    "ocr_modes": sorted(modes),
                    "ocr_texts_seen": texts[-5:],
                    "latency_s": latency,
                    "detection_id": (read or {}).get("id"),
                    "outcome": comp.get("enforcement_outcome"),
                    "risk": comp.get("risk_score"),
                    "synthetic_profile": comp.get("is_synthetic"),
                    "staged_profile": comp.get("is_staged"),
                    "owner": (comp.get("owner") or {}).get("name"),
                    "vehicle": " ".join(filter(None, [
                        (comp.get("vehicle") or {}).get("make"),
                        (comp.get("vehicle") or {}).get("model"),
                    ])) or None,
                }
                results.append(row)
                print(f"[{tag}] intended={plate} read={row['read']} exact={row['exact']} "
                      f"conf={row['ocr_conf']} attempts={attempts} modes={row['ocr_modes']} "
                      f"outcome={row['outcome']} synthetic={row['synthetic_profile']} "
                      f"owner={row['owner']} vehicle={row['vehicle']} {latency}s")
                await asyncio.sleep(2.5)

            await asyncio.sleep(4.0)
            stop.set()
            await collector

        # frames after the run
        d2 = (await client.get(f"{API}/cameras/demo/{CAM}/diagnostics", headers=auth)).json()
        print(f"[frames] t2 diagnostics: {json.dumps(d2)[:400]}")

        await client.post(f"{API}/cameras/demo/{CAM}/disconnect", headers=auth)

        # dashboard counters AFTER
        stats_after = (await client.get(f"{API}/detections/stats", headers=auth)).json()
        print(f"[post] detections stats: {json.dumps(stats_after)}")

    await db_check(results)

    # global feed correlation
    gids = {e.get("id") for e in global_events}
    print("\n" + "=" * 100)
    print("  3-CASE AUDIT RESULT")
    print("=" * 100)
    for r in results:
        on_global = r.get("detection_id") in gids if r.get("detection_id") else False
        print(json.dumps({**r, "on_global_dashboard_feed": on_global}, indent=2, default=str))
    print(f"  global dashboard WS 'detection' events captured: {len(global_events)}")

    out = "/app/scripts/audit_3case_results.json"
    with open(out, "w") as f:
        json.dump({"results": results, "global_events": len(global_events),
                   "global_ids": [str(g) for g in gids],
                   "ts": datetime.now().isoformat()}, f, indent=2, default=str)
    print(f"  raw: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
