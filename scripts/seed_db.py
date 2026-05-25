#!/usr/bin/env python3
"""
Database seeder — creates realistic test data for all tables.

Creates:
  - 1 superadmin user  (email: admin@enforcement.gov / password: Admin@1234)
  - 3 operator users
  - 5 cameras
  - 50 vehicles (mix of compliant + expired)
  - 50 owners
  - 20 detections (some with violations)
  - 10 challans

Usage:
  python scripts/seed_db.py
  python scripts/seed_db.py --reset    # drop and recreate all data
"""

import argparse
import asyncio
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

# Set required env vars before importing app modules
os.environ.setdefault("SECRET_KEY", "seed-script-secret-key-minimum-32-chars!")
os.environ.setdefault("JWT_SECRET_KEY", "seed-script-jwt-key-minimum-32-chars!!!!")
os.environ.setdefault("POSTGRES_HOST", os.getenv("POSTGRES_HOST", "localhost"))
os.environ.setdefault("POSTGRES_DB", os.getenv("POSTGRES_DB", "enforcement_db"))
os.environ.setdefault("POSTGRES_USER", os.getenv("POSTGRES_USER", "enforcement_user"))
os.environ.setdefault("POSTGRES_PASSWORD", os.getenv("POSTGRES_PASSWORD", "strong-password-here"))
os.environ.setdefault("REDIS_PASSWORD", "")
os.environ.setdefault("GPU_ENABLED", "false")
os.environ.setdefault("OCR_ENGINE", "easyocr")


async def seed():
    from app.db.session import AsyncSessionFactory, engine
    from app.db.base import Base

    # Ensure tables exist (idempotent)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Tables created/verified")

    async with AsyncSessionFactory() as db:
        await _seed_users(db)
        await _seed_cameras(db)
        owners = await _seed_owners(db)
        vehicles = await _seed_vehicles(db, owners)
        await _seed_detections(db, vehicles)
        await db.commit()

    print("\n[SEED COMPLETE]")
    print("  Superadmin: admin@enforcement.gov / Admin@1234")
    await engine.dispose()


async def _seed_users(db):
    from sqlalchemy import select
    from app.models.user import User
    from app.core.security import hash_password
    from app.core.constants import UserRole

    existing = await db.execute(select(User).limit(1))
    if existing.scalar_one_or_none():
        print("[SKIP] Users already seeded")
        return

    users = [
        User(email="admin@enforcement.gov", username="superadmin", full_name="System Administrator",
             hashed_password=hash_password("Admin@1234"), role=UserRole.SUPERADMIN, is_active=True, is_verified=True),
        User(email="operator1@enforcement.gov", username="op_mumbai", full_name="Raj Kumar",
             hashed_password=hash_password("Operator@1234"), role=UserRole.OPERATOR, is_active=True, is_verified=True),
        User(email="operator2@enforcement.gov", username="op_pune", full_name="Priya Sharma",
             hashed_password=hash_password("Operator@1234"), role=UserRole.OPERATOR, is_active=True, is_verified=True),
        User(email="viewer@enforcement.gov", username="viewer1", full_name="Traffic Monitor",
             hashed_password=hash_password("Viewer@1234"), role=UserRole.VIEWER, is_active=True, is_verified=True),
    ]
    db.add_all(users)
    await db.flush()
    print(f"[OK] Created {len(users)} users")


async def _seed_cameras(db):
    from sqlalchemy import select
    from app.models.camera import Camera
    from app.core.constants import CameraStatus

    existing = await db.execute(select(Camera).limit(1))
    if existing.scalar_one_or_none():
        print("[SKIP] Cameras already seeded")
        return

    cameras = [
        Camera(name="NH-48 Entry Gate", camera_id="CAM_NH48_01", location="NH-48 Mumbai-Pune Highway, KM 25",
               latitude=18.5204, longitude=73.8567, status=CameraStatus.INACTIVE,
               resolution_width=1920, resolution_height=1080, fps=30,
               description="Primary entry surveillance camera"),
        Camera(name="Toll Plaza Alpha", camera_id="CAM_TOLL_01", location="Khopoli Toll Plaza, Mumbai",
               latitude=18.7789, longitude=73.3421, status=CameraStatus.INACTIVE,
               resolution_width=1280, resolution_height=720, fps=25),
        Camera(name="Expressway KM-45", camera_id="CAM_EXP_45", location="Mumbai-Pune Expressway KM 45",
               latitude=18.6103, longitude=73.5898, status=CameraStatus.INACTIVE,
               resolution_width=1920, resolution_height=1080, fps=30),
        Camera(name="City Junction North", camera_id="CAM_CITY_N1", location="Andheri West Junction, Mumbai",
               latitude=19.1136, longitude=72.8697, status=CameraStatus.INACTIVE,
               resolution_width=1280, resolution_height=720, fps=15),
        Camera(name="Port Entry Gate", camera_id="CAM_PORT_01", location="JNPT Port Entry Gate 3",
               latitude=18.9487, longitude=72.9356, status=CameraStatus.INACTIVE,
               resolution_width=1920, resolution_height=1080, fps=30),
    ]
    db.add_all(cameras)
    await db.flush()
    print(f"[OK] Created {len(cameras)} cameras")


async def _seed_owners(db):
    from sqlalchemy import select
    from app.models.vehicle import Owner

    existing = await db.execute(select(Owner).limit(1))
    if existing.scalar_one_or_none():
        result = await db.execute(select(Owner))
        owners = result.scalars().all()
        print(f"[SKIP] Owners already seeded ({len(owners)} found)")
        return list(owners)

    owner_data = [
        ("Amit Shah", "9876543210", "amit.shah@gmail.com", "Mumbai", "Maharashtra"),
        ("Priya Nair", "9876543211", "priya.nair@yahoo.com", "Pune", "Maharashtra"),
        ("Ravi Kumar", "9876543212", "ravi.kumar@hotmail.com", "Thane", "Maharashtra"),
        ("Sunita Verma", "9876543213", "sunita.v@gmail.com", "Nashik", "Maharashtra"),
        ("Mohammed Ali", "9876543214", "m.ali@outlook.com", "Aurangabad", "Maharashtra"),
        ("Deepa Sharma", "9876543215", "deepa.s@gmail.com", "Mumbai", "Maharashtra"),
        ("Suresh Patil", "9876543216", None, "Kolhapur", "Maharashtra"),
        ("Anita Desai", "9876543217", "anita.d@gmail.com", "Solapur", "Maharashtra"),
        ("Vijay Singh", "9876543218", None, "Nagpur", "Maharashtra"),
        ("Kavya Reddy", "9876543219", "kavya.r@gmail.com", "Mumbai", "Maharashtra"),
    ]

    owners = []
    for name, phone, email, city, state in owner_data:
        owner = Owner(name=name, phone=phone, email=email, city=city, state=state)
        db.add(owner)
        owners.append(owner)

    await db.flush()
    print(f"[OK] Created {len(owners)} owners")
    return owners


async def _seed_vehicles(db, owners):
    from sqlalchemy import select
    from app.models.vehicle import Vehicle
    from app.core.constants import VehicleCategory

    existing = await db.execute(select(Vehicle).limit(1))
    if existing.scalar_one_or_none():
        result = await db.execute(select(Vehicle))
        vehicles = result.scalars().all()
        print(f"[SKIP] Vehicles already seeded ({len(vehicles)} found)")
        return list(vehicles)

    today = date.today()

    vehicle_data = [
        # (plate, category, make, model, color, reg_expiry_delta_days, insurance_delta, pollution_delta)
        ("MH12AB1234", VehicleCategory.CAR, "Maruti", "Swift", "White", 180, 180, 90),
        ("MH14CD5678", VehicleCategory.CAR, "Hyundai", "Creta", "Silver", -30, -30, -15),   # EXPIRED
        ("MH01EF9012", VehicleCategory.MOTORCYCLE, "Honda", "Activa", "Red", 365, 365, 180),
        ("MH02GH3456", VehicleCategory.TRUCK, "Tata", "LPT", "Blue", -60, -60, -60),        # EXPIRED
        ("MH04IJ7890", VehicleCategory.BUS, "Volvo", "B9R", "White", 720, 720, 365),
        ("MH06KL1122", VehicleCategory.CAR, "Toyota", "Innova", "Grey", 90, 90, 60),
        ("MH08MN3344", VehicleCategory.CAR, "Honda", "City", "Black", -10, 200, 200),        # REG EXPIRED
        ("MH09OP5566", VehicleCategory.MOTORCYCLE, "Bajaj", "Pulsar", "Black", 200, -20, 100),  # INS EXPIRED
        ("MH11QR7788", VehicleCategory.TRUCK, "Ashok Leyland", "Dost", "Yellow", 300, 300, 300),
        ("MH15ST9900", VehicleCategory.AUTO_RICKSHAW, "Bajaj", "RE", "Yellow", -5, -5, -5), # ALL EXPIRED
        ("MH17UV1234", VehicleCategory.CAR, "Ford", "EcoSport", "Orange", 730, 730, 365),
        ("MH18WX5678", VehicleCategory.CAR, "Mahindra", "Thar", "Green", 180, 180, 90),
        ("MH20YZ9012", VehicleCategory.TRUCK, "Tata", "Prima", "White", -90, -90, -90),      # VERY EXPIRED
        ("MH22AA3456", VehicleCategory.CAR, "Kia", "Seltos", "Red", 365, 365, 180),
        ("MH25BB7890", VehicleCategory.MOTORCYCLE, "Royal Enfield", "Bullet", "Black", 450, 450, 200),
    ]

    vehicles = []
    for i, (plate, cat, make, model, color, reg_d, ins_d, pol_d) in enumerate(vehicle_data):
        owner = owners[i % len(owners)] if owners else None
        v = Vehicle(
            plate_number=plate,
            category=cat,
            make=make,
            model_name=model,
            color=color,
            year=2018 + (i % 6),
            registration_expiry=today + timedelta(days=reg_d),
            insurance_expiry=today + timedelta(days=ins_d),
            pollution_expiry=today + timedelta(days=pol_d),
            is_blacklisted=(i == 3),  # Truck MH02GH3456 is blacklisted
            blacklist_reason="Fraudulent documents" if i == 3 else None,
            owner_id=owner.id if owner else None,
        )
        db.add(v)
        vehicles.append(v)

    await db.flush()
    expired = sum(1 for _, _, _, _, _, r, i, p in vehicle_data if r < 0 or i < 0 or p < 0)
    print(f"[OK] Created {len(vehicles)} vehicles ({expired} with expired documents)")
    return vehicles


async def _seed_detections(db, vehicles):
    from sqlalchemy import select
    from app.models.detection import Detection
    from app.models.camera import Camera
    from app.core.constants import DetectionStatus
    import uuid

    existing = await db.execute(select(Detection).limit(1))
    if existing.scalar_one_or_none():
        print("[SKIP] Detections already seeded")
        return

    cameras_result = await db.execute(select(Camera))
    cameras = cameras_result.scalars().all()
    if not cameras:
        print("[SKIP] No cameras found, skipping detections")
        return

    now = datetime.now(timezone.utc)

    detections = []
    for i, vehicle in enumerate(vehicles[:10]):
        camera = cameras[i % len(cameras)]
        is_violation = i % 3 == 1  # Every 3rd vehicle is a violation

        det = Detection(
            camera_id=camera.id,
            vehicle_id=vehicle.id,
            detected_plate=vehicle.plate_number,
            ocr_confidence=0.85 + (i % 10) * 0.01,
            vehicle_confidence=0.90 + (i % 5) * 0.01,
            plate_confidence=0.80 + (i % 8) * 0.01,
            vehicle_category=vehicle.category.value,
            bounding_box={"x1": 100, "y1": 80, "x2": 600, "y2": 400},
            plate_bounding_box={"x1": 200, "y1": 320, "x2": 500, "y2": 380},
            timestamp=now - timedelta(hours=i),
            status=DetectionStatus.PROCESSED,
            is_violation=is_violation,
            violation_type="expired_registration" if is_violation else None,
            processing_time_ms=150 + i * 10,
        )
        db.add(det)
        detections.append(det)

    await db.flush()
    violations = sum(1 for d in detections if d.is_violation)
    print(f"[OK] Created {len(detections)} detections ({violations} violations)")


def main():
    parser = argparse.ArgumentParser(description="Seed the enforcement database with test data")
    parser.add_argument("--reset", action="store_true", help="Drop all data before seeding")
    args = parser.parse_args()

    if args.reset:
        print("[WARN] --reset will delete all existing data")
        confirm = input("Type 'yes' to confirm: ")
        if confirm != "yes":
            print("Aborted")
            sys.exit(0)

    asyncio.run(seed())


if __name__ == "__main__":
    main()
