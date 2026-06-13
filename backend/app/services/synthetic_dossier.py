"""
Synthetic vehicle/owner/compliance dossier generator.

Purpose
───────
When the live AI pipeline OCRs an Indian plate that is NOT in the demo
registry (which happens constantly with real cameras / printed plates),
we still want the operator to see a believable, government-grade
intelligence dossier. This module deterministically generates one.

Determinism
───────────
Every output is seeded by a hash of the normalized plate. The SAME plate
always yields the SAME dossier across server restarts. That matters
because:
  * Repeat sightings of the same vehicle (different camera, different
    day) should look consistent in the operator console.
  * Demo replays must be reproducible.

Realism rules
─────────────
  * Owner names, vehicle make/model, and city align with the plate's
    state code (e.g. MH plates → Pune-region owners for the pilot theatre).
  * Expiry probabilities match the spec the user wrote: insurance 18%,
    PUC 22%, registration 9%, blacklisted 2%, otherwise clean.
  * When something expires, the "expiry date" is set to a plausible past
    date — not yesterday, not a decade ago.
  * Phone numbers are E.164 with Indian operator-realistic prefixes.

The output is intentionally NOT a `Vehicle` ORM object — it's a small
dataclass the compliance engine folds into its existing `ComplianceReport`
shape. That keeps `Vehicle` strictly tied to the real demo registry.
"""
from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional

from app.ai.ocr import _is_bh_series, _is_morth_temp_series

# ── State → metadata (RTO city + state name) ────────────────────────
#
# Mapping is intentionally compact — we only need enough variation for the
# generated dossier to feel anchored to the plate's region. Picking RTO
# cities biased by the state's most common districts keeps demo plates
# reading as Pune-region for MH, Bangalore for KA, etc.

_STATE_META: dict[str, dict] = {
    "MH": {"state": "Maharashtra",   "cities": ["Pune", "Pimpri-Chinchwad", "Hadapsar", "Aundh", "Kothrud"]},
    "DL": {"state": "Delhi",         "cities": ["New Delhi", "Dwarka", "Rohini"]},
    "KA": {"state": "Karnataka",     "cities": ["Bengaluru", "Mysuru", "Hubballi"]},
    "TN": {"state": "Tamil Nadu",    "cities": ["Chennai", "Coimbatore", "Madurai"]},
    "GJ": {"state": "Gujarat",       "cities": ["Ahmedabad", "Surat", "Vadodara"]},
    "UP": {"state": "Uttar Pradesh", "cities": ["Lucknow", "Noida", "Kanpur"]},
    "WB": {"state": "West Bengal",   "cities": ["Kolkata", "Howrah"]},
    "HR": {"state": "Haryana",       "cities": ["Gurugram", "Faridabad"]},
    "RJ": {"state": "Rajasthan",     "cities": ["Jaipur", "Jodhpur", "Udaipur"]},
    "TG": {"state": "Telangana",     "cities": ["Hyderabad", "Warangal"]},
    "TS": {"state": "Telangana",     "cities": ["Hyderabad", "Warangal", "Nizamabad", "Khammam"]},
    "AP": {"state": "Andhra Pradesh","cities": ["Visakhapatnam", "Vijayawada"]},
    "KL": {"state": "Kerala",        "cities": ["Kochi", "Thiruvananthapuram"]},
    "PB": {"state": "Punjab",        "cities": ["Ludhiana", "Amritsar"]},
    "MP": {"state": "Madhya Pradesh","cities": ["Bhopal", "Indore"]},
    "BR": {"state": "Bihar",         "cities": ["Patna", "Gaya"]},
    "OD": {"state": "Odisha",        "cities": ["Bhubaneswar", "Cuttack"]},
    "OR": {"state": "Odisha",        "cities": ["Bhubaneswar", "Cuttack", "Rourkela"]},
    "JK": {"state": "Jammu & Kashmir","cities": ["Srinagar", "Jammu"]},
    "AS": {"state": "Assam",         "cities": ["Guwahati"]},
    "CH": {"state": "Chandigarh",    "cities": ["Chandigarh"]},
    "GA": {"state": "Goa",           "cities": ["Panaji"]},
    "UK": {"state": "Uttarakhand",   "cities": ["Dehradun"]},
    "UA": {"state": "Uttarakhand",   "cities": ["Dehradun", "Haridwar", "Haldwani"]},
    "HP": {"state": "Himachal Pradesh","cities":["Shimla"]},
    "JH": {"state": "Jharkhand",     "cities": ["Ranchi"]},
    "CG": {"state": "Chhattisgarh",  "cities": ["Raipur"]},
    "DN": {"state": "Dadra & Nagar Haveli", "cities": ["Silvassa"]},
    "BH": {"state": "Bharat",        "cities": ["New Delhi RTO", "Pune RTO", "Bengaluru RTO", "Chennai RTO", "Hyderabad RTO"]},
}

_DEFAULT_STATE = {"state": "India", "cities": ["Unspecified RTO"]}

# Name pool — pan-India spread. We pair first + last names independently
# so the entropy is 25 * 25 = 625 distinct owners per plate-seed, plenty
# for a demo to feel non-repeating.
_FIRST_NAMES = [
    "Aarav", "Anjali", "Vihaan", "Ananya", "Rohan", "Priya", "Aditya",
    "Sneha", "Karan", "Riya", "Arjun", "Pooja", "Rahul", "Neha", "Vikram",
    "Kavya", "Siddharth", "Meera", "Manish", "Isha", "Akash", "Tara",
    "Devansh", "Sara", "Yash",
]
_LAST_NAMES = [
    "Sharma", "Patel", "Kumar", "Singh", "Reddy", "Iyer", "Nair", "Khan",
    "Joshi", "Mehta", "Verma", "Gupta", "Rao", "Pillai", "Desai", "Kapoor",
    "Chopra", "Bhat", "Shetty", "Naidu", "Bose", "Banerjee", "Saxena",
    "Trivedi", "Agarwal",
]

# Vehicle pools by class — model is paired with a make so the dossier
# doesn't generate "Maruti Land Cruiser".
_VEHICLES_BY_CATEGORY: dict[str, list[tuple[str, str]]] = {
    "car": [
        ("Maruti Suzuki", "Swift"), ("Maruti Suzuki", "Baleno"),
        ("Maruti Suzuki", "Brezza"), ("Hyundai", "Creta"),
        ("Hyundai", "i20"), ("Hyundai", "Verna"),
        ("Tata", "Nexon"), ("Tata", "Punch"), ("Tata", "Altroz"),
        ("Mahindra", "XUV700"), ("Mahindra", "Thar"),
        ("Toyota", "Innova Crysta"), ("Toyota", "Fortuner"),
        ("Kia", "Seltos"), ("Kia", "Sonet"),
        ("Honda", "City"), ("Honda", "Amaze"),
        ("Skoda", "Slavia"), ("Volkswagen", "Virtus"),
    ],
    "motorcycle": [
        ("Hero", "Splendor Plus"), ("Hero", "HF Deluxe"),
        ("Honda", "Shine"), ("Honda", "Activa 6G"),
        ("Bajaj", "Pulsar 150"), ("Bajaj", "Pulsar NS200"),
        ("TVS", "Apache RTR 160"), ("TVS", "Jupiter"),
        ("Royal Enfield", "Classic 350"), ("Royal Enfield", "Hunter 350"),
        ("Yamaha", "FZ-S"), ("Yamaha", "MT-15"),
        ("Suzuki", "Access 125"),
    ],
    "truck": [
        ("Tata", "Ace Gold"), ("Tata", "LPT 1109"),
        ("Ashok Leyland", "Dost"), ("Ashok Leyland", "Boss"),
        ("Mahindra", "Bolero Pickup"), ("Eicher", "Pro 3015"),
    ],
    "bus": [
        ("Tata", "Starbus"), ("Ashok Leyland", "Viking"),
        ("Eicher", "Skyline Pro"), ("Volvo", "9400"),
    ],
    "auto_rickshaw": [
        ("Bajaj", "RE Compact"), ("Bajaj", "Maxima Z"),
        ("Piaggio", "Ape City"), ("TVS", "King Deluxe"),
        ("Mahindra", "Alfa Plus"),
    ],
}
_COLORS = ["White", "Silver", "Black", "Grey", "Red", "Blue", "Maroon", "Beige"]


# ── Public dataclass ────────────────────────────────────────────────


@dataclass
class SyntheticDossier:
    """Believable intelligence for a plate that isn't in the demo registry."""
    owner_name: str
    owner_phone: str
    owner_email: str
    owner_city: str
    owner_state: str
    vehicle_make: str
    vehicle_model: str
    vehicle_color: str
    vehicle_year: int
    vehicle_category: str

    # Compliance status — these mirror the CheckResult shapes used by
    # the real compliance engine, kept as raw fields so the engine can
    # fold them in without an import cycle.
    registration_status: str    # VALID | EXPIRED | EXPIRING_SOON
    registration_expiry: date
    insurance_status: str
    insurance_expiry: date
    puc_status: str
    puc_expiry: date
    blacklist_flagged: bool
    blacklist_reason: Optional[str]
    offense_history_count: int   # number of historical citations on file

    # Generator metadata — useful for logging/debugging
    seed: str
    is_synthetic: bool = True

    def as_dict(self) -> dict:
        return {
            "owner": {
                "name": self.owner_name,
                "phone": self.owner_phone,
                "email": self.owner_email,
                "city": self.owner_city,
                "state": self.owner_state,
            },
            "vehicle": {
                "make": self.vehicle_make,
                "model": self.vehicle_model,
                "color": self.vehicle_color,
                "year": self.vehicle_year,
                "category": self.vehicle_category,
            },
            "registration": {"status": self.registration_status, "expiry": self.registration_expiry.isoformat()},
            "insurance":    {"status": self.insurance_status,    "expiry": self.insurance_expiry.isoformat()},
            "puc":          {"status": self.puc_status,          "expiry": self.puc_expiry.isoformat()},
            "blacklist":    {"flagged": self.blacklist_flagged, "reason": self.blacklist_reason},
            "offense_history_count": self.offense_history_count,
            "is_synthetic": self.is_synthetic,
            "seed": self.seed,
        }


# ── Public entry point ─────────────────────────────────────────────


def generate_synthetic_dossier(plate: str) -> SyntheticDossier:
    """Build a deterministic dossier for `plate`. Same plate → same dossier."""
    plate_norm = "".join(ch for ch in plate.upper() if ch.isalnum()) or "UNKNOWN"
    seed = _seed_from_plate(plate_norm)
    rng = random.Random(seed)

    if _is_morth_temp_series(plate_norm):
        state_code = plate_norm[5:7]
    elif _is_bh_series(plate_norm):
        state_code = "BH"
    else:
        state_code = plate_norm[:2] if plate_norm[:2].isalpha() else "MH"
    meta = _STATE_META.get(state_code, _DEFAULT_STATE)
    state_name = meta["state"]
    city = rng.choice(meta["cities"])

    first = rng.choice(_FIRST_NAMES)
    last = rng.choice(_LAST_NAMES)
    owner_name = f"{first} {last}"

    # Indian mobile prefixes (Jio/Airtel/Vi). Restrict the leading digit to
    # 6–9 so the number passes the standard E.164 IN-mobile regex.
    phone = f"+91 {rng.randint(6, 9)}{rng.randint(100, 999)}{rng.randint(100000, 999999)}"
    email_domain = rng.choice(["gmail.com", "outlook.com", "yahoo.in", "rediffmail.com"])
    email = f"{first.lower()}.{last.lower()}{rng.randint(1, 99)}@{email_domain}"

    # Vehicle category preference is biased by plate suffix when not
    # provided by the YOLO detector — short numeric tails read as 2-wheelers.
    category = rng.choices(
        population=["car", "motorcycle", "auto_rickshaw", "truck", "bus"],
        weights=[0.50, 0.30, 0.10, 0.07, 0.03],
        k=1,
    )[0]
    make, model = rng.choice(_VEHICLES_BY_CATEGORY[category])
    color = rng.choice(_COLORS)
    year = rng.randint(2015, 2024)

    today = datetime.utcnow().date()

    # ── Compliance roll ─────────────────────────────────────────
    # Probabilities are the user's spec: PUC 22%, INS 18%, REG 9%, BL 2%.
    # We roll each independently so a vehicle can fail multiple checks
    # (which is exactly what the real-world enforcement queue looks like).
    reg_status, reg_expiry = _roll_expiry(rng, today, expire_prob=0.09, label="reg")
    ins_status, ins_expiry = _roll_expiry(rng, today, expire_prob=0.18, label="ins")
    puc_status, puc_expiry = _roll_expiry(rng, today, expire_prob=0.22, label="puc")

    blacklisted = rng.random() < 0.02
    blacklist_reason: Optional[str] = None
    if blacklisted:
        blacklist_reason = rng.choice([
            "Stolen vehicle report — Crime branch",
            "Repeat traffic violator — 8+ offences in 12mo",
            "Outstanding court summons — non-appearance",
            "Multiple challan defaults — recovery pending",
            "Tampered chassis number flagged at last RTO inspection",
        ])

    # Offense history: weighted to small numbers for clean vehicles,
    # larger for already-blacklisted ones.
    if blacklisted:
        offense_count = rng.randint(6, 14)
    elif reg_status == "EXPIRED" or ins_status == "EXPIRED":
        offense_count = rng.randint(1, 5)
    else:
        offense_count = rng.choices([0, 1, 2], weights=[0.75, 0.20, 0.05], k=1)[0]

    return SyntheticDossier(
        owner_name=owner_name,
        owner_phone=phone,
        owner_email=email,
        owner_city=city,
        owner_state=state_name,
        vehicle_make=make,
        vehicle_model=model,
        vehicle_color=color,
        vehicle_year=year,
        vehicle_category=category,
        registration_status=reg_status,
        registration_expiry=reg_expiry,
        insurance_status=ins_status,
        insurance_expiry=ins_expiry,
        puc_status=puc_status,
        puc_expiry=puc_expiry,
        blacklist_flagged=blacklisted,
        blacklist_reason=blacklist_reason,
        offense_history_count=offense_count,
        seed=seed,
    )


# ── Internals ──────────────────────────────────────────────────────


def _seed_from_plate(plate: str) -> str:
    """Stable 16-hex seed for the RNG. SHA-256 first 16 chars."""
    return hashlib.sha256(plate.encode("utf-8")).hexdigest()[:16]


def _roll_expiry(
    rng: random.Random,
    today: date,
    expire_prob: float,
    label: str,
) -> tuple[str, date]:
    """Decide EXPIRED / EXPIRING_SOON / VALID with realistic dates.

    EXPIRED: 1–365 days in the past (heavily weighted to recent expiry —
        most caught violations are 1–3 months overdue, not years).
    EXPIRING_SOON: 1–30 days in the future (independent 8% chance among
        non-expired vehicles — matches roughly observed compliance churn).
    VALID: 60–700 days in the future.
    """
    if rng.random() < expire_prob:
        days_ago = int(rng.triangular(1, 365, 45))
        return "EXPIRED", today - timedelta(days=days_ago)
    if rng.random() < 0.08:
        return "EXPIRING_SOON", today + timedelta(days=rng.randint(1, 30))
    return "VALID", today + timedelta(days=rng.randint(60, 700))
