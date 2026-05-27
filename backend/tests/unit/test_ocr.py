"""Unit tests for OCR normalization and plate validation."""
import pytest
from app.ai.ocr import _normalize_plate, _is_bh_series
import re
from app.core.constants import PLATE_PATTERN

PLATE_REGEX = re.compile(PLATE_PATTERN)


@pytest.mark.parametrize("raw,expected", [
    ("MH 12 AB 1234", "MH12AB1234"),
    ("mh12ab1234", "MH12AB1234"),
    ("MH-12-AB-1234", "MH12AB1234"),
    ("MH12A81234", "MH12AB1234"),  # 8→B correction in letter position
    ("22 8H 1234 AA", "22BH1234AA"),  # BH series OCR correction
    ("DL-3C-AB-1234", "DL3CAB1234"),  # Delhi district alphanumeric code
    ("MH-02-A-7", "MH02A7"),  # VIP / short number plate
    ("MH 12 1234", "MH121234"),  # Standard plate, no series letters
    ("T-0526-MH-1234-AB", "T0526MH1234AB"),  # MoRTH temporary plate
    ("T0526MH1234A8", "T0526MH1234AB"),  # MoRTH temporary plate OCR correction
])
def test_plate_normalization(raw, expected):
    result = _normalize_plate(raw)
    assert result == expected
    assert result == result.upper()
    assert " " not in result
    assert "-" not in result


def test_valid_plate_pattern():
    valid_plates = [
        # Standard / Delhi-alpha / VIP
        "MH12AB1234", "DL01AB1234", "KA09CD5678",
        "DL3CAB1234", "MH02A7",
        "MH121234", "DL011234",  # Standard plates with no series letters
        # Bharat series
        "22BH1234AA",
        # Temporary / transit
        "MHTMP12AB1234", "DLTMP1A99",
        "T0526MH1234AB", "T1223KA9876Z",  # MoRTH temporary plates
    ]
    for plate in valid_plates:
        assert PLATE_REGEX.match(plate), f"{plate} should be valid"


def test_invalid_plate_pattern():
    # Junk, malformed, separator-bearing, and wrong-shape inputs should all be
    # rejected by the anchored pattern. The normalizer is responsible for
    # stripping separators before this regex runs.
    invalid = [
        "INVALID",         # no digits at all
        "INVALID123",      # too short of a state, no district digits
        "12345678",        # all digits
        "A1B2",            # too short
        "MH-12-AB",        # separators remain
        "MH12AB12345",     # 5 trailing digits (>4)
        "22BH123AA",       # BH number is only 3 digits
    ]
    for plate in invalid:
        assert not PLATE_REGEX.match(plate), f"{plate} should be invalid"


def test_is_bh_series_helper():
    """`_is_bh_series` must identify Bharat plates without consulting the
    state-code allow-list, and must reject everything else."""
    assert _is_bh_series("22BH1234AA") is True
    assert _is_bh_series("99BH0001ZZ") is True
    # Wrong length
    assert _is_bh_series("22BH1234A") is False
    # Year part not digits
    assert _is_bh_series("AABH1234AA") is False
    # Middle not BH
    assert _is_bh_series("22XX1234AA") is False
    # Standard plate must NOT match BH
    assert _is_bh_series("MH12AB1234") is False


def test_valid_state_codes():
    from app.ai.ocr import OCRCandidate
    # Check current and historical state codes
    for state in ["MH", "DL", "KA", "TG", "TS", "UA", "UK", "OD", "OR", "DN", "DD"]:
        cand = OCRCandidate(text=f"{state}12AB1234", confidence=0.9, engine="easyocr")
        assert cand.has_valid_state_code, f"{state} should be a valid state code"
        cand_temp = OCRCandidate(text=f"T0526{state}1234AB", confidence=0.9, engine="easyocr")
        assert cand_temp.has_valid_state_code, f"T0526{state}1234AB should have valid state code"

