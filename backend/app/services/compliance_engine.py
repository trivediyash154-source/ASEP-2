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
import os
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Optional

from sqlalchemy import func, select

from app.core.constants import ChallanStatus
from app.core.logging import get_logger
from app.db.session import AsyncSessionFactory
from app.models.challan import Challan
from app.models.vehicle import Owner, Vehicle
from app.services.staged_plates import match_staged
from app.services.synthetic_dossier import generate_synthetic_dossier

logger = get_logger(__name__)

# Staged-plate registry toggle (see app/services/staged_plates.py). ON in dev so
# the printed demo plates resolve to their scripted outcomes; turn OFF in prod.
_STAGED_ENABLED = os.getenv("DEMO_STAGED_PLATES", "true").strip().lower() in ("1", "true", "yes", "on")


# Risk at/above which a vehicle is escalated to a critical alert regardless of
# which individual document triggered it.
CRITICAL_RISK_THRESHOLD = 80

# Enforcement outcome taxonomy — the high-level, operator-facing decision.
# Distinct from `enforcement_action` (the internal severity ladder): the
# outcome is what the UI shows and what gates automatic challan issuance. The
# key rule: a clean but unregistered vehicle is sent to MANUAL_REVIEW, never
# auto-fined — its identity is unverified.
OUTCOME_CLEAR = "CLEAR"
OUTCOME_WARNING = "WARNING"
OUTCOME_MANUAL_REVIEW = "MANUAL_REVIEW"
OUTCOME_CHALLAN = "CHALLAN"
OUTCOME_CRITICAL_ALERT = "CRITICAL_ALERT"

# Outcomes that justify an automatic challan.
CHALLANABLE_OUTCOMES = (OUTCOME_CHALLAN, OUTCOME_CRITICAL_ALERT)


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
    # True when the dossier was built by the synthetic engine (no DB row).
    # Frontend can render a small "Synthetic intel" pill, analytics can
    # split real-registry signals from generated ones.
    is_synthetic: bool = False
    # True for scripted staged-demo plates. Bypasses the OCR-confidence challan
    # gate (the outcome is operator-controlled, not OCR-derived).
    is_staged: bool = False
    # High-level enforcement decision (see OUTCOME_* constants) plus a plain
    # explanation an operator/examiner can read. Auto-challan is gated on this,
    # NOT on the raw risk score — so a clean unregistered vehicle routes to
    # manual verification instead of being auto-fined.
    enforcement_outcome: str = OUTCOME_CLEAR
    enforcement_reason: str = ""

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
            "is_synthetic": self.is_synthetic,
            "is_staged": self.is_staged,
            "enforcement_outcome": self.enforcement_outcome,
            "enforcement_reason": self.enforcement_reason,
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


# ── Enforcement decision ────────────────────────────────────────────


def _decide_enforcement(
    *,
    vehicle_known: bool,
    is_synthetic: bool,
    risk_score: int,
    registration: CheckResult,
    insurance: CheckResult,
    puc: CheckResult,
    blacklist: CheckResult,
    open_violations: int,
) -> tuple[str, str]:
    """Map compliance facts → (outcome, human-readable reason).

    Precedence, most severe first:
      CRITICAL_ALERT  watchlist hit, or risk >= CRITICAL_RISK_THRESHOLD
      CHALLAN         registration or insurance expired (fineable offence)
      WARNING         PUC expired, any document expiring soon, outstanding fines
      MANUAL_REVIEW   unregistered/synthetic vehicle that is otherwise clean
      CLEAR           known vehicle, all documents valid

    Only CRITICAL_ALERT and CHALLAN justify an automatic challan. A clean but
    unregistered vehicle is never auto-fined — its identity is unverified, so
    it routes to manual verification.
    """
    reg_expired = registration.status == "EXPIRED"
    ins_expired = insurance.status == "EXPIRED"
    flagged = blacklist.status == "FLAGGED"

    if flagged:
        return OUTCOME_CRITICAL_ALERT, f"Watchlist hit — {blacklist.detail or 'vehicle flagged'}"
    if risk_score >= CRITICAL_RISK_THRESHOLD:
        drivers = [d for d, on in (
            ("registration expired", reg_expired),
            ("insurance expired", ins_expired),
        ) if on] or ["multiple compliance failures"]
        return OUTCOME_CRITICAL_ALERT, f"Critical risk {risk_score}/100 — {', '.join(drivers)}"

    if reg_expired or ins_expired:
        parts = []
        if reg_expired:
            parts.append(registration.detail or "registration expired")
        if ins_expired:
            parts.append(insurance.detail or "insurance expired")
        return OUTCOME_CHALLAN, "; ".join(parts)

    warnings: list[str] = []
    if puc.status == "EXPIRED":
        warnings.append(puc.detail or "PUC certificate expired")
    for label, chk in (("Registration", registration), ("Insurance", insurance), ("PUC", puc)):
        if chk.status == "EXPIRING_SOON":
            warnings.append(chk.detail or f"{label} expiring soon")
    if open_violations > 0:
        warnings.append(f"{open_violations} outstanding challan(s) on record")
    if warnings:
        return OUTCOME_WARNING, "; ".join(warnings)

    if is_synthetic or not vehicle_known:
        return (
            OUTCOME_MANUAL_REVIEW,
            "Plate not found in registry — manual verification required before any enforcement action",
        )

    return OUTCOME_CLEAR, "All documents valid; no enforcement action required"


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
        # Plate not in demo registry → fall through to the synthetic
        # dossier so the operator console always shows a believable
        # intelligence card instead of a generic "UNKNOWN" stub. The
        # report is flagged `is_synthetic=True` so analytics and the
        # frontend can distinguish it from real-registry hits.
        return _compose_from_synthetic(plate, open_violations, outstanding_fine)

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

    outcome, reason = _decide_enforcement(
        vehicle_known=True,
        is_synthetic=False,
        risk_score=score,
        registration=registration,
        insurance=insurance,
        puc=puc,
        blacklist=blacklist,
        open_violations=open_violations,
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
        enforcement_outcome=outcome,
        enforcement_reason=reason,
    )


# ── Synthetic-dossier path ─────────────────────────────────────────


def _synthetic_check(label: str, status: str, expiry: date) -> CheckResult:
    """Build a CheckResult from synthetic status + expiry date, with the
    same human-readable detail string the real path emits."""
    today = datetime.utcnow().date()
    days = (expiry - today).days
    if status == "EXPIRED":
        return CheckResult(
            status="EXPIRED",
            expiry=expiry,
            detail=f"{label} expired {abs(days)} day(s) ago",
        )
    if status == "EXPIRING_SOON":
        return CheckResult(
            status="EXPIRING_SOON",
            expiry=expiry,
            detail=f"{label} expires in {days} day(s)",
        )
    return CheckResult(
        status="VALID",
        expiry=expiry,
        detail=f"{label} valid for {days} more day(s)",
    )


def _compose_from_synthetic(
    plate: str,
    open_violations: int,
    outstanding_fine: float,
) -> ComplianceReport:
    """Build a ComplianceReport entirely from the synthetic dossier.

    Risk scoring uses the exact same weights as the real path so the
    operator console can't tell a synthetic dossier from a real one by
    looking at the score. The single distinguishing field is
    `is_synthetic=True` on the report itself.
    """
    dossier = generate_synthetic_dossier(plate)

    registration = _synthetic_check("Registration", dossier.registration_status, dossier.registration_expiry)
    insurance    = _synthetic_check("Insurance",    dossier.insurance_status,    dossier.insurance_expiry)
    puc          = _synthetic_check("PUC",          dossier.puc_status,          dossier.puc_expiry)

    if dossier.blacklist_flagged:
        blacklist = CheckResult(
            status="FLAGGED",
            detail=dossier.blacklist_reason or "Vehicle on enforcement watchlist",
        )
    elif dossier.offense_history_count > 0:
        blacklist = CheckResult(
            status="OUTSTANDING",
            detail=f"{dossier.offense_history_count} prior violation(s) on file",
        )
    else:
        blacklist = CheckResult(status="CLEAR", detail="No active watchlist record")

    # Unregistered-but-clean vehicles are NOT auto-escalated. The only baseline
    # contribution is a small "not in registry" uncertainty; the real document
    # failures below drive the score exactly as they do on the registry path.
    # (Previously this base was 55, which forced every unknown plate to HIGH →
    # auto-challan — unrealistic. The MANUAL_REVIEW outcome now handles the
    # "unverified identity" concern instead.)
    score = 12
    if dossier.blacklist_flagged:
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
    if dossier.offense_history_count >= 5:
        score += 18
    elif dossier.offense_history_count >= 1:
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

    outcome, reason = _decide_enforcement(
        vehicle_known=False,
        is_synthetic=True,
        risk_score=score,
        registration=registration,
        insurance=insurance,
        puc=puc,
        blacklist=blacklist,
        open_violations=open_violations,
    )

    return ComplianceReport(
        plate=plate,
        # vehicle_known stays False — analytics relies on this flag to
        # distinguish real-registry hits from synthetic dossiers when
        # computing population health metrics.
        vehicle_known=False,
        risk_score=score,
        risk_band=band,
        enforcement_action=action,
        registration=registration,
        insurance=insurance,
        puc=puc,
        blacklist=blacklist,
        open_violations=open_violations,
        outstanding_fine_total=outstanding_fine,
        vehicle_make=dossier.vehicle_make,
        vehicle_model=dossier.vehicle_model,
        vehicle_color=dossier.vehicle_color,
        vehicle_year=dossier.vehicle_year,
        vehicle_category=dossier.vehicle_category,
        owner=OwnerSnapshot(
            name=dossier.owner_name,
            phone=dossier.owner_phone,
            email=dossier.owner_email,
            city=dossier.owner_city,
            state=dossier.owner_state,
        ),
        is_synthetic=True,
        enforcement_outcome=outcome,
        enforcement_reason=reason,
    )


# ── Staged-plate path (scripted demo outcomes) ─────────────────────


def _staged_check(label: str, status: str, days: int) -> CheckResult:
    """Build a CheckResult from a staged (status, day-offset) tuple.
    days < 0 => expired |days| ago; days > 0 => valid/expiring that many days out."""
    expiry = datetime.utcnow().date() + timedelta(days=days)
    if status == "EXPIRED":
        return CheckResult(status="EXPIRED", expiry=expiry, detail=f"{label} expired {abs(days)} day(s) ago")
    if status == "EXPIRING_SOON":
        return CheckResult(status="EXPIRING_SOON", expiry=expiry, detail=f"{label} expires in {days} day(s)")
    return CheckResult(status="VALID", expiry=expiry, detail=f"{label} valid for {days} more day(s)")


def _compose_staged(canonical: str, spec: dict) -> ComplianceReport:
    """Build a fully-scripted ComplianceReport for a staged demo plate.

    Owner/vehicle fields come from the deterministic synthetic dossier so the
    card looks real; the four checks, score, band, and outcome are taken
    verbatim from the spec so the on-stage story is exact and repeatable.
    Presented as a known registry hit (no 'synthetic' pill) — these are the
    operator's controlled props.
    """
    dossier = generate_synthetic_dossier(canonical)

    registration = _staged_check("Registration", *spec["registration"])
    insurance = _staged_check("Insurance", *spec["insurance"])
    puc = _staged_check("PUC", *spec["puc"])
    if spec.get("blacklist_flagged"):
        blacklist = CheckResult(status="FLAGGED", detail=spec.get("blacklist_reason") or "Vehicle on enforcement watchlist")
    else:
        blacklist = CheckResult(status="CLEAR", detail="No active watchlist record")

    score = int(spec["risk_score"])
    action = (
        "IMPOUND_RECOMMENDED" if score >= 85 else
        "CITATE_AND_FLAG"     if score >= 55 else
        "ISSUE_CHALLAN"       if score >= 30 else
        "ADVISE_ONLY"         if score >= 10 else
        "PASS"
    )
    return ComplianceReport(
        plate=canonical,
        vehicle_known=True,
        risk_score=score,
        risk_band=spec["risk_band"],
        enforcement_action=action,
        registration=registration,
        insurance=insurance,
        puc=puc,
        blacklist=blacklist,
        open_violations=1 if spec.get("violation_label") else 0,
        outstanding_fine_total=0.0,
        vehicle_make=dossier.vehicle_make,
        vehicle_model=dossier.vehicle_model,
        vehicle_color=dossier.vehicle_color,
        vehicle_year=dossier.vehicle_year,
        vehicle_category=dossier.vehicle_category,
        owner=OwnerSnapshot(
            name=dossier.owner_name,
            phone=dossier.owner_phone,
            email=dossier.owner_email,
            city=dossier.owner_city,
            state=dossier.owner_state,
        ),
        is_synthetic=False,
        is_staged=True,
        enforcement_outcome=spec["outcome"],
        enforcement_reason=spec["reason"],
    )


# ── Public entry point ─────────────────────────────────────────────


async def assess_compliance(plate: str) -> ComplianceReport:
    """Run all 4 checks concurrently, fold into a single report."""
    plate_norm = "".join(ch for ch in plate.upper() if ch.isalnum())
    if not plate_norm:
        return _compose(None, None, 0, 0.0, plate or "")

    # Staged demo plates win first — scripted, repeatable outcomes for the stage.
    if _STAGED_ENABLED:
        staged = match_staged(plate_norm)
        if staged is not None:
            canonical, spec = staged
            logger.info(
                "compliance_staged_plate_hit",
                read=plate_norm, canonical=canonical, scenario=spec.get("scenario"),
            )
            return _compose_staged(canonical, spec)

    vehicle_load, open_violations_load = await asyncio.gather(
        _load_vehicle(plate_norm),
        _check_open_violations(plate_norm),
        return_exceptions=False,
    )
    vehicle, owner = vehicle_load
    open_n, outstanding = open_violations_load

    return _compose(vehicle, owner, open_n, outstanding, plate_norm)
