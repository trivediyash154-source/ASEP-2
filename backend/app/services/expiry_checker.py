"""
Vehicle document expiry validation service.

Checks registration, insurance, and pollution certificate expiry against today.
Returns a structured ViolationReport that the pipeline uses to decide
whether to issue a challan.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List, Optional

from app.core.constants import FINE_AMOUNTS, VehicleCategory
from app.core.logging import get_logger
from app.models.vehicle import Vehicle

logger = get_logger(__name__)

# Days before expiry to classify as "expiring soon" (warning — no challan)
EXPIRY_WARNING_DAYS = 30


@dataclass
class ViolationDetail:
    violation_type: str           # e.g. "expired_registration"
    description: str
    fine_amount: float
    expiry_date: Optional[date]   # The expired/missing date
    days_overdue: int             # 0 if not overdue


@dataclass
class ViolationReport:
    plate_number: str
    is_blacklisted: bool
    violations: List[ViolationDetail] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)   # Expiring soon, not yet expired

    @property
    def has_violations(self) -> bool:
        return bool(self.violations) or self.is_blacklisted

    @property
    def total_fine(self) -> float:
        base = sum(v.fine_amount for v in self.violations)
        # Double fine for second+ offense (blacklisted plates)
        if self.is_blacklisted and base > 0:
            return base + FINE_AMOUNTS.get("second_offense", 5000)
        return base

    @property
    def primary_violation(self) -> Optional[ViolationDetail]:
        """Returns the most severe violation for challan generation."""
        if not self.violations:
            return None
        return max(self.violations, key=lambda v: v.fine_amount)


def check_vehicle_expiry(vehicle: Vehicle) -> ViolationReport:
    """
    Inspect a Vehicle model instance for document violations.
    Returns a ViolationReport regardless of whether violations were found
    (empty .violations means the vehicle is compliant).
    """
    today = date.today()
    report = ViolationReport(
        plate_number=vehicle.plate_number,
        is_blacklisted=vehicle.is_blacklisted,
    )

    # Registration
    if vehicle.registration_expiry:
        _check_document(
            doc_type="registration",
            expiry=vehicle.registration_expiry,
            today=today,
            report=report,
            violation_key="expired_registration",
            description="Vehicle registration certificate has expired",
        )
    else:
        report.violations.append(ViolationDetail(
            violation_type="no_registration",
            description="No registration certificate on record",
            fine_amount=FINE_AMOUNTS.get("expired_registration", 2000),
            expiry_date=None,
            days_overdue=0,
        ))

    # Insurance
    if vehicle.insurance_expiry:
        _check_document(
            doc_type="insurance",
            expiry=vehicle.insurance_expiry,
            today=today,
            report=report,
            violation_key="expired_insurance",
            description="Vehicle third-party insurance has expired",
        )
    else:
        report.violations.append(ViolationDetail(
            violation_type="no_insurance",
            description="No insurance certificate on record",
            fine_amount=FINE_AMOUNTS.get("expired_insurance", 1500),
            expiry_date=None,
            days_overdue=0,
        ))

    # Pollution / PUC
    if vehicle.pollution_expiry:
        _check_document(
            doc_type="pollution",
            expiry=vehicle.pollution_expiry,
            today=today,
            report=report,
            violation_key="no_pollution_certificate",
            description="Pollution Under Control (PUC) certificate has expired",
        )
    # PUC absence is a warning only (some vehicle categories are exempt)

    if report.is_blacklisted:
        logger.warning(
            "blacklisted_vehicle_detected",
            plate=vehicle.plate_number,
            reason=vehicle.blacklist_reason,
        )

    logger.info(
        "vehicle_expiry_check_complete",
        plate=vehicle.plate_number,
        violations=len(report.violations),
        warnings=len(report.warnings),
        total_fine=report.total_fine,
        is_blacklisted=report.is_blacklisted,
    )

    return report


def _check_document(
    doc_type: str,
    expiry: date,
    today: date,
    report: ViolationReport,
    violation_key: str,
    description: str,
) -> None:
    if expiry < today:
        days_overdue = (today - expiry).days
        report.violations.append(ViolationDetail(
            violation_type=violation_key,
            description=f"{description} (expired {expiry}, {days_overdue} days ago)",
            fine_amount=FINE_AMOUNTS.get(violation_key, 1000),
            expiry_date=expiry,
            days_overdue=days_overdue,
        ))
    elif expiry <= today + timedelta(days=EXPIRY_WARNING_DAYS):
        days_left = (expiry - today).days
        report.warnings.append(
            f"{doc_type.title()} expires in {days_left} days ({expiry})"
        )


def check_unknown_vehicle(plate_number: str) -> ViolationReport:
    """
    Called when a plate is read but not found in the database.
    Generates a violation for unregistered vehicle — operator should
    still capture for manual review.
    """
    report = ViolationReport(
        plate_number=plate_number,
        is_blacklisted=False,
    )
    report.violations.append(ViolationDetail(
        violation_type="unregistered_vehicle",
        description=f"Plate {plate_number} not found in vehicle registry",
        fine_amount=FINE_AMOUNTS.get("expired_registration", 2000),
        expiry_date=None,
        days_overdue=0,
    ))
    return report
