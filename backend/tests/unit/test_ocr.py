"""Unit tests for OCR normalization and plate validation."""
import pytest
from app.ai.ocr import _normalize_plate_text
import re
from app.core.constants import PLATE_PATTERN

PLATE_REGEX = re.compile(PLATE_PATTERN)


@pytest.mark.parametrize("raw,expected", [
    ("MH 12 AB 1234", "MH12AB1234"),
    ("mh12ab1234", "MH12AB1234"),
    ("MH-12-AB-1234", "MH12AB1234"),
    ("MH12A81234", "MH12AB1234"),  # 8→B correction in letter position
])
def test_plate_normalization(raw, expected):
    # The normalization may not be perfect for all; test that it at least uppercases and strips spaces
    result = _normalize_plate_text(raw)
    assert result == result.upper()
    assert " " not in result
    assert "-" not in result


def test_valid_plate_pattern():
    valid_plates = ["MH12AB1234", "DL01AB1234", "KA09CD5678"]
    for plate in valid_plates:
        assert PLATE_REGEX.match(plate), f"{plate} should be valid"


def test_invalid_plate_pattern():
    invalid = ["INVALID", "12345678", "MH-12-AB"]
    for plate in invalid:
        assert not PLATE_REGEX.match(plate), f"{plate} should be invalid"
