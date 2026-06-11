#!/usr/bin/env python3
"""
20-plate live certification — drives the RUNNING backend end-to-end.

For each test plate this harness:
  1. Displays the plate on the cert MJPEG server (cert_plate_server.py).
  2. Waits for the live demo pipeline to detect → OCR → validate → run
     compliance → persist → broadcast, exactly as it would for a phone
     camera pointed at a printed plate. NOTHING is injected downstream;
     the only synthetic element is the image source.
  3. Records the WS `plate_read` payload from the per-camera channel AND
     the mirrored event on the global dashboard feed (/ws/detections).
  4. Afterwards verifies in PostgreSQL: Detection row, evidence files on
     disk, and Challan row when the outcome demanded one.

Run inside the backend container:
  docker exec enforcement-backend python /app/scripts/certify_20_plates.py
"""
import asyncio
import json
import os
import random
import string
import sys
import time
from datetime import datetime

import httpx
import websockets

API = "http://127.0.0.1:8000/api/v1"
WS_BASE = "ws://127.0.0.1:8000/api/v1"
PLATE_SRV = "http://127.0.0.1:8089"
CAM = "cert-cam"
EMAIL = "admin@enforcement.gov"
PASSWORD = "Admin@1234"
PER_PLATE_TIMEOUT_S = 40
BLANK_GAP_S = 2.5

STATES = ["MH", "DL", "KA", "TN", "GJ", "UP", "WB", "HR", "RJ", "TG",
          "AP", "KL", "PB", "MP", "BR", "OD", "JK", "AS", "CH", "GA"]
SERIES_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"  # real plates avoid I and O

STAGED = {"MH12AB1234", "TN09GH6745", "MH14XY0099"}


def _lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def random_plates(n: int, rng: random.Random) -> list[str]:
    """n random plates: mostly standard format, one BH-series, plus the two
    printed staged demo plates so the scripted path is certified too."""
    plates: list[str] = ["MH12AB1234", "TN09GH6745"]  # staged: CLEAR + CHALLAN
    plates.append(f"{rng.randint(21, 24)}BH{rng.randint(1000, 9999)}"
                  f"{rng.choice(SERIES_LETTERS)}{rng.choice(SERIES_LETTERS)}")
    while len(plates) < n:
        p = (rng.choice(STATES)
             + f"{rng.randint(1, 29):02d}"
             + "".join(rng.choice(SERIES_LETTERS) for _ in range(2))
             + f"{rng.randint(1, 9999):04d}")
        # keep random plates clear of the staged registry's fuzzy matcher
        if p in plates or any(_lev(p, s) <= 3 for s in STAGED):
            continue
        plates.append(p)
    return plates


async def wait_for_quiet(ws, quiet_s: float = 3.5, max_s: float = 20.0):
    """Consume events until the pipeline has produced no plate read / OCR text
    for `quiet_s` seconds. A handheld OCR pass takes ~3s end-to-end, so a read
    of the PREVIOUS plate can land well after the image was blanked — without
    this settling window it gets misattributed to the next test plate."""
    deadline = time.time() + max_s
    last_activity = time.time()
    while time.time() < deadline:
        if time.time() - last_activity >= quiet_s:
            return
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=0.3)
        except (asyncio.TimeoutError, TimeoutError):
            continue
        try:
            msg = json.loads(raw)
        except Exception:
            continue
        mtype = msg.get("type")
        if mtype == "stream_frame" and msg.get("plate_read"):
            last_activity = time.time()
        elif mtype == "ocr_attempt" and msg.get("text"):
            last_activity = time.time()


async def wait_for_read(ws, timeout_s: float) -> tuple[dict | None, int]:
    """Wait for the first stream_frame carrying a plate_read. Returns
    (plate_read_payload, ocr_attempts_observed)."""
    attempts = 0
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
        mtype = msg.get("type")
        if mtype == "ocr_attempt":
            attempts += 1
        elif mtype == "stream_frame" and msg.get("plate_read"):
            pr = msg["plate_read"]
            if pr.get("is_duplicate"):
                continue  # stale repeat of an earlier plate — not this test's read
            return pr, attempts
    return None, attempts


async def collect_global(ws_global, sink: list, stop: asyncio.Event):
    """Background task: collect every event the dashboard feed receives."""
    while not stop.is_set():
        try:
            raw = await asyncio.wait_for(ws_global.recv(), timeout=0.5)
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


async def verify_db(results: list[dict]) -> None:
    """Check Detection rows, evidence files, and Challans for every read."""
    sys.path.insert(0, "/app")
    from sqlalchemy import select
    from app.core.config import settings
    from app.db.session import AsyncSessionFactory
    from app.models.detection import Detection
    from app.models.challan import Challan
    import uuid as _uuid

    async with AsyncSessionFactory() as session:
        for r in results:
            det_id = r.get("detection_id")
            if not det_id:
                continue
            det = await session.get(Detection, _uuid.UUID(det_id))
            if det is None:
                r["db_detection"] = False
                continue
            r["db_detection"] = True
            r["db_is_violation"] = det.is_violation
            r["db_violation_type"] = det.violation_type
            fp = det.frame_path
            cp = det.plate_crop_path
            r["evidence_frame"] = bool(fp) and os.path.exists(os.path.join(settings.UPLOAD_DIR, fp))
            r["evidence_crop"] = bool(cp) and os.path.exists(os.path.join(settings.UPLOAD_DIR, cp))
            ch = (await session.execute(
                select(Challan).where(Challan.detection_id == det.id)
            )).scalar_one_or_none()
            r["challan_number"] = ch.challan_number if ch else None
            r["challan_fine"] = float(ch.fine_amount) if ch else None
            r["challan_owner"] = ch.owner_name if ch else None


async def main() -> int:
    rng = random.Random()  # fresh randomness each run — these are random tests
    plates = random_plates(20, rng)

    async with httpx.AsyncClient(timeout=20) as client:
        # ── preflight ────────────────────────────────────────────
        r = await client.post(f"{API}/auth/login", json={"email": EMAIL, "password": PASSWORD})
        r.raise_for_status()
        token = r.json()["access_token"]
        auth = {"Authorization": f"Bearer {token}"}

        r = await client.get(f"{PLATE_SRV}/health")
        r.raise_for_status()
        await client.get(f"{PLATE_SRV}/set")  # blank

        r = await client.post(
            f"{API}/cameras/demo/{CAM}/connect",
            json={"source_url": f"{PLATE_SRV}/video"},
            headers=auth,
        )
        if r.status_code not in (200, 202):
            print(f"FATAL: demo connect failed: {r.status_code} {r.text}")
            return 1
        print(f"[{datetime.now():%H:%M:%S}] pipeline connected: {r.json()}")

        results: list[dict] = []
        global_events: list[dict] = []
        stop = asyncio.Event()

        async with websockets.connect(
            f"{WS_BASE}/cameras/demo/{CAM}/stream?token={token}", max_size=2**22
        ) as ws_cam, websockets.connect(
            f"{WS_BASE}/ws/detections?token={token}", max_size=2**22
        ) as ws_global:
            collector = asyncio.create_task(collect_global(ws_global, global_events, stop))
            await asyncio.sleep(2.0)  # let the pipeline warm up on blank frames

            for i, plate in enumerate(plates, 1):
                await wait_for_quiet(ws_cam)
                t0 = time.time()
                await client.get(f"{PLATE_SRV}/set", params={"plate": plate})
                read, attempts = await wait_for_read(ws_cam, PER_PLATE_TIMEOUT_S)
                latency = time.time() - t0
                await client.get(f"{PLATE_SRV}/set")  # blank between plates
                comp = (read or {}).get("compliance") or {}
                row = {
                    "n": i,
                    "intended": plate,
                    "read": (read or {}).get("plate_text"),
                    "exact": bool(read) and read.get("plate_text") == plate,
                    "ocr_conf": (read or {}).get("ocr_confidence"),
                    "ocr_attempts": attempts,
                    "latency_s": round(latency, 1),
                    "detection_id": (read or {}).get("id"),
                    "is_duplicate": (read or {}).get("is_duplicate"),
                    "outcome": comp.get("enforcement_outcome"),
                    "risk": comp.get("risk_score"),
                    "synthetic": comp.get("is_synthetic"),
                    "staged": comp.get("is_staged"),
                    "owner": (comp.get("owner") or {}).get("name"),
                    "vehicle": " ".join(filter(None, [
                        (comp.get("vehicle") or {}).get("make"),
                        (comp.get("vehicle") or {}).get("model"),
                    ])) or None,
                }
                results.append(row)
                status = "OK " if row["exact"] else ("READ" if row["read"] else "MISS")
                print(f"[{i:02d}/20] {status} {plate} -> {row['read']} "
                      f"conf={row['ocr_conf']} outcome={row['outcome']} risk={row['risk']} "
                      f"synth={row['synthetic']} owner={row['owner']} {row['latency_s']}s")
                await asyncio.sleep(BLANK_GAP_S)

            # allow async evidence writes + global mirrors to settle
            await asyncio.sleep(4.0)
            stop.set()
            await collector

        await client.post(f"{API}/cameras/demo/{CAM}/disconnect", headers=auth)

    await verify_db(results)

    # ── report ───────────────────────────────────────────────────
    global_ids = {e.get("id") for e in global_events}
    print("\n" + "=" * 110)
    print("  20-PLATE LIVE CERTIFICATION — full pipeline (MJPEG → YOLO → OCR → compliance → DB → evidence → WS)")
    print("=" * 110)
    hdr = (f"{'#':<3}{'INTENDED':<14}{'READ':<14}{'CONF':<6}{'OUTCOME':<16}{'RISK':<5}"
           f"{'PROFILE':<10}{'DB':<4}{'EVID':<6}{'CHALLAN':<18}{'GLOBAL_WS':<9}")
    print(hdr)
    print("-" * 110)
    n_read = n_exact = n_db = n_evid = n_global = 0
    for r in results:
        profile = "staged" if r.get("staged") else ("synthetic" if r.get("synthetic") else "registry")
        on_global = r.get("detection_id") in global_ids if r.get("detection_id") else False
        db_ok = bool(r.get("db_detection"))
        ev_ok = bool(r.get("evidence_frame"))
        n_read += bool(r["read"]); n_exact += bool(r["exact"])
        n_db += db_ok; n_evid += ev_ok; n_global += on_global
        print(f"{r['n']:<3}{r['intended']:<14}{str(r['read']):<14}"
              f"{str(r['ocr_conf']):<6}{str(r['outcome']):<16}{str(r['risk']):<5}"
              f"{profile:<10}{'Y' if db_ok else '-':<4}"
              f"{('F+C' if r.get('evidence_crop') else 'F') if ev_ok else '-':<6}"
              f"{str(r.get('challan_number') or '-'):<18}{'Y' if on_global else '-':<9}")
    print("-" * 110)
    print(f"  reads: {n_read}/20   exact OCR: {n_exact}/20   persisted: {n_db}/20   "
          f"evidence: {n_evid}/20   on dashboard feed: {n_global}/20")
    print(f"  global WS detection events observed: {len(global_events)}")
    print("=" * 110)

    out = "/app/scripts/cert_results.json"
    with open(out, "w") as f:
        json.dump({"results": results, "global_events": len(global_events),
                   "ts": datetime.now().isoformat()}, f, indent=2, default=str)
    print(f"  raw results: {out}")
    return 0 if n_read == 20 and n_db >= 18 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
