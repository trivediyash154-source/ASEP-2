"""
Realistic demo data seeding.

Populates the platform with a believable Indian city deployment:
  - ~12 cameras across Mumbai with real coordinates
  - ~80 vehicle owners with Indian names/phones
  - ~140 vehicles (MH-plate mix of categories, with realistic expiry distribution)
  - ~900 detections over the past 7 days (recency-weighted)
  - ~260 challans (mixed status distribution)

Fully idempotent: if a marker key is set in the audit log we skip the
expensive bulk insert path. To re-seed, drop the audit row first.
"""
import asyncio
import random
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List

from sqlalchemy import func, select

from app.core.constants import CameraStatus, ChallanStatus, DetectionStatus, VehicleCategory
from app.core.logging import get_logger
from app.db.session import AsyncSessionFactory
from app.models.camera import Camera
from app.models.challan import Challan
from app.models.detection import Detection
from app.models.user import AuditLog
from app.models.vehicle import Owner, Vehicle

logger = get_logger(__name__)

SEED_MARKER_ACTION = "demo_data_seeded"

# ── Reference data ──────────────────────────────────────────────────

CAMERAS_SPEC = [
    # (name, camera_id, location, lat, lng, status)
    ("Bandra Worli Sea Link — South", "MUM-BWS-01", "Bandra-Worli Sea Link, S-Tower", 19.0291, 72.8175, CameraStatus.ACTIVE),
    ("Bandra Worli Sea Link — North", "MUM-BWS-02", "Bandra-Worli Sea Link, N-Tower", 19.0395, 72.8186, CameraStatus.ACTIVE),
    ("Western Express Hwy — Andheri", "MUM-WEH-04", "Western Express Hwy, Andheri E",   19.1190, 72.8478, CameraStatus.ACTIVE),
    ("Eastern Express Hwy — Sion",    "MUM-EEH-07", "Eastern Express Hwy, Sion Junction",19.0436, 72.8628, CameraStatus.ACTIVE),
    ("Marine Drive — Air India",      "MUM-MAR-02", "Marine Drive, opp. Air India Bldg", 18.9438, 72.8237, CameraStatus.ACTIVE),
    ("Powai Hiranandani Gardens",     "MUM-PHG-01", "Hiranandani Gardens Main Rd",        19.1197, 72.9080, CameraStatus.ACTIVE),
    ("Thane–Belapur Rd, Vashi",       "MUM-VSH-03", "Thane–Belapur Rd, Vashi Bridge",     19.0760, 72.9990, CameraStatus.ACTIVE),
    ("Dadar TT Circle",               "MUM-DDR-01", "Dr Ambedkar Rd, Dadar TT",           19.0190, 72.8430, CameraStatus.MAINTENANCE),
    ("Worli Sea Face",                "MUM-WSF-01", "Worli Sea Face Promenade",            19.0177, 72.8156, CameraStatus.ACTIVE),
    ("Juhu Tara Rd",                  "MUM-JTR-02", "Juhu Tara Rd, opp. Holiday Inn",      19.0972, 72.8265, CameraStatus.ACTIVE),
    ("Linking Rd, Khar West",         "MUM-LNK-05", "Linking Rd, Khar W Pali Naka",        19.0760, 72.8350, CameraStatus.ACTIVE),
    ("LBS Marg, Kurla",               "MUM-LBS-02", "LBS Marg, Kurla W Bus Depot",         19.0700, 72.8830, CameraStatus.ERROR),
]

INDIAN_FIRST_NAMES = [
    "Aarav","Aditi","Aniket","Anjali","Arjun","Asha","Bhavesh","Chitra","Darshan","Devika",
    "Esha","Farhan","Gaurav","Harini","Imran","Jyoti","Kabir","Kavya","Lakshmi","Manish",
    "Neha","Omkar","Pooja","Qasim","Raghav","Ritika","Sanjay","Tanvi","Uday","Vikram",
    "Yash","Zara","Anushka","Rohan","Priya","Karan","Meera","Siddharth","Aishwarya","Nikhil",
]
INDIAN_LAST_NAMES = [
    "Sharma","Patel","Mehta","Iyer","Reddy","Kapoor","Singh","Nair","Joshi","Verma",
    "Khan","Desai","Bhatt","Pillai","Kulkarni","Gupta","Roy","Bose","Saxena","Trivedi",
]

VEHICLE_MAKES = {
    VehicleCategory.CAR: [
        ("Maruti Suzuki", "Swift"), ("Maruti Suzuki", "Baleno"), ("Hyundai", "Creta"),
        ("Hyundai", "i20"), ("Tata", "Nexon"), ("Honda", "City"), ("Toyota", "Innova"),
        ("Kia", "Seltos"), ("Mahindra", "XUV700"), ("Skoda", "Slavia"),
    ],
    VehicleCategory.MOTORCYCLE: [
        ("Honda", "Activa 6G"), ("TVS", "Jupiter"), ("Bajaj", "Pulsar 150"),
        ("Royal Enfield", "Classic 350"), ("Hero", "Splendor Plus"), ("Yamaha", "FZ-S"),
    ],
    VehicleCategory.TRUCK: [
        ("Tata", "407"), ("Ashok Leyland", "Dost"), ("Mahindra", "Bolero Pickup"),
    ],
    VehicleCategory.BUS: [
        ("Tata", "Starbus"), ("Ashok Leyland", "Viking"),
    ],
    VehicleCategory.AUTO_RICKSHAW: [
        ("Bajaj", "RE Compact"), ("Piaggio", "Ape City"),
    ],
}
COLORS = ["White", "Silver", "Black", "Grey", "Red", "Blue", "Brown"]

VIOLATION_TYPES = [
    ("Expired Registration", 5000),
    ("Expired Insurance",    2000),
    ("Expired Pollution Cert", 1500),
    ("Blacklisted Vehicle",  10000),
    ("Speeding",             3000),
    ("Signal Jump",          1500),
]

# ── Idempotency check ───────────────────────────────────────────────


async def _already_seeded(session) -> bool:
    result = await session.execute(
        select(func.count())
        .select_from(AuditLog)
        .where(AuditLog.action == SEED_MARKER_ACTION)
    )
    return result.scalar_one() > 0


async def _mark_seeded(session) -> None:
    session.add(
        AuditLog(
            action=SEED_MARKER_ACTION,
            resource="demo_data",
            success=True,
            details="seed_demo_data.py initial run",
        )
    )


# ── Generators ──────────────────────────────────────────────────────


def _make_plate() -> str:
    # MH XX 1234 AB style (no spaces stored)
    rto_codes = ["01", "02", "03", "04", "05", "12", "14", "43", "46", "47"]
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    return f"MH{random.choice(rto_codes)}{random.choice(letters)}{random.choice(letters)}{random.randint(1000, 9999)}"


def _make_phone() -> str:
    return f"+91{random.choice('789')}{''.join(str(random.randint(0, 9)) for _ in range(9))}"


def _make_owner() -> Owner:
    name = f"{random.choice(INDIAN_FIRST_NAMES)} {random.choice(INDIAN_LAST_NAMES)}"
    return Owner(
        name=name,
        email=f"{name.lower().replace(' ', '.')}{random.randint(1, 999)}@example.in",
        phone=_make_phone(),
        city="Mumbai",
        state="Maharashtra",
        pincode=f"4000{random.randint(10, 99)}",
        id_proof_type="Aadhaar",
        id_proof_number=f"{random.randint(1000, 9999)} {random.randint(1000, 9999)} {random.randint(1000, 9999)}",
    )


def _make_vehicle(owner_id, today: date) -> Vehicle:
    category = random.choices(
        list(VEHICLE_MAKES.keys()),
        weights=[55, 28, 7, 4, 6],
        k=1,
    )[0]
    make, model_name = random.choice(VEHICLE_MAKES[category])

    # Realistic compliance distribution
    reg_days = random.choices(
        [random.randint(-180, -1), random.randint(1, 1825)],
        weights=[18, 82], k=1,
    )[0]
    ins_days = random.choices(
        [random.randint(-90, -1), random.randint(1, 365)],
        weights=[14, 86], k=1,
    )[0]
    pol_days = random.choices(
        [random.randint(-60, -1), random.randint(1, 365)],
        weights=[22, 78], k=1,
    )[0]

    is_blacklisted = random.random() < 0.03  # ~3% blacklisted
    return Vehicle(
        plate_number=_make_plate(),
        category=category,
        make=make,
        model_name=model_name,
        color=random.choice(COLORS),
        year=random.randint(2014, 2025),
        registration_expiry=today + timedelta(days=reg_days),
        insurance_expiry=today + timedelta(days=ins_days),
        pollution_expiry=today + timedelta(days=pol_days),
        is_blacklisted=is_blacklisted,
        blacklist_reason="Repeat offender — toll evasion" if is_blacklisted else None,
        owner_id=owner_id,
    )


def _detection_time_distribution(now: datetime, count: int) -> List[datetime]:
    """Recency-weighted timestamps across the past 7 days."""
    out: List[datetime] = []
    for _ in range(count):
        # 60% in last 24h, 30% in last 3 days, 10% older
        bucket = random.choices([1, 2, 3], weights=[60, 30, 10], k=1)[0]
        if bucket == 1:
            seconds_ago = random.randint(0, 60 * 60 * 24)
        elif bucket == 2:
            seconds_ago = random.randint(60 * 60 * 24, 60 * 60 * 24 * 3)
        else:
            seconds_ago = random.randint(60 * 60 * 24 * 3, 60 * 60 * 24 * 7)
        out.append(now - timedelta(seconds=seconds_ago))
    return out


def _violation_for(vehicle: Vehicle, today: date) -> tuple[str | None, float]:
    """Decide whether this detection is a violation, return (type, fine_amount)."""
    if vehicle.is_blacklisted:
        return ("Blacklisted Vehicle", 10000)
    if vehicle.registration_expiry and vehicle.registration_expiry < today:
        return ("Expired Registration", 5000)
    if vehicle.insurance_expiry and vehicle.insurance_expiry < today:
        return ("Expired Insurance", 2000)
    if vehicle.pollution_expiry and vehicle.pollution_expiry < today:
        return ("Expired Pollution Cert", 1500)
    # 8% random other-violation detections
    if random.random() < 0.08:
        v_type, fine = random.choice(VIOLATION_TYPES[3:])
        return (v_type, fine)
    return (None, 0.0)


# ── Main entry ──────────────────────────────────────────────────────


async def seed_demo_data() -> dict:
    summary = {"cameras": 0, "owners": 0, "vehicles": 0, "detections": 0, "challans": 0, "skipped": False}

    async with AsyncSessionFactory() as session:
        if await _already_seeded(session):
            summary["skipped"] = True
            logger.info("demo_data_already_seeded")
            return summary

        now = datetime.now(timezone.utc)
        today = now.date()

        # ── Cameras ──────────────────────────────────────────────
        cameras: list[Camera] = []
        for spec in CAMERAS_SPEC:
            cam = Camera(
                name=spec[0],
                camera_id=spec[1],
                location=spec[2],
                latitude=spec[3],
                longitude=spec[4],
                status=spec[5],
                resolution_width=1920,
                resolution_height=1080,
                fps=30,
                stream_url=f"rtsp://stream.enforcement.gov/{spec[1].lower()}/live",
                description="ANPR-grade fixed-mount installation, IP66 enclosure.",
                # Camera.last_seen is timezone-naive in the model schema
                last_seen=(now - timedelta(seconds=random.randint(1, 90))).replace(tzinfo=None) if spec[5] == CameraStatus.ACTIVE else None,
            )
            session.add(cam)
            cameras.append(cam)
        await session.flush()
        summary["cameras"] = len(cameras)

        # ── Owners & vehicles ────────────────────────────────────
        owners: list[Owner] = [_make_owner() for _ in range(80)]
        session.add_all(owners)
        await session.flush()
        summary["owners"] = len(owners)

        vehicles: list[Vehicle] = []
        for _ in range(140):
            o = random.choice(owners)
            vehicles.append(_make_vehicle(o.id, today))
        session.add_all(vehicles)
        await session.flush()
        summary["vehicles"] = len(vehicles)

        # ── Detections (recency-weighted) ────────────────────────
        active_cams = [c for c in cameras if c.status == CameraStatus.ACTIVE]
        det_count = 900
        timestamps = sorted(_detection_time_distribution(now, det_count))

        detections: list[Detection] = []
        # Track per-camera totals for the camera card aggregate
        cam_totals: dict[uuid.UUID, int] = {c.id: 0 for c in cameras}

        for ts in timestamps:
            cam = random.choice(active_cams)
            veh = random.choice(vehicles)
            v_type, _fine = _violation_for(veh, today)
            is_violation = v_type is not None

            d = Detection(
                camera_id=cam.id,
                vehicle_id=veh.id,
                detected_plate=veh.plate_number,
                ocr_confidence=round(random.uniform(0.72, 0.99), 3),
                ocr_raw_text=veh.plate_number,
                vehicle_confidence=round(random.uniform(0.75, 0.99), 3),
                plate_confidence=round(random.uniform(0.65, 0.97), 3),
                vehicle_category=veh.category.value,
                bounding_box={"x1": random.randint(200, 600), "y1": random.randint(100, 300),
                              "x2": random.randint(700, 1200), "y2": random.randint(400, 700)},
                # Detection.timestamp is timezone-naive in the schema
                timestamp=ts.replace(tzinfo=None),
                status=DetectionStatus.PROCESSED,
                is_violation=is_violation,
                violation_type=v_type,
                processing_time_ms=random.randint(95, 260),
            )
            detections.append(d)
            cam_totals[cam.id] += 1

        session.add_all(detections)
        await session.flush()
        summary["detections"] = len(detections)

        # Update per-camera total_detections for realistic camera health UI
        for cam in cameras:
            cam.total_detections = cam_totals.get(cam.id, 0)
            if cam.status == CameraStatus.ERROR:
                cam.error_count = random.randint(5, 25)
                cam.last_error = "Stream timeout exceeded (RTSP read failure)"
        session.add_all(cameras)

        # ── Challans for violations ──────────────────────────────
        challans: list[Challan] = []
        violations = [d for d in detections if d.is_violation]
        # Issue challans for ~70% of recent violations
        for d in violations:
            if random.random() > 0.70:
                continue
            v_type = d.violation_type
            fine = next((f for v, f in VIOLATION_TYPES if v == v_type), 1500)
            # d.timestamp is naive — re-attach UTC since Challan.issued_at is tz-aware
            issued_at = (d.timestamp + timedelta(minutes=random.randint(2, 45))).replace(tzinfo=timezone.utc)
            due_date = (issued_at + timedelta(days=30)).date()
            veh = next(v for v in vehicles if v.id == d.vehicle_id)
            owner = next(o for o in owners if o.id == veh.owner_id) if veh.owner_id else None

            # Status distribution based on age
            age_hours = (now - issued_at).total_seconds() / 3600
            if age_hours > 24 * 30:
                status = random.choices(
                    [ChallanStatus.PAID, ChallanStatus.OVERDUE, ChallanStatus.DISPUTED],
                    weights=[55, 35, 10], k=1)[0]
            elif age_hours > 24 * 7:
                status = random.choices(
                    [ChallanStatus.ISSUED, ChallanStatus.PAID, ChallanStatus.DISPUTED],
                    weights=[40, 50, 10], k=1)[0]
            else:
                status = random.choices(
                    [ChallanStatus.ISSUED, ChallanStatus.PAID],
                    weights=[78, 22], k=1)[0]

            paid_at = issued_at + timedelta(hours=random.randint(2, 96)) if status == ChallanStatus.PAID else None
            paid_amount = fine if status == ChallanStatus.PAID else None

            cn = f"CHN-{issued_at.strftime('%y%m')}-{random.randint(10000, 99999)}"
            challans.append(
                Challan(
                    challan_number=cn,
                    vehicle_id=veh.id,
                    detection_id=d.id,
                    violation_type=v_type,
                    violation_description=f"AI-detected: {v_type.lower()} confirmed via ANPR + reg-database cross-check",
                    plate_number=veh.plate_number,
                    location=next((c.location for c in cameras if c.id == d.camera_id), "Mumbai"),
                    fine_amount=fine,
                    status=status,
                    issued_at=issued_at,
                    due_date=due_date,
                    paid_at=paid_at,
                    paid_amount=paid_amount,
                    payment_reference=f"TXN{random.randint(10**9, 10**10)}" if paid_at else None,
                    owner_name=owner.name if owner else None,
                    owner_phone=owner.phone if owner else None,
                    owner_email=owner.email if owner else None,
                )
            )

        session.add_all(challans)
        summary["challans"] = len(challans)

        await _mark_seeded(session)
        await session.commit()

    logger.info("demo_data_seeded", **{k: v for k, v in summary.items() if k != "skipped"})
    return summary


if __name__ == "__main__":
    s = asyncio.run(seed_demo_data())
    print(s)
