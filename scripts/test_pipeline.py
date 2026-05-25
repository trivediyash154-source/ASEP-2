#!/usr/bin/env python3
"""
Static image pipeline test — runs the full detection → OCR → expiry check chain
on a still image without requiring a live RTSP stream or running Docker services.

Usage:
  python scripts/test_pipeline.py path/to/frame.jpg
  python scripts/test_pipeline.py path/to/frame.jpg --plate MH12AB1234  # skip OCR, use known plate
  python scripts/test_pipeline.py path/to/frame.jpg --save-evidence

Requirements:
  - PostgreSQL running with seeded data (run seed_db.py first)
  - pip install ultralytics easyocr opencv-python-headless
"""

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

os.environ.setdefault("SECRET_KEY", "test-secret-key-minimum-32-characters-here!")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-key-minimum-32-characters-here!!!!!")
os.environ.setdefault("POSTGRES_HOST", os.getenv("POSTGRES_HOST", "localhost"))
os.environ.setdefault("POSTGRES_DB", os.getenv("POSTGRES_DB", "enforcement_db"))
os.environ.setdefault("POSTGRES_USER", os.getenv("POSTGRES_USER", "enforcement_user"))
os.environ.setdefault("POSTGRES_PASSWORD", os.getenv("POSTGRES_PASSWORD", "strong-password-here"))
os.environ.setdefault("REDIS_HOST", "localhost")
os.environ.setdefault("REDIS_PASSWORD", "")
os.environ.setdefault("GPU_ENABLED", "false")
os.environ.setdefault("OCR_ENGINE", "easyocr")
os.environ.setdefault("UPLOAD_DIR", "/tmp/enforcement_test_evidence")
os.environ.setdefault("YOLO_CONFIDENCE_THRESHOLD", "0.45")
os.environ.setdefault("YOLO_IOU_THRESHOLD", "0.45")


async def run_test(image_path: Path, known_plate: str = None, save_evidence: bool = True):
    import cv2
    from app.ai.detector import vehicle_detector
    from app.ai.ocr import plate_ocr
    from app.ai.preprocessor import preprocess_frame, preprocess_plate_crop, extract_plate_region
    from app.ai.evidence_store import save_frame_async, save_plate_crop_async
    from app.core.constants import CONFIDENCE_THRESHOLDS
    from app.repositories.vehicle_repo import VehicleRepository
    from app.services.expiry_checker import check_vehicle_expiry, check_unknown_vehicle
    from app.db.session import get_db_context

    print(f"\n{'='*65}")
    print(f"  PIPELINE TEST — AI Enforcement Platform")
    print(f"{'='*65}")
    print(f"  Image:  {image_path}")
    print(f"  Plate:  {known_plate or 'auto-detect via OCR'}")
    print(f"{'='*65}\n")

    frame = cv2.imread(str(image_path))
    if frame is None:
        print(f"[ERROR] Cannot read image: {image_path}")
        return

    print(f"[1/7] Image loaded — {frame.shape[1]}x{frame.shape[0]}px\n")

    # ── Stage 1: Preprocess ───────────────────────────────────────
    print("[2/7] Preprocessing frame...")
    t0 = time.perf_counter()
    preprocessed = preprocess_frame(frame)
    print(f"      Done ({(time.perf_counter()-t0)*1000:.0f}ms)")

    # ── Stage 2: Vehicle + Plate Detection ───────────────────────
    print("\n[3/7] Loading YOLO detector...")
    try:
        vehicle_detector.load()
        print("      ✓ Detector ready")
    except RuntimeError as e:
        print(f"      ✗ {e}")
        return

    print("      Running detection...")
    t0 = time.perf_counter()
    detections = vehicle_detector.detect(preprocessed)
    det_ms = (time.perf_counter()-t0)*1000
    print(f"      Found {len(detections)} vehicle(s) in {det_ms:.0f}ms")

    for i, d in enumerate(detections):
        conf_str = f"conf={d.confidence:.3f}"
        plate_str = f"plate_conf={d.plate_confidence:.3f}" if d.plate_bbox else "no plate"
        print(f"      Vehicle {i+1}: {d.class_name} | {conf_str} | {plate_str}")

    # ── Stage 3: OCR ─────────────────────────────────────────────
    plate_text = known_plate
    ocr_result = None

    if not plate_text:
        print("\n[4/7] Loading OCR engine...")
        try:
            plate_ocr.load()
            print(f"      ✓ {plate_ocr.engines_loaded}")
        except RuntimeError as e:
            print(f"      ✗ {e}")
            print("      Using known_plate override not provided — cannot continue without OCR")
            return

        for det in detections:
            if det.plate_bbox and det.plate_confidence >= CONFIDENCE_THRESHOLDS["plate_detection"]:
                crop = extract_plate_region(frame, det.plate_bbox.as_tuple)
                if crop.size > 0:
                    proc_crop = preprocess_plate_crop(crop)
                    print("      Running OCR...")
                    t0 = time.perf_counter()
                    ocr_result = plate_ocr.read_plate(proc_crop)
                    ocr_ms = (time.perf_counter()-t0)*1000
                    print(f"      Text:       '{ocr_result.text}'")
                    print(f"      Confidence: {ocr_result.confidence:.3f} ({ocr_ms:.0f}ms)")
                    print(f"      Quality:    {ocr_result.quality_score:.3f}")
                    print(f"      Engine:     {ocr_result.engine_used}")
                    print(f"      Valid fmt:  {ocr_result.is_valid_format}")
                    print(f"      Reliable:   {ocr_result.is_reliable}")
                    if ocr_result.candidates:
                        print(f"      All reads:  {[c.normalized for c in ocr_result.candidates[:4]]}")
                    if ocr_result.is_reliable:
                        plate_text = ocr_result.text
                    break
        if not plate_text:
            print("      No reliable plate read")
    else:
        print(f"\n[4/7] OCR — using provided plate: {plate_text}")

    # ── Stage 4: Evidence save ────────────────────────────────────
    print(f"\n[5/7] {'Saving evidence' if save_evidence else 'Skipping evidence save'}...")
    frame_path = plate_path = None
    if save_evidence:
        import uuid
        det_id = str(uuid.uuid4())
        frame_path = await save_frame_async(frame, "TEST_CAMERA", det_id, detections if detections else [])
        if plate_text:
            for det in detections:
                if det.plate_bbox:
                    crop = extract_plate_region(frame, det.plate_bbox.as_tuple)
                    plate_path = await save_plate_crop_async(crop, "TEST_CAMERA", det_id, plate_text)
                    break
        print(f"      Frame: {frame_path}")
        print(f"      Plate: {plate_path}")

    # ── Stage 5: Vehicle lookup + Expiry check ────────────────────
    print(f"\n[6/7] Vehicle lookup {'(plate: ' + plate_text + ')' if plate_text else '(no plate)'}...")
    violation_report = None

    if plate_text:
        try:
            async with get_db_context() as db:
                repo = VehicleRepository(db)
                vehicle = await repo.get_by_plate(plate_text)

                if vehicle is None:
                    candidates = await repo.fuzzy_lookup(plate_text, max_results=3)
                    if candidates:
                        print(f"      Exact match not found, fuzzy candidates: {[v.plate_number for v in candidates]}")
                        vehicle = candidates[0]
                    else:
                        print(f"      Plate '{plate_text}' not in registry")

                if vehicle:
                    print(f"      ✓ Found: {vehicle.plate_number} ({vehicle.make} {vehicle.model_name})")
                    violation_report = check_vehicle_expiry(vehicle)
                else:
                    violation_report = check_unknown_vehicle(plate_text)

        except Exception as e:
            print(f"      DB lookup failed: {e}")
            print("      Hint: Is PostgreSQL running? Run seed_db.py first")

    # ── Stage 6: Results ──────────────────────────────────────────
    print(f"\n[7/7] RESULTS")
    print(f"{'='*65}")

    if violation_report:
        print(f"  Plate:          {violation_report.plate_number}")
        print(f"  Blacklisted:    {violation_report.is_blacklisted}")
        print(f"  Has violation:  {violation_report.has_violations}")
        print(f"  Total fine:     ₹{violation_report.total_fine:,.0f}")

        if violation_report.violations:
            print(f"\n  VIOLATIONS ({len(violation_report.violations)}):")
            for v in violation_report.violations:
                print(f"    ⚠  {v.violation_type}")
                print(f"       {v.description}")
                print(f"       Fine: ₹{v.fine_amount:,.0f} | Overdue: {v.days_overdue} days")

        if violation_report.warnings:
            print(f"\n  WARNINGS ({len(violation_report.warnings)}):")
            for w in violation_report.warnings:
                print(f"    ℹ  {w}")

        if violation_report.has_violations:
            print(f"\n  → CHALLAN WOULD BE ISSUED")
            print(f"    Violation: {violation_report.primary_violation.violation_type}")
            print(f"    Fine:      ₹{violation_report.total_fine:,.0f}")
        else:
            print(f"\n  ✓ NO VIOLATIONS — vehicle is compliant")
    else:
        print("  Vehicle lookup did not run (no reliable plate read)")

    print(f"\n  Evidence directory: {os.environ['UPLOAD_DIR']}")
    print(f"{'='*65}\n")


def main():
    parser = argparse.ArgumentParser(description="Test AI pipeline on a static image")
    parser.add_argument("image", nargs="?", default=None, help="Path to test image")
    parser.add_argument("--plate", help="Skip OCR and use this plate number directly")
    parser.add_argument("--save-evidence", action="store_true", default=True)
    args = parser.parse_args()

    if not args.image and not args.plate:
        print("[INFO] No image provided — running with synthetic test data")
        # Create a synthetic image for basic testing
        import numpy as np
        import cv2
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(img, "TEST FRAME", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 2, (255,255,255), 3)
        test_path = Path("/tmp/test_frame.jpg")
        cv2.imwrite(str(test_path), img)
        asyncio.run(run_test(test_path, known_plate=args.plate or "MH12AB1234"))
    else:
        img_path = Path(args.image) if args.image else Path("/tmp/test_frame.jpg")
        asyncio.run(run_test(img_path, known_plate=args.plate, save_evidence=args.save_evidence))


if __name__ == "__main__":
    main()
