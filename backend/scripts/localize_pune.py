"""Pune localization migration — converts existing DB rows in place.

Renames the camera network from the original Mumbai seed identity to the
Pune Smart Mobility Pilot network. Camera UUIDs are untouched, so every
detection, evidence frame, and challan keeps its foreign keys; only the
display identity (name / code / location / coordinates) changes.

Also rewrites location strings on historical challans and owner cities so
no Mumbai-era text survives in the data.

Idempotent: re-running is a no-op once rows are converted.

Run inside the backend container:
    python scripts/localize_pune.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select, update  # noqa: E402

from app.db.session import AsyncSessionFactory  # noqa: E402
from app.models.camera import Camera  # noqa: E402
from app.models.challan import Challan  # noqa: E402
from app.models.vehicle import Owner  # noqa: E402

# old camera_id → (new name, new camera_id, new location, lat, lng)
CAMERA_MAP: dict[str, tuple[str, str, str, float, float]] = {
    "MUM-BWS-01": ("Katraj Chowk — NH-48",          "PUN-KTJ-11", "Satara Rd, Katraj Chowk",           18.4575, 73.8508),
    "MUM-BWS-02": ("FC Road — Shivajinagar",        "PUN-FCR-07", "FC Rd × Shivajinagar",              18.5286, 73.8412),
    "MUM-WEH-04": ("Old Mumbai Hwy — Pimpri",       "PUN-PCM-03", "Old Mumbai–Pune Hwy, Pimpri",       18.6298, 73.7997),
    "MUM-EEH-07": ("Baner Road — Aundh Junction",   "PUN-BNR-04", "Baner Rd, Aundh Junction",          18.5590, 73.7868),
    "MUM-MAR-02": ("JM Road — Deccan Gymkhana",     "PUN-JMR-06", "JM Rd, Deccan Gymkhana",            18.5167, 73.8415),
    "MUM-PHG-01": ("North Main Rd — Koregaon Park", "PUN-KP-08",  "North Main Rd, Koregaon Park",      18.5362, 73.8939),
    "MUM-VSH-03": ("Wakad Expressway Exit",         "PUN-WKD-02", "Expressway Exit, Wakad Flyover",    18.5980, 73.7620),
    "MUM-DDR-01": ("University Circle",             "PUN-SHN-05", "Ganeshkhind Rd, University Circle", 18.5530, 73.8295),
    "MUM-WSF-01": ("Kharadi Bypass — Nagar Rd",     "PUN-KHD-09", "Nagar Rd Bypass, Kharadi",          18.5515, 73.9345),
    "MUM-JTR-02": ("Swargate Junction",             "PUN-SWG-10", "Satara Rd, Swargate Junction",      18.5018, 73.8587),
    "MUM-LNK-05": ("Hinjewadi Phase 2 Gate",        "PUN-HJW-01", "Hinjewadi IT Park Ph 2, Main Gate", 18.5867, 73.6890),
    "MUM-LBS-02": ("Magarpatta Rd — Hadapsar",      "PUN-HDP-12", "Magarpatta Rd, Hadapsar",           18.5089, 73.9260),
}

# old location text → new location text (challan history rewrite)
LOCATION_MAP: dict[str, str] = {
    "Bandra-Worli Sea Link, S-Tower":      "Satara Rd, Katraj Chowk",
    "Bandra-Worli Sea Link, N-Tower":      "FC Rd × Shivajinagar",
    "Western Express Hwy, Andheri E":      "Old Mumbai–Pune Hwy, Pimpri",
    "Eastern Express Hwy, Sion Junction":  "Baner Rd, Aundh Junction",
    "Marine Drive, opp. Air India Bldg":   "JM Rd, Deccan Gymkhana",
    "Hiranandani Gardens Main Rd":         "North Main Rd, Koregaon Park",
    "Hiranandani Gardens Main Rd, Powai":  "North Main Rd, Koregaon Park",
    "Thane–Belapur Rd, Vashi Bridge":      "Expressway Exit, Wakad Flyover",
    "Dr Ambedkar Rd, Dadar TT":            "Ganeshkhind Rd, University Circle",
    "Worli Sea Face Promenade":            "Nagar Rd Bypass, Kharadi",
    "Juhu Tara Rd, opp. Holiday Inn":      "Satara Rd, Swargate Junction",
    "Linking Rd, Khar W Pali Naka":        "Hinjewadi IT Park Ph 2, Main Gate",
    "LBS Marg, Kurla W Bus Depot":         "Magarpatta Rd, Hadapsar",
    "Mumbai":                              "Pune",
}


async def main() -> None:
    async with AsyncSessionFactory() as session:
        # ── Cameras ────────────────────────────────────────────────
        cams = (await session.execute(select(Camera))).scalars().all()
        renamed = 0
        for cam in cams:
            spec = CAMERA_MAP.get(cam.camera_id)
            if not spec:
                continue
            name, code, location, lat, lng = spec
            cam.name = name
            cam.camera_id = code
            cam.location = location
            cam.latitude = lat
            cam.longitude = lng
            renamed += 1
        print(f"cameras renamed: {renamed} (of {len(cams)})")

        # ── Challans: rewrite historical location strings ──────────
        loc_updates = 0
        for old, new in LOCATION_MAP.items():
            res = await session.execute(
                update(Challan).where(Challan.location == old).values(location=new)
            )
            loc_updates += res.rowcount or 0
        print(f"challan locations rewritten: {loc_updates}")

        # ── Owners: city Mumbai/Thane → Pune region ────────────────
        res = await session.execute(
            update(Owner).where(Owner.city == "Mumbai").values(city="Pune")
        )
        owner_updates = res.rowcount or 0
        res = await session.execute(
            update(Owner).where(Owner.city == "Thane").values(city="Pimpri-Chinchwad")
        )
        owner_updates += res.rowcount or 0
        print(f"owner cities updated: {owner_updates}")

        await session.commit()
        print("Pune localization committed.")


if __name__ == "__main__":
    asyncio.run(main())
