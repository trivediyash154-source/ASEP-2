"""Unit tests for synthetic compliance dossier scoring baseline."""
from app.services.compliance_engine import _compose_from_synthetic


def test_compose_from_synthetic_baseline():
    # An unregistered plate (not in database) should always return risk_score >= 55
    report = _compose_from_synthetic("MH12AB1234", 0, 0.0)
    assert report.vehicle_known is False
    assert report.risk_score >= 55
    assert report.risk_band in ("HIGH", "CRITICAL")
    assert report.enforcement_action in ("CITATE_AND_FLAG", "IMPOUND_RECOMMENDED")
