"""
End-to-end verification for Unknown Vehicle Intelligence Mode.

Drives the REAL production pipeline functions (no mocks) for N random Indian
plates that are confirmed absent from the registry, and reports every stage:

    OCR(sim) -> regex validate -> DB search (miss) -> synthetic dossier
             -> compliance + risk -> enforcement OUTCOME -> persist Detection
             -> Challan decision -> evidence saved -> websocket event
             -> dashboard / analytics counts

Two guarantees are checked:
  1. An unknown-but-valid plate NEVER fails — it always produces a full result.
  2. A challan is issued ONLY for challan-worthy outcomes (registration/insurance
     expired, watchlist hit, or critical risk). Clean unknown vehicles route to
     MANUAL_REVIEW and are NOT auto-fined.

Run inside the backend container:
    docker exec enforcement-backend python -m scripts.verify_unknown_intelligence
"""
from __future__ import annotations

import asyncio
import random
import re
import sys
from collections import Counter

import numpy as np
from sqlalchemy import func, select

from app.ai.detector import BoundingBox, DetectionResult
from app.core.constants import PLATE_PATTERN
from app.db.session import AsyncSessionFactory
from app.models.challan import Challan
from app.models.detection import Detection
from app.models.vehicle import Vehicle
from app.services.compliance_engine import CHALLANABLE_OUTCOMES, assess_compliance
from app.services.demo_pipeline import _persist_detection, _save_evidence, _PipelineStats
from app.websockets.manager import ws_manager

PLATE_RE = re.compile(PLATE_PATTERN)
N_PLATES = 20
CAMERA_ID_STR = "demo-primary"

_STATES = ["MH", "DL", "KA", "TN", "GJ", "UP", "WB", "HR", "RJ", "TG", "KL", "PB", "MP", "AP"]
_SERIES = "ABCDEFGHJKLMNPQRSTUVWXYZ"


def _random_standard_plate(rng: random.Random) -> str:
    st = rng.choice(_STATES)
    district = f"{rng.randint(1, 35):02d}"
    series = "".join(rng.choice(_SERIES) for _ in range(rng.choice([1, 2])))
    number = f"{rng.randint(1, 9999):04d}"
    return f"{st}{district}{series}{number}"


def _random_bh_plate(rng: random.Random) -> str:
    yy = rng.choice(["21", "22", "23", "24"])
    num = f"{rng.randint(1000, 9999)}"
    series = "".join(rng.choice(_SERIES) for _ in range(2))
    return f"{yy}BH{num}{series}"


async def _plate_in_db(session, plate: str) -> bool:
    row = await session.execute(select(Vehicle.id).where(Vehicle.plate_number == plate))
    return row.scalar_one_or_none() is not None


async def _generate_absent_plates(n: int, rng: random.Random) -> list[str]:
    plates: list[str] = []
    async with AsyncSessionFactory() as session:
        attempts = 0
        while len(plates) < n and attempts < n * 50:
            attempts += 1
            p = _random_bh_plate(rng) if rng.random() < 0.15 else _random_standard_plate(rng)
            if not PLATE_RE.match(p) or p in plates:
                continue
            if await _plate_in_db(session, p):
                continue
            plates.append(p)
    return plates


async def _challan_for(session, detection_id) -> Challan | None:
    row = await session.execute(select(Challan).where(Challan.detection_id == detection_id))
    return row.scalar_one_or_none()


def _synthetic_detection(frame_w: int, frame_h: int) -> DetectionResult:
    bbox = BoundingBox(x1=int(frame_w * 0.25), y1=int(frame_h * 0.30),
                       x2=int(frame_w * 0.75), y2=int(frame_h * 0.85))
    plate_bbox = BoundingBox(x1=int(frame_w * 0.38), y1=int(frame_h * 0.62),
                             x2=int(frame_w * 0.62), y2=int(frame_h * 0.74))
    return DetectionResult(
        bbox=bbox, confidence=0.93, class_id=2, class_name="car",
        plate_bbox=plate_bbox, plate_confidence=0.88,
        frame_width=frame_w, frame_height=frame_h,
    )


async def main() -> int:
    rng = random.Random()  # genuinely random plates each run
    frame_w, frame_h = 640, 480

    async with AsyncSessionFactory() as s:
        det_before = (await s.execute(select(func.count()).select_from(Detection))).scalar_one()
        chn_before = (await s.execute(select(func.count()).select_from(Challan))).scalar_one()

    plates = await _generate_absent_plates(N_PLATES, rng)
    print(f"\nGenerated {len(plates)} valid Indian plates confirmed ABSENT from registry.\n")
    print("=" * 112)

    successes = 0
    challans_issued = 0
    outcome_counts: Counter[str] = Counter()
    consistency_errors: list[str] = []
    failures: list[tuple[str, str]] = []

    for i, plate in enumerate(plates, 1):
        try:
            ocr_conf = round(rng.uniform(0.82, 0.98), 3)  # 1) OCR read confidence

            if not PLATE_RE.match(plate):           # 2) Indian plate regex
                raise AssertionError("plate failed Indian regex")

            # 3+4+5) DB miss -> synthetic intelligence
            report = await assess_compliance(plate)
            assert report.is_synthetic is True, "expected synthetic profile for unknown plate"
            outcome = report.enforcement_outcome
            outcome_counts[outcome] += 1

            dominant = _synthetic_detection(frame_w, frame_h)
            detection_id = await _persist_detection(
                camera_id_str=CAMERA_ID_STR, frame_w=frame_w, frame_h=frame_h,
                dominant=dominant, plate=plate, ocr_conf=ocr_conf,
                plate_conf=dominant.plate_confidence, compliance=report, processing_ms=150,
            )
            assert detection_id is not None, "persist returned no detection id"

            # evidence: real evidence-store offload + DB path update + ws event
            await _save_evidence(
                camera_id=CAMERA_ID_STR, detection_id=str(detection_id),
                frame=np.full((frame_h, frame_w, 3), 38, dtype=np.uint8),
                plate_crop=np.full((72, 220, 3), 232, dtype=np.uint8),
                plate_text=plate, detections=[dominant], stats=_PipelineStats(),
            )

            # websocket: dispatch the global detection event (real manager call)
            await ws_manager.broadcast_to_room("global:detections", {
                "type": "detection", "id": str(detection_id), "plate": plate,
                "enforcement_outcome": outcome, "is_synthetic": True,
            })
            ws_clients = ws_manager.get_room_count("global:detections")

            async with AsyncSessionFactory() as s:
                det = await s.get(Detection, detection_id)
                challan = await _challan_for(s, detection_id)
            evidence_ok = bool(det and (det.frame_path or det.plate_crop_path))

            # consistency: challan exists IFF outcome is challan-worthy
            should_challan = outcome in CHALLANABLE_OUTCOMES
            if bool(challan) != should_challan:
                consistency_errors.append(
                    f"{plate}: outcome={outcome} but challan={'present' if challan else 'absent'}"
                )
            if challan:
                challans_issued += 1

            successes += 1
            decision = (
                f"ISSUED {challan.challan_number} (Rs {int(challan.fine_amount)}) -> {challan.owner_name}"
                if challan else f"no challan ({outcome})"
            )
            print(
                f"[{i:02d}/{len(plates)}] {plate:<12} OK  outcome={outcome}\n"
                f"     OCR        : '{plate}' @ {ocr_conf}  regex PASS\n"
                f"     Profile    : {report.owner.name} · {report.vehicle_make} {report.vehicle_model} "
                f"({report.vehicle_color}, {report.vehicle_year}) · {report.owner.city}, {report.owner.state}  [SYNTHETIC]\n"
                f"     Compliance : reg={report.registration.status} ins={report.insurance.status} "
                f"puc={report.puc.status} watchlist={report.blacklist.status} | risk={report.risk_score} band={report.risk_band}\n"
                f"     Decision   : {report.enforcement_outcome} — {report.enforcement_reason}\n"
                f"     Challan    : {decision}\n"
                f"     Evidence   : {'YES' if evidence_ok else 'no'}  frame={det.frame_path}\n"
                f"     WS event   : detection -> global:detections ({ws_clients} client(s))  evidence_saved -> demo:{CAMERA_ID_STR}\n"
            )
        except Exception as exc:  # noqa: BLE001 — surface ANY failure
            failures.append((plate, repr(exc)))
            print(f"[{i:02d}/{len(plates)}] {plate:<12} FAIL -> {exc!r}\n")

    async with AsyncSessionFactory() as s:
        det_after = (await s.execute(select(func.count()).select_from(Detection))).scalar_one()
        chn_after = (await s.execute(select(func.count()).select_from(Challan))).scalar_one()

    print("=" * 112)
    print("SUMMARY")
    print(f"  plates tested            : {len(plates)}")
    print(f"  succeeded (never failed) : {successes}/{len(plates)}")
    print(f"  enforcement outcomes     : " + ", ".join(f"{k}={v}" for k, v in sorted(outcome_counts.items())))
    print(f"  challans auto-issued     : {challans_issued} (only for {', '.join(CHALLANABLE_OUTCOMES)})")
    print(f"  detections  {det_before} -> {det_after}  (+{det_after - det_before})  [dashboard/analytics feed]")
    print(f"  challans    {chn_before} -> {chn_after}  (+{chn_after - chn_before})")
    if consistency_errors:
        print("\n  CONSISTENCY ERRORS (challan/outcome mismatch):")
        for e in consistency_errors:
            print(f"    {e}")
    if failures:
        print("\n  FAILURES:")
        for p, e in failures:
            print(f"    {p}: {e}")
    print("=" * 112)

    ok = (
        successes == len(plates) == N_PLATES
        and not failures
        and not consistency_errors
    )
    print(
        "\nRESULT:",
        "PASS — every unknown plate produced a full result, and challans were issued only when justified."
        if ok else "FAIL",
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
