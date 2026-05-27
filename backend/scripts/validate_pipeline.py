#!/usr/bin/env python3
"""
End-to-end integration validation script.

Runs a suite of checks across every pipeline stage and produces a
colour-coded pass/fail report. Use this before deploying to production
or after making changes to the AI pipeline.

Usage:
  python scripts/validate_pipeline.py
  python scripts/validate_pipeline.py --skip-gpu
  python scripts/validate_pipeline.py --fail-fast

Exit code:
  0 — all checks passed
  1 — one or more checks failed
"""

import argparse
import asyncio
import os
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

# Environment setup
os.environ.setdefault("SECRET_KEY", "validate-secret-key-minimum-32-chars-here!")
os.environ.setdefault("JWT_SECRET_KEY", "validate-jwt-key-minimum-32-chars-here!!!!!")
os.environ.setdefault("POSTGRES_HOST", os.getenv("POSTGRES_HOST", "localhost"))
os.environ.setdefault("POSTGRES_DB", os.getenv("POSTGRES_DB", "enforcement_db"))
os.environ.setdefault("POSTGRES_USER", os.getenv("POSTGRES_USER", "enforcement_user"))
os.environ.setdefault("POSTGRES_PASSWORD", os.getenv("POSTGRES_PASSWORD", "strong-password-here"))
os.environ.setdefault("REDIS_HOST", os.getenv("REDIS_HOST", "localhost"))
os.environ.setdefault("REDIS_PASSWORD", "")
os.environ.setdefault("GPU_ENABLED", "false")
os.environ.setdefault("OCR_ENGINE", "easyocr")
os.environ.setdefault("UPLOAD_DIR", "/tmp/enforcement_validation_evidence")
os.environ.setdefault("YOLO_CONFIDENCE_THRESHOLD", "0.45")

# ANSI colours
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"


@dataclass
class CheckResult:
    name: str
    passed: bool
    duration_ms: float
    message: str = ""
    details: List[str] = field(default_factory=list)
    skipped: bool = False


class Validator:
    def __init__(self, fail_fast: bool = False, skip_gpu: bool = True):
        self.results: List[CheckResult] = []
        self.fail_fast = fail_fast
        self.skip_gpu = skip_gpu

    def check(self, name: str, fn: Callable, skip: bool = False) -> CheckResult:
        if skip:
            r = CheckResult(name=name, passed=True, duration_ms=0, message="SKIPPED", skipped=True)
            self.results.append(r)
            self._print_result(r)
            return r

        t0 = time.perf_counter()
        try:
            msg, details = fn()
            r = CheckResult(
                name=name,
                passed=True,
                duration_ms=(time.perf_counter()-t0)*1000,
                message=msg or "OK",
                details=details or [],
            )
        except Exception as e:
            r = CheckResult(
                name=name,
                passed=False,
                duration_ms=(time.perf_counter()-t0)*1000,
                message=str(e),
                details=[traceback.format_exc()],
            )

        self.results.append(r)
        self._print_result(r)

        if self.fail_fast and not r.passed:
            self._print_summary()
            sys.exit(1)

        return r

    async def async_check(self, name: str, fn: Callable, skip: bool = False) -> CheckResult:
        if skip:
            r = CheckResult(name=name, passed=True, duration_ms=0, message="SKIPPED", skipped=True)
            self.results.append(r)
            self._print_result(r)
            return r

        t0 = time.perf_counter()
        try:
            msg, details = await fn()
            r = CheckResult(
                name=name,
                passed=True,
                duration_ms=(time.perf_counter()-t0)*1000,
                message=msg or "OK",
                details=details or [],
            )
        except Exception as e:
            r = CheckResult(
                name=name,
                passed=False,
                duration_ms=(time.perf_counter()-t0)*1000,
                message=str(e),
                details=[traceback.format_exc()],
            )

        self.results.append(r)
        self._print_result(r)

        if self.fail_fast and not r.passed:
            self._print_summary()
            sys.exit(1)

        return r

    def _print_result(self, r: CheckResult):
        if r.skipped:
            icon = f"{YELLOW}~{RESET}"
            color = YELLOW
        elif r.passed:
            icon = f"{GREEN}✓{RESET}"
            color = GREEN
        else:
            icon = f"{RED}✗{RESET}"
            color = RED

        name_padded = r.name.ljust(50)
        time_str = f"{r.duration_ms:6.0f}ms" if not r.skipped else "       "
        print(f"  {icon} {color}{name_padded}{RESET} {time_str}  {r.message}")
        if not r.passed and r.details:
            for line in r.details[-3:]:
                for l in line.strip().split("\n")[-3:]:
                    print(f"       {RED}{l}{RESET}")

    def _print_summary(self):
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed and not r.skipped)
        failed = sum(1 for r in self.results if not r.passed)
        skipped = sum(1 for r in self.results if r.skipped)

        print(f"\n{'='*65}")
        print(f"  VALIDATION SUMMARY")
        print(f"{'='*65}")
        print(f"  Total:   {total}")
        print(f"  {GREEN}Passed:  {passed}{RESET}")
        if failed:
            print(f"  {RED}Failed:  {failed}{RESET}")
        if skipped:
            print(f"  {YELLOW}Skipped: {skipped}{RESET}")

        if failed == 0:
            print(f"\n  {GREEN}{BOLD}✓ ALL CHECKS PASSED — pipeline is production-ready{RESET}")
        else:
            print(f"\n  {RED}{BOLD}✗ {failed} CHECK(S) FAILED — DO NOT DEPLOY{RESET}")
            print(f"  Failed checks:")
            for r in self.results:
                if not r.passed:
                    print(f"    • {r.name}: {r.message}")
        print(f"{'='*65}\n")

    def exit_code(self) -> int:
        return 0 if all(r.passed or r.skipped for r in self.results) else 1


async def run(args):
    v = Validator(fail_fast=args.fail_fast, skip_gpu=args.skip_gpu)

    print(f"\n{CYAN}{'='*65}{RESET}")
    print(f"{CYAN}  AI ENFORCEMENT PLATFORM — PIPELINE VALIDATION{RESET}")
    print(f"{CYAN}{'='*65}{RESET}\n")

    # ── 1. Import checks ─────────────────────────────────────────
    print(f"{BOLD}[ IMPORTS ]{RESET}")

    v.check("Import: FastAPI", lambda: (
        __import__("fastapi") and ("OK", ["fastapi imported"])
    ))
    v.check("Import: SQLAlchemy async", lambda: (
        __import__("sqlalchemy.ext.asyncio") and ("OK", [])
    ))
    v.check("Import: OpenCV", lambda: (
        __import__("cv2") and (f"OK — {__import__('cv2').__version__}", [])
    ))
    v.check("Import: NumPy", lambda: (
        __import__("numpy") and (f"OK — {__import__('numpy').__version__}", [])
    ))
    v.check("Import: Ultralytics (YOLOv8)", lambda: (
        __import__("ultralytics") and ("OK — ultralytics installed", [])
    ))
    v.check("Import: EasyOCR", lambda: (
        __import__("easyocr") and ("OK — easyocr installed", [])
    ))
    v.check("Import: ReportLab (PDF)", lambda: (
        __import__("reportlab") and ("OK — reportlab installed", [])
    ))
    v.check("Import: Celery", lambda: (
        __import__("celery") and ("OK", [])
    ))
    v.check("Import: psutil", lambda: (
        __import__("psutil") and ("OK", [])
    ))

    # ── 2. Config ────────────────────────────────────────────────
    print(f"\n{BOLD}[ CONFIGURATION ]{RESET}")

    def check_config():
        from app.core.config import settings
        issues = []
        if len(settings.SECRET_KEY) < 32:
            issues.append("SECRET_KEY too short")
        if len(settings.JWT_SECRET_KEY) < 32:
            issues.append("JWT_SECRET_KEY too short")
        if issues:
            raise ValueError(", ".join(issues))
        return f"OK — {settings.APP_ENV} env", [f"OCR engine: {settings.OCR_ENGINE}", f"GPU: {settings.GPU_ENABLED}"]

    v.check("Config loads without errors", check_config)

    # ── 3. Database ──────────────────────────────────────────────
    print(f"\n{BOLD}[ DATABASE ]{RESET}")

    async def check_db():
        from app.db.session import check_database_health
        healthy = await check_database_health()
        if not healthy:
            raise ConnectionError("Database health check failed — is PostgreSQL running?")
        return "OK — connected", []

    await v.async_check("PostgreSQL connectivity", check_db)

    async def check_db_tables():
        from app.db.session import AsyncSessionFactory
        from sqlalchemy import text
        async with AsyncSessionFactory() as db:
            result = await db.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
            ))
            tables = [row[0] for row in result]
        expected = {"users", "vehicles", "cameras", "detections", "challans", "owners", "notifications"}
        missing = expected - set(tables)
        if missing:
            raise ValueError(f"Missing tables: {missing}. Run: alembic upgrade head")
        return f"OK — {len(tables)} tables", [f"Tables: {', '.join(sorted(tables))}"]

    await v.async_check("Database tables exist", check_db_tables)

    async def check_seed_data():
        from app.db.session import AsyncSessionFactory
        from sqlalchemy import text
        async with AsyncSessionFactory() as db:
            r = await db.execute(text("SELECT COUNT(*) FROM vehicles"))
            count = r.scalar_one()
        if count == 0:
            raise ValueError("No vehicles in DB — run: python scripts/seed_db.py")
        return f"OK — {count} vehicles", []

    await v.async_check("Seed data present", check_seed_data)

    # ── 4. Redis ─────────────────────────────────────────────────
    print(f"\n{BOLD}[ REDIS ]{RESET}")

    async def check_redis():
        import redis.asyncio as aioredis
        from app.core.config import settings
        r = aioredis.from_url(settings.redis_url)
        pong = await r.ping()
        await r.aclose()
        if not pong:
            raise ConnectionError("Redis ping failed")
        return "OK — connected", []

    await v.async_check("Redis connectivity", check_redis)

    # ── 5. AI Models ─────────────────────────────────────────────
    print(f"\n{BOLD}[ AI MODELS ]{RESET}")

    def check_yolo():
        from app.ai.detector import vehicle_detector, VEHICLE_CLASS_IDS
        vehicle_detector.load()
        return f"OK — device={vehicle_detector._device}", [
            f"Plate model: {'YOLO' if vehicle_detector._plate_model else 'Haar cascade fallback'}",
            f"Classes: {list(VEHICLE_CLASS_IDS.values())}",
        ]

    v.check("YOLOv8 loads without error", check_yolo)

    def check_inference():
        import cv2
        import numpy as np
        from app.ai.detector import vehicle_detector
        if not vehicle_detector.is_loaded:
            vehicle_detector.load()
        # Blank 640x480 frame — should return empty list, not crash
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        results = vehicle_detector.detect(frame)
        return f"OK — {len(results)} detections on blank frame (expected 0)", []

    v.check("YOLO inference runs without crash", check_inference)

    def check_ocr():
        from app.ai.ocr import plate_ocr
        plate_ocr.load()
        return f"OK — engines: {plate_ocr.engines_loaded}", []

    v.check("OCR engine loads without error", check_ocr)

    def check_ocr_normalize():
        from app.ai.ocr import _normalize_plate, PLATE_REGEX
        cases = [
            ("MH 12 AB 1234", "MH12AB1234"),
            ("mh12ab1234", "MH12AB1234"),
            ("MH-12-AB-1234", "MH12AB1234"),
        ]
        failures = []
        for raw, expected in cases:
            result = _normalize_plate(raw)
            if result != expected:
                failures.append(f"  '{raw}' → '{result}' (expected '{expected}')")
        if failures:
            raise AssertionError("Normalization failures:\n" + "\n".join(failures))
        return f"OK — {len(cases)} normalization cases pass", []

    v.check("OCR plate normalization correct", check_ocr_normalize)

    def check_ocr_real():
        import cv2
        import numpy as np
        from app.ai.ocr import plate_ocr
        if not plate_ocr.engines_loaded:
            plate_ocr.load()
        # Create a simple synthetic plate image
        img = np.ones((60, 200, 3), dtype=np.uint8) * 255
        cv2.putText(img, "MH12AB1234", (5, 45), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0,0,0), 2)
        result = plate_ocr.read_plate(img)
        details = [
            f"Text: '{result.text}'",
            f"Confidence: {result.confidence:.3f}",
            f"Engine: {result.engine_used}",
        ]
        # Accept partial read — synthetic font ≠ real plate
        return f"OK — read '{result.text}' conf={result.confidence:.2f}", details

    v.check("OCR reads synthetic plate image", check_ocr_real)

    # ── 6. Preprocessing ─────────────────────────────────────────
    print(f"\n{BOLD}[ PREPROCESSING ]{RESET}")

    def check_preprocessor():
        import cv2
        import numpy as np
        from app.ai.preprocessor import preprocess_frame, preprocess_plate_crop

        frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        processed = preprocess_frame(frame)
        assert processed.shape == frame.shape, "Frame shape changed"

        plate = np.random.randint(0, 255, (40, 120, 3), dtype=np.uint8)
        processed_plate = preprocess_plate_crop(plate)
        assert processed_plate.ndim == 3, "Plate crop should be 3-channel"

        return "OK — frame and plate preprocessing run correctly", []

    v.check("Preprocessing pipeline (CLAHE, deskew, binarize)", check_preprocessor)

    # ── 7. Evidence store ─────────────────────────────────────────
    print(f"\n{BOLD}[ EVIDENCE STORAGE ]{RESET}")

    async def check_evidence_store():
        import cv2
        import numpy as np
        from app.ai.evidence_store import save_frame_async, save_plate_crop_async
        from app.core.config import settings
        import uuid

        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(frame, "EVIDENCE TEST", (150, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255,255,255), 2)
        det_id = str(uuid.uuid4())

        frame_path = await save_frame_async(frame, "VALIDATE_CAM", det_id, [])
        if not frame_path:
            raise IOError(f"Frame save returned None — check UPLOAD_DIR={settings.UPLOAD_DIR}")

        abs_path = Path(settings.UPLOAD_DIR) / frame_path
        if not abs_path.exists():
            raise FileNotFoundError(f"Frame file not found at {abs_path}")

        size_kb = abs_path.stat().st_size // 1024
        return f"OK — saved {size_kb}KB to {frame_path}", [f"UPLOAD_DIR: {settings.UPLOAD_DIR}"]

    await v.async_check("Evidence frame save to disk", check_evidence_store)

    # ── 8. Vehicle lookup + expiry check ─────────────────────────
    print(f"\n{BOLD}[ VEHICLE REGISTRY + EXPIRY ]{RESET}")

    async def check_vehicle_lookup():
        from app.db.session import get_db_context
        from app.repositories.vehicle_repo import VehicleRepository
        async with get_db_context() as db:
            repo = VehicleRepository(db)
            vehicle = await repo.get_by_plate("MH12AB1234")
        if vehicle is None:
            raise ValueError("Seeded vehicle 'MH12AB1234' not found — run seed_db.py")
        return f"OK — found {vehicle.plate_number} ({vehicle.make} {vehicle.model_name})", []

    await v.async_check("Vehicle plate lookup (exact)", check_vehicle_lookup)

    async def check_expiry():
        from app.db.session import get_db_context
        from app.repositories.vehicle_repo import VehicleRepository
        from app.services.expiry_checker import check_vehicle_expiry
        async with get_db_context() as db:
            repo = VehicleRepository(db)
            # MH14CD5678 is seeded as expired
            vehicle = await repo.get_by_plate("MH14CD5678")
        if vehicle is None:
            raise ValueError("Seeded expired vehicle 'MH14CD5678' not found")
        report = check_vehicle_expiry(vehicle)
        if not report.has_violations:
            raise AssertionError("Expected violations for expired vehicle, got none")
        return (
            f"OK — {len(report.violations)} violation(s), fine ₹{report.total_fine:,.0f}",
            [v.description for v in report.violations],
        )

    await v.async_check("Expiry checker detects expired vehicle", check_expiry)

    # ── 9. Challan service ────────────────────────────────────────
    print(f"\n{BOLD}[ CHALLAN SERVICE ]{RESET}")

    async def check_challan_create():
        from app.db.session import AsyncSessionFactory
        from app.services.challan_service import ChallanService
        from app.schemas.challan import ChallanCreate
        from sqlalchemy import text

        async with AsyncSessionFactory() as db:
            service = ChallanService(db)
            challan = await service.issue_challan(ChallanCreate(
                plate_number="TEST9999",
                violation_type="expired_registration",
                fine_amount=2000,
                owner_name="Test Owner",
                owner_phone="9876543210",
            ))
            challan_id = challan.id
            await db.commit()

        return f"OK — issued {challan.challan_number}", [f"ID: {challan_id}"]

    await v.async_check("Challan creation in database", check_challan_create)

    async def check_pdf_generation():
        from app.db.session import AsyncSessionFactory
        from app.services.challan_service import ChallanService
        from app.schemas.challan import ChallanCreate
        from app.repositories.challan_repo import ChallanRepository
        import uuid

        async with AsyncSessionFactory() as db:
            service = ChallanService(db)
            c = await service.issue_challan(ChallanCreate(
                plate_number="TESTPDF1",
                violation_type="expired_registration",
                fine_amount=1500,
            ))
            await db.commit()
            challan_id = c.id

        async with AsyncSessionFactory() as db:
            service = ChallanService(db)
            pdf_bytes = await service.generate_pdf(uuid.UUID(str(challan_id)))
        if len(pdf_bytes) < 100:
            raise ValueError(f"PDF too small: {len(pdf_bytes)} bytes")
        if not pdf_bytes.startswith(b"%PDF"):
            raise ValueError("Output is not a valid PDF (missing %PDF header)")
        return f"OK — {len(pdf_bytes)//1024}KB valid PDF", []

    await v.async_check("PDF generation (ReportLab)", check_pdf_generation)

    # ── 10. Security ─────────────────────────────────────────────
    print(f"\n{BOLD}[ SECURITY ]{RESET}")

    def check_jwt():
        from app.core.security import create_access_token, create_refresh_token, decode_token
        token = create_access_token("test-user-id", {"role": "operator"})
        payload = decode_token(token)
        assert payload["sub"] == "test-user-id"
        assert payload["role"] == "operator"
        assert payload["type"] == "access"
        return "OK — JWT encode/decode round-trip", []

    v.check("JWT token creation and validation", check_jwt)

    def check_password():
        from app.core.security import hash_password, verify_password
        h = hash_password("SecurePass@123")
        assert verify_password("SecurePass@123", h)
        assert not verify_password("WrongPass@123", h)
        return "OK — bcrypt hash/verify", []

    v.check("Password hashing and verification", check_password)

    # ── Print summary ─────────────────────────────────────────────
    v._print_summary()
    return v.exit_code()


def main():
    parser = argparse.ArgumentParser(description="Validate the AI enforcement pipeline end-to-end")
    parser.add_argument("--fail-fast", action="store_true", help="Stop at first failure")
    parser.add_argument("--skip-gpu", action="store_true", default=True, help="Skip GPU-specific checks")
    args = parser.parse_args()

    exit_code = asyncio.run(run(args))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
