"""
Curated demo cases for Controlled Replay mode.

Each case is a deterministic scenario covering one slice of the enforcement
surface — clean compliance, expired insurance/registration/PUC, blacklist,
repeat offender, stolen, low-confidence OCR, night capture, motion blur.

Replay flow:

1. Operator picks a case (or uploads an image, which is matched against the
   nearest case fingerprint).
2. demo_replay.run() walks through a fixed-cost stage timeline:
       capture · vehicle_localized · plate_isolated · ocr · registry
       lookup · compliance · threat_scoring · evidence · challan ·
       notification
   Each stage has a realistic latency budget — the frontend uses these
   timings to animate.
3. The Detection row is persisted with the case's pre-computed outcomes,
   so dashboards and analytics update naturally.
4. If the case's `is_violation` is true, a Challan row is also created.

The point of the curated dataset is *reliability*, not realism — for the
high-stakes demo we want the same evidence to surface the same outcome
every single time, while still exercising the genuine DB / WS / challan
plumbing.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class DemoStage:
    """One step in the pipeline timeline. `latency_ms` is what the frontend
    animates against — it is *not* a real timer (real runs are faster)."""
    key: str
    label: str
    latency_ms: int
    detail: str


@dataclass(frozen=True)
class DemoCase:
    id: str                       # stable kebab-case ID, used in URLs
    title: str
    subtitle: str
    image: str                    # path under /demo-assets/cases/
    thumbnail_caption: str

    plate: str
    vehicle_category: str         # matches VehicleCategory.value
    vehicle_make: str
    vehicle_model: str
    vehicle_color: str
    vehicle_year: int

    owner_name: str
    owner_phone: str
    owner_email: str
    owner_city: str

    is_violation: bool
    violation_type: Optional[str]   # None for clean
    fine_amount_inr: int
    severity: str                 # "info" | "low" | "medium" | "high" | "critical"

    threat_score: int             # 0–100
    ocr_confidence: float         # 0.0–1.0
    vehicle_confidence: float
    plate_confidence: float
    frame_quality: float          # 0.0–1.0 — affects "Frame quality" telemetry
    ocr_engine: str               # "EasyOCR" | "PaddleOCR" | "Consensus"

    compliance: dict              # {registration, insurance, puc, blacklist} booleans (True=valid)
    history: dict                 # {detections_30d, repeat_offences, last_district, encounter_history[]}

    location: str
    camera_code: str

    stages: list[DemoStage] = field(default_factory=list)


# ── Stage builder ────────────────────────────────────────────────────


def _stages(*, ocr_latency: int, threat: int, has_violation: bool) -> list[DemoStage]:
    """Standard 10-stage timeline with per-case tuning. Total ~2.3-2.8s of
    animation — long enough for judges to read each step, short enough to
    feel real."""
    return [
        DemoStage("capture",              "Frame captured",             140, "Decoded · 1920×1080 · H.264 keyframe"),
        DemoStage("vehicle_localized",    "Vehicle localized",          220, "YOLOv8 · bbox refined · NMS pass"),
        DemoStage("plate_isolated",       "Plate region isolated",      180, "Geometric crop · CLAHE · deskew"),
        DemoStage("ocr",                  "OCR reconstruction",         ocr_latency, "EasyOCR + PaddleOCR · consensus vote"),
        DemoStage("registry_lookup",      "Registry lookup",            240, "Postgres · pg_trgm fuzzy match"),
        DemoStage("compliance",           "Compliance verification",    280, "Registration · insurance · PUC · blacklist"),
        DemoStage("threat_scoring",       "Threat classification",      170, f"Risk score {threat}/100 · pattern analysis"),
        DemoStage("evidence",             "Evidence package generated", 220, "Annotated frame · plate crop · SHA-256 sealed"),
        DemoStage("challan",              "Challan issued" if has_violation else "No violation — clean pass", 260,
                  "ReportLab PDF · fine schedule · MV Act mapping" if has_violation
                  else "All compliance signals green · audit-logged"),
        DemoStage("notification",         "Notification dispatched" if has_violation else "Telemetry committed", 180,
                  "Twilio SMS · SMTP · operator console push" if has_violation
                  else "WS broadcast · detection persisted"),
    ]


# ── 10 curated cases ────────────────────────────────────────────────

CASES: list[DemoCase] = [
    # 1 — Expired insurance (high-impact, common)
    DemoCase(
        id="expired-insurance-mumbai",
        title="Expired insurance — IRDA mismatch",
        subtitle="WEH · Andheri East corridor · 14:32 IST",
        image="/demo-assets/cases/01-expired-insurance.svg",
        thumbnail_caption="Hyundai Creta · MH02JK4471",
        plate="MH02JK4471",
        vehicle_category="car",
        vehicle_make="Hyundai", vehicle_model="Creta",
        vehicle_color="White", vehicle_year=2022,
        owner_name="Anjali Sharma", owner_phone="+918879342201",
        owner_email="anjali.sharma221@example.in", owner_city="Mumbai",
        is_violation=True, violation_type="Expired Insurance",
        fine_amount_inr=2000, severity="medium", threat_score=42,
        ocr_confidence=0.953, vehicle_confidence=0.918, plate_confidence=0.882,
        frame_quality=0.92, ocr_engine="Consensus",
        compliance={"registration": True, "insurance": False, "puc": True, "blacklist": False},
        history={"detections_30d": 2, "repeat_offences": 0, "last_district": "Andheri E",
                 "encounter_history": [
                     {"date": "2026-05-12", "camera": "MUM-WEH-04", "result": "Clean pass"},
                     {"date": "2026-04-30", "camera": "MUM-BWS-01", "result": "Clean pass"},
                 ]},
        location="Western Express Hwy, Andheri E",
        camera_code="MUM-WEH-04",
        stages=_stages(ocr_latency=210, threat=42, has_violation=True),
    ),
    # 2 — Expired registration
    DemoCase(
        id="expired-registration-thane",
        title="Expired registration — RTO lapse",
        subtitle="Vashi Bridge · 09:18 IST",
        image="/demo-assets/cases/02-expired-registration.svg",
        thumbnail_caption="Tata Nexon · MH43AF4164",
        plate="MH43AF4164",
        vehicle_category="car",
        vehicle_make="Tata", vehicle_model="Nexon",
        vehicle_color="Red", vehicle_year=2019,
        owner_name="Rohan Mehta", owner_phone="+919833114205",
        owner_email="rohan.mehta54@example.in", owner_city="Thane",
        is_violation=True, violation_type="Expired Registration",
        fine_amount_inr=5000, severity="high", threat_score=64,
        ocr_confidence=0.927, vehicle_confidence=0.901, plate_confidence=0.857,
        frame_quality=0.89, ocr_engine="Consensus",
        compliance={"registration": False, "insurance": True, "puc": True, "blacklist": False},
        history={"detections_30d": 4, "repeat_offences": 1, "last_district": "Thane",
                 "encounter_history": [
                     {"date": "2026-05-19", "camera": "MUM-VSH-03", "result": "Expired Registration"},
                     {"date": "2026-05-04", "camera": "MUM-EEH-07", "result": "Clean pass"},
                     {"date": "2026-04-22", "camera": "MUM-LBS-02", "result": "Clean pass"},
                 ]},
        location="Thane–Belapur Rd, Vashi Bridge",
        camera_code="MUM-VSH-03",
        stages=_stages(ocr_latency=190, threat=64, has_violation=True),
    ),
    # 3 — Expired PUC
    DemoCase(
        id="expired-puc-pune",
        title="Expired PUC — emissions non-compliance",
        subtitle="Powai · Hiranandani Main Rd · 11:04 IST",
        image="/demo-assets/cases/03-expired-puc.svg",
        thumbnail_caption="Maruti Suzuki Swift · MH12RZ2267",
        plate="MH12RZ2267",
        vehicle_category="car",
        vehicle_make="Maruti Suzuki", vehicle_model="Swift",
        vehicle_color="Silver", vehicle_year=2021,
        owner_name="Karan Joshi", owner_phone="+917720114488",
        owner_email="karan.joshi408@example.in", owner_city="Pune",
        is_violation=True, violation_type="Expired Pollution Cert",
        fine_amount_inr=1500, severity="low", threat_score=28,
        ocr_confidence=0.971, vehicle_confidence=0.934, plate_confidence=0.904,
        frame_quality=0.95, ocr_engine="EasyOCR",
        compliance={"registration": True, "insurance": True, "puc": False, "blacklist": False},
        history={"detections_30d": 1, "repeat_offences": 0, "last_district": "Powai",
                 "encounter_history": [
                     {"date": "2026-05-10", "camera": "MUM-PHG-01", "result": "Clean pass"},
                 ]},
        location="Hiranandani Gardens Main Rd, Powai",
        camera_code="MUM-PHG-01",
        stages=_stages(ocr_latency=160, threat=28, has_violation=True),
    ),
    # 4 — Blacklisted (toll evasion)
    DemoCase(
        id="blacklist-toll-evasion",
        title="Blacklist hit — toll evasion ring",
        subtitle="Bandra-Worli Sea Link · 22:47 IST",
        image="/demo-assets/cases/04-blacklist-toll.svg",
        thumbnail_caption="Mahindra XUV700 · MH01BU2433",
        plate="MH01BU2433",
        vehicle_category="car",
        vehicle_make="Mahindra", vehicle_model="XUV700",
        vehicle_color="Black", vehicle_year=2023,
        owner_name="Imran Khan", owner_phone="+919892334155",
        owner_email="imran.khan88@example.in", owner_city="Mumbai",
        is_violation=True, violation_type="Blacklisted Vehicle",
        fine_amount_inr=10000, severity="critical", threat_score=88,
        ocr_confidence=0.896, vehicle_confidence=0.872, plate_confidence=0.821,
        frame_quality=0.78, ocr_engine="Consensus",
        compliance={"registration": True, "insurance": True, "puc": True, "blacklist": True},
        history={"detections_30d": 7, "repeat_offences": 4, "last_district": "Bandra W",
                 "encounter_history": [
                     {"date": "2026-05-23", "camera": "MUM-BWS-01", "result": "Blacklisted Vehicle"},
                     {"date": "2026-05-18", "camera": "MUM-WSF-01", "result": "Blacklisted Vehicle"},
                     {"date": "2026-05-09", "camera": "MUM-MAR-02", "result": "Blacklisted Vehicle"},
                     {"date": "2026-05-02", "camera": "MUM-BWS-02", "result": "Blacklisted Vehicle"},
                 ]},
        location="Bandra-Worli Sea Link, S-Tower",
        camera_code="MUM-BWS-01",
        stages=_stages(ocr_latency=240, threat=88, has_violation=True),
    ),
    # 5 — Clean compliance
    DemoCase(
        id="clean-compliance",
        title="Clean compliance — all signals green",
        subtitle="Marine Drive · 16:55 IST",
        image="/demo-assets/cases/05-clean-compliance.svg",
        thumbnail_caption="Honda City · MH01CG7821",
        plate="MH01CG7821",
        vehicle_category="car",
        vehicle_make="Honda", vehicle_model="City",
        vehicle_color="White", vehicle_year=2024,
        owner_name="Meera Iyer", owner_phone="+919821467701",
        owner_email="meera.iyer311@example.in", owner_city="Mumbai",
        is_violation=False, violation_type=None,
        fine_amount_inr=0, severity="info", threat_score=8,
        ocr_confidence=0.988, vehicle_confidence=0.961, plate_confidence=0.937,
        frame_quality=0.98, ocr_engine="EasyOCR",
        compliance={"registration": True, "insurance": True, "puc": True, "blacklist": False},
        history={"detections_30d": 0, "repeat_offences": 0, "last_district": "Marine Drive",
                 "encounter_history": []},
        location="Marine Drive, opp. Air India Bldg",
        camera_code="MUM-MAR-02",
        stages=_stages(ocr_latency=140, threat=8, has_violation=False),
    ),
    # 6 — Repeat offender escalation
    DemoCase(
        id="repeat-offender-escalation",
        title="Repeat offender — 2nd-offence escalation",
        subtitle="Eastern Express Hwy · Sion Junction · 18:11 IST",
        image="/demo-assets/cases/06-repeat-offender.svg",
        thumbnail_caption="Bajaj Pulsar 150 · MH14DA9087",
        plate="MH14DA9087",
        vehicle_category="motorcycle",
        vehicle_make="Bajaj", vehicle_model="Pulsar 150",
        vehicle_color="Blue", vehicle_year=2020,
        owner_name="Siddharth Roy", owner_phone="+917020884412",
        owner_email="siddharth.roy90@example.in", owner_city="Mumbai",
        is_violation=True, violation_type="Expired Insurance",
        fine_amount_inr=4000, severity="high", threat_score=71,
        ocr_confidence=0.914, vehicle_confidence=0.882, plate_confidence=0.848,
        frame_quality=0.86, ocr_engine="Consensus",
        compliance={"registration": True, "insurance": False, "puc": True, "blacklist": False},
        history={"detections_30d": 5, "repeat_offences": 3, "last_district": "Sion",
                 "encounter_history": [
                     {"date": "2026-05-20", "camera": "MUM-EEH-07", "result": "Expired Insurance"},
                     {"date": "2026-05-11", "camera": "MUM-LBS-02", "result": "Expired Insurance"},
                     {"date": "2026-04-29", "camera": "MUM-VSH-03", "result": "Expired Insurance"},
                 ]},
        location="Eastern Express Hwy, Sion Junction",
        camera_code="MUM-EEH-07",
        stages=_stages(ocr_latency=200, threat=71, has_violation=True),
    ),
    # 7 — Stolen vehicle (BOLO match)
    DemoCase(
        id="stolen-vehicle-bolo",
        title="Stolen vehicle — BOLO match",
        subtitle="Juhu Tara Rd · 03:22 IST",
        image="/demo-assets/cases/07-stolen-vehicle.svg",
        thumbnail_caption="Royal Enfield Classic 350 · MH04QX3308",
        plate="MH04QX3308",
        vehicle_category="motorcycle",
        vehicle_make="Royal Enfield", vehicle_model="Classic 350",
        vehicle_color="Black", vehicle_year=2021,
        owner_name="Pooja Kapoor", owner_phone="+919819220033",
        owner_email="pooja.kapoor117@example.in", owner_city="Mumbai",
        is_violation=True, violation_type="Blacklisted Vehicle",
        fine_amount_inr=10000, severity="critical", threat_score=96,
        ocr_confidence=0.872, vehicle_confidence=0.848, plate_confidence=0.792,
        frame_quality=0.74, ocr_engine="Consensus",
        compliance={"registration": True, "insurance": True, "puc": True, "blacklist": True},
        history={"detections_30d": 1, "repeat_offences": 0, "last_district": "Juhu",
                 "encounter_history": [
                     {"date": "2026-05-22", "camera": "MUM-JTR-02", "result": "Stolen — BOLO"},
                 ]},
        location="Juhu Tara Rd, opp. Holiday Inn",
        camera_code="MUM-JTR-02",
        stages=_stages(ocr_latency=260, threat=96, has_violation=True),
    ),
    # 8 — Low-confidence OCR (consensus saves the read)
    DemoCase(
        id="low-confidence-ocr",
        title="Low-confidence OCR — consensus recovery",
        subtitle="Linking Rd, Khar W · 19:48 IST",
        image="/demo-assets/cases/08-low-confidence-ocr.svg",
        thumbnail_caption="Honda Activa 6G · MH05BL5519",
        plate="MH05BL5519",
        vehicle_category="motorcycle",
        vehicle_make="Honda", vehicle_model="Activa 6G",
        vehicle_color="Grey", vehicle_year=2022,
        owner_name="Tanvi Bhatt", owner_phone="+918452201144",
        owner_email="tanvi.bhatt208@example.in", owner_city="Mumbai",
        is_violation=False, violation_type=None,
        fine_amount_inr=0, severity="info", threat_score=12,
        ocr_confidence=0.728, vehicle_confidence=0.811, plate_confidence=0.671,
        frame_quality=0.62, ocr_engine="Consensus",
        compliance={"registration": True, "insurance": True, "puc": True, "blacklist": False},
        history={"detections_30d": 0, "repeat_offences": 0, "last_district": "Khar W",
                 "encounter_history": []},
        location="Linking Rd, Khar W Pali Naka",
        camera_code="MUM-LNK-05",
        stages=_stages(ocr_latency=380, threat=12, has_violation=False),
    ),
    # 9 — Night capture (low-light pipeline)
    DemoCase(
        id="night-capture-low-light",
        title="Night capture — low-light enhancement",
        subtitle="Worli Sea Face · 23:58 IST",
        image="/demo-assets/cases/09-night-capture.svg",
        thumbnail_caption="Toyota Innova · MH03LD6042",
        plate="MH03LD6042",
        vehicle_category="car",
        vehicle_make="Toyota", vehicle_model="Innova",
        vehicle_color="Grey", vehicle_year=2020,
        owner_name="Vikram Singh", owner_phone="+919819774488",
        owner_email="vikram.singh412@example.in", owner_city="Mumbai",
        is_violation=True, violation_type="Expired Pollution Cert",
        fine_amount_inr=1500, severity="low", threat_score=34,
        ocr_confidence=0.842, vehicle_confidence=0.789, plate_confidence=0.762,
        frame_quality=0.55, ocr_engine="EasyOCR",
        compliance={"registration": True, "insurance": True, "puc": False, "blacklist": False},
        history={"detections_30d": 2, "repeat_offences": 0, "last_district": "Worli",
                 "encounter_history": [
                     {"date": "2026-05-21", "camera": "MUM-WSF-01", "result": "Clean pass"},
                     {"date": "2026-05-08", "camera": "MUM-BWS-02", "result": "Clean pass"},
                 ]},
        location="Worli Sea Face Promenade",
        camera_code="MUM-WSF-01",
        stages=_stages(ocr_latency=290, threat=34, has_violation=True),
    ),
    # 10 — Motion blur (high-speed capture)
    DemoCase(
        id="motion-blur-high-speed",
        title="Motion blur — high-speed corridor",
        subtitle="WEH · Andheri East · 08:09 IST",
        image="/demo-assets/cases/10-motion-blur.svg",
        thumbnail_caption="Hyundai i20 · MH47PH7733",
        plate="MH47PH7733",
        vehicle_category="car",
        vehicle_make="Hyundai", vehicle_model="i20",
        vehicle_color="Blue", vehicle_year=2023,
        owner_name="Nikhil Verma", owner_phone="+917040881122",
        owner_email="nikhil.verma552@example.in", owner_city="Mumbai",
        is_violation=False, violation_type=None,
        fine_amount_inr=0, severity="info", threat_score=18,
        ocr_confidence=0.798, vehicle_confidence=0.752, plate_confidence=0.701,
        frame_quality=0.51, ocr_engine="Consensus",
        compliance={"registration": True, "insurance": True, "puc": True, "blacklist": False},
        history={"detections_30d": 1, "repeat_offences": 0, "last_district": "Andheri E",
                 "encounter_history": [
                     {"date": "2026-05-14", "camera": "MUM-WEH-04", "result": "Clean pass"},
                 ]},
        location="Western Express Hwy, Andheri E",
        camera_code="MUM-WEH-04",
        stages=_stages(ocr_latency=320, threat=18, has_violation=False),
    ),
]

CASE_INDEX: dict[str, DemoCase] = {c.id: c for c in CASES}


def get_case(case_id: str) -> Optional[DemoCase]:
    return CASE_INDEX.get(case_id)


def list_cases() -> list[DemoCase]:
    return list(CASES)
