"""
Multi-tier vehicle compliance engine.

For an OCR'd plate the engine runs four checks in parallel via
asyncio.gather, then composes a single ComplianceReport with a risk
score (0–100) and a machine-readable enforcement_action.

Checks:
    REGISTRATION   – vehicles.registration_expiry vs today
    INSURANCE      – vehicles.insurance_expiry vs today
    PUC            – vehicles.pollution_expiry vs today
    BLACKLIST      – vehicles.is_blacklisted + open challan registry

The four queries each open a short-lived async session so they truly run
concurrently — using a single shared session would serialize them on
the asyncpg connection lock.
"""
from __future__ import annotations

import asyncio
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import func, select

from app.core.constants import ChallanStatus
from app.core.logging import get_logger
from app.db.session import AsyncSessionFactory
from app.models.challan import Challan
from app.models.vehicle import Owner, Vehicle

logger = get_logger(__name__)


# ── Public dataclasses ───────────────────────────────────────────────


@dataclass
class CheckResult:
    status: str          # e.g. VALID, EXPIRED, MISSING, FLAGGED, CLEAR, UNKNOWN
    detail: str = ""
    expiry: Optional[date] = None

    def as_dict(self) -> dict:
        d = {"status": self.status, "detail": self.detail}
        if self.expiry is not None:
            d["expiry"] = self.expiry.isoformat()
        return d


@dataclass
class OwnerSnapshot:
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None

    def as_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class ComplianceReport:
    plate: str
    vehicle_known: bool
    risk_score: int
    enforcement_action: str
    risk_band: str  # CLEAR / LOW / MODERATE / HIGH / CRITICAL
    registration: CheckResult
    insurance: CheckResult
    puc: CheckResult
    blacklist: CheckResult
    open_violations: int = 0
    outstanding_fine_total: float = 0.0
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_color: Optional[str] = None
    vehicle_year: Optional[int] = None
    vehicle_category: Optional[str] = None
    owner: OwnerSnapshot = field(default_factory=OwnerSnapshot)

    def as_dict(self) -> dict:
        return {
            "plate": self.plate,
            "vehicle_known": self.vehicle_known,
            "risk_score": self.risk_score,
            "risk_band": self.risk_band,
            "enforcement_action": self.enforcement_action,
            "registration": self.registration.as_dict(),
            "insurance": self.insurance.as_dict(),
            "puc": self.puc.as_dict(),
            "blacklist": self.blacklist.as_dict(),
            "open_violations": self.open_violations,
            "outstanding_fine_total": float(self.outstanding_fine_total),
            "vehicle": {
                "make": self.vehicle_make,
                "model": self.vehicle_model,
                "color": self.vehicle_color,
                "year": self.vehicle_year,
                "category": self.vehicle_category,
            },
            "owner": self.owner.as_dict(),
        }


# ── Private query helpers (each opens its own session) ──────────────


async def _load_vehicle(plate: str) -> tuple[Optional[Vehicle], Optional[Owner]]:
    async with AsyncSessionFactory() as session:
        result = await session.execute(select(Vehicle).where(Vehicle.plate_number == plate))
        v = result.scalar_one_or_none()
        if v is None:
            return None, None
        owner = None
        if v.owner_id is not None:
            o_res = await session.execute(select(Owner).where(Owner.id == v.owner_id))
            owner = o_res.scalar_one_or_none()
        return v, owner


async def _check_open_violations(plate: str) -> tuple[int, float]:
    async with AsyncSessionFactory() as session:
        unpaid = await session.execute(
            select(
                func.count(),
                func.coalesce(func.sum(Challan.fine_amount), 0),
            )
            .select_from(Challan)
            .where(
                Challan.plate_number == plate,
                Challan.status.in_([ChallanStatus.ISSUED, ChallanStatus.OVERDUE, ChallanStatus.DISPUTED]),
            )
        )
        row = unpaid.one()
        return int(row[0] or 0), float(row[1] or 0)


def _expiry_check(label: str, expiry: Optional[date], today: date) -> CheckResult:
    if expiry is None:
        return CheckResult(status="MISSING", detail=f"{label} record not on file")
    days_left = (expiry - today).days
    if days_left < 0:
        return CheckResult(
            status="EXPIRED",
            expiry=expiry,
            detail=f"{label} expired {abs(days_left)} day(s) ago",
        )
    if days_left <= 30:
        return CheckResult(
            status="EXPIRING_SOON",
            expiry=expiry,
            detail=f"{label} expires in {days_left} day(s)",
        )
    return CheckResult(status="VALID", expiry=expiry, detail=f"{label} valid for {days_left} more day(s)")


# ── Risk scoring ────────────────────────────────────────────────────


def _compose(
    vehicle: Optional[Vehicle],
    owner: Optional[Owner],
    open_violations: int,
    outstanding_fine: float,
    plate: str,
) -> ComplianceReport:
    today = datetime.utcnow().date()

    if vehicle is None:
        # Plate not in registry — high risk by default
        unknown = CheckResult(status="UNKNOWN", detail="Plate not in registry")
        report = ComplianceReport(
            plate=plate,
            vehicle_known=False,
            risk_score=72,
            risk_band="HIGH",
            enforcement_action="VERIFY_OWNER",
            registration=CheckResult(status="UNKNOWN", detail="No registration record"),
            insurance=unknown,
            puc=unknown,
            blacklist=CheckResult(status="UNKNOWN", detail="Cannot verify watchlist"),
        )
        return report

    registration = _expiry_check("Registration", vehicle.registration_expiry, today)
    insurance = _expiry_check("Insurance", vehicle.insurance_expiry, today)
    puc = _expiry_check("PUC", vehicle.pollution_expiry, today)

    if vehicle.is_blacklisted:
        blacklist = CheckResult(
            status="FLAGGED",
            detail=vehicle.blacklist_reason or "Vehicle on enforcement watchlist",
        )
    elif open_violations > 0:
        blacklist = CheckResult(
            status="OUTSTANDING",
            detail=f"{open_violations} unpaid challan(s) totaling ₹{int(outstanding_fine):,}",
        )
    else:
        blacklist = CheckResult(status="CLEAR", detail="No active watchlist record")

    # ── Risk score ──────────────────────────────────────────
    score = 0
    if vehicle.is_blacklisted:
        score += 55
    if registration.status == "EXPIRED":
        score += 25
    elif registration.status == "EXPIRING_SOON":
        score += 6
    if insurance.status == "EXPIRED":
        score += 20
    elif insurance.status == "EXPIRING_SOON":
        score += 4
    if puc.status == "EXPIRED":
        score += 12
    elif puc.status == "EXPIRING_SOON":
        score += 3
    if open_violations >= 5:
        score += 18
    elif open_violations >= 1:
        score += 8
    if outstanding_fine >= 10000:
        score += 8
    score = min(score, 100)

    band = (
        "CRITICAL" if score >= 80 else
        "HIGH"     if score >= 55 else
        "MODERATE" if score >= 30 else
        "LOW"      if score >= 10 else
        "CLEAR"
    )
    action = (
        "IMPOUND_RECOMMENDED" if score >= 85 else
        "CITATE_AND_FLAG"     if score >= 55 else
        "ISSUE_CHALLAN"       if score >= 30 else
        "ADVISE_ONLY"         if score >= 10 else
        "PASS"
    )

    return ComplianceReport(
        plate=plate,
        vehicle_known=True,
        risk_score=score,
        risk_band=band,
        enforcement_action=action,
        registration=registration,
        insurance=insurance,
        puc=puc,
        blacklist=blacklist,
        open_violations=open_violations,
        outstanding_fine_total=outstanding_fine,
        vehicle_make=vehicle.make,
        vehicle_model=vehicle.model_name,
        vehicle_color=vehicle.color,
        vehicle_year=vehicle.year,
        vehicle_category=vehicle.category.value if vehicle.category else None,
        owner=OwnerSnapshot(
            name=owner.name if owner else None,
            phone=owner.phone if owner else None,
            email=owner.email if owner else None,
            city=owner.city if owner else None,
            state=owner.state if owner else None,
        ),
    )


# ── Public entry point ─────────────────────────────────────────────


async def assess_compliance(plate: str) -> ComplianceReport:
    """Run all 4 checks concurrently, fold into a single report."""
    plate_norm = "".join(ch for ch in plate.upper() if ch.isalnum())
    if not plate_norm:
        return _compose(None, None, 0, 0.0, plate or "")

    vehicle_load, open_violations_load = await asyncio.gather(
        _load_vehicle(plate_norm),
        _check_open_violations(plate_norm),
        return_exceptions=False,
    )
    vehicle, owner = vehicle_load
    open_n, outstanding = open_violations_load

    return _compose(vehicle, owner, open_n, outstanding, plate_norm)
