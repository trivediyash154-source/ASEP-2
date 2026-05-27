"""
License plate OCR engine.

NO MOCKS. If no OCR engine is available this module raises at startup.
Confidence below OCR_MIN_CONFIDENCE is logged and discarded — it is never
silently promoted to a fake read.

Pipeline:
  1. EasyOCR  (primary)     — GPU-accelerated, handles skewed text well
  2. PaddleOCR (secondary)  — stronger on low-res crops
  3. Tesseract (tertiary)   — pure-Python fallback, no GPU

Both engines run when confidence from the primary is below CONFIDENCE_UPGRADE_THRESHOLD,
and the higher-confidence result wins.
"""

import re
import time
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import cv2
import numpy as np

from app.core.config import settings
from app.core.constants import PLATE_PATTERN
from app.core.logging import get_logger

logger = get_logger(__name__)

# Minimum OCR confidence to accept a read
OCR_MIN_CONFIDENCE = 0.35
# If primary read confidence is below this, run secondary engine too
CONFIDENCE_UPGRADE_THRESHOLD = 0.65
# Indian state codes — used to validate the first two characters
VALID_STATE_CODES = {
    "AP", "AR", "AS", "BR", "CG", "GA", "GJ", "HR", "HP", "JH",
    "KA", "KL", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "OR", "PB",
    "RJ", "SK", "TN", "TG", "TS", "TR", "UP", "UK", "UA", "WB", "AN", "CH",
    "DN", "DD", "DL", "JK", "LA", "LD", "PY",
}
PLATE_REGEX = re.compile(PLATE_PATTERN)


@dataclass
class OCRCandidate:
    text: str
    confidence: float
    engine: str
    normalized: str = ""
    is_valid_format: bool = False
    has_valid_state_code: bool = False

    def __post_init__(self) -> None:
        self.normalized = _normalize_plate(self.text)
        self.is_valid_format = bool(PLATE_REGEX.match(self.normalized))
        # BH series starts with two year digits, not a state code — bypass the
        # state-code allow-list when the plate matches the BH layout.
        if self.is_valid_format and _is_bh_series(self.normalized):
            self.has_valid_state_code = True
        elif self.is_valid_format and _is_morth_temp_series(self.normalized):
            self.has_valid_state_code = self.normalized[5:7] in VALID_STATE_CODES
        else:
            self.has_valid_state_code = self.normalized[:2] in VALID_STATE_CODES

    @property
    def quality_score(self) -> float:
        """Composite score used for final candidate ranking."""
        score = self.confidence
        if self.is_valid_format:
            score += 0.20
        if self.has_valid_state_code:
            score += 0.10
        return min(score, 1.0)


@dataclass
class OCRResult:
    text: str                         # Best normalized plate text (may be empty)
    confidence: float                 # OCR engine confidence for the best candidate
    quality_score: float              # Composite quality score (format + state code)
    is_valid_format: bool
    has_valid_state_code: bool
    engine_used: str
    candidates: List[OCRCandidate]    # All candidates for debugging
    processing_time_ms: float

    @property
    def is_reliable(self) -> bool:
        """True when the result meets minimum standards for enforcement use."""
        return (
            self.confidence >= OCR_MIN_CONFIDENCE
            and len(self.text) >= 6
            and self.is_valid_format
        )


class PlateOCR:
    """
    Multi-engine license plate OCR with confidence-based result selection.
    Raises RuntimeError at load() if no engine is available.
    """

    def __init__(self) -> None:
        self._easy_reader = None
        self._paddle_reader = None
        self._tesseract_available = False
        self._engines_loaded: List[str] = []

    def load(self) -> None:
        """
        Loads all available OCR engines.
        Raises RuntimeError if *no* engine can be loaded.
        """
        engine_pref = settings.OCR_ENGINE.lower()

        if engine_pref in ("easyocr", "both", "all"):
            self._load_easyocr()

        if engine_pref in ("paddleocr", "both", "all"):
            self._load_paddleocr()

        if engine_pref in ("tesseract", "all"):
            self._check_tesseract()

        if not self._engines_loaded:
            raise RuntimeError(
                f"No OCR engines could be loaded (requested: {settings.OCR_ENGINE}). "
                "Install at least one: pip install easyocr  OR  pip install paddleocr"
            )

        logger.info("ocr_engines_ready", engines=self._engines_loaded)

    def read_plate(self, plate_image: np.ndarray) -> OCRResult:
        """
        Read a pre-processed plate crop.
        Returns an OCRResult whose .is_reliable property indicates
        whether the result is suitable for enforcement action.
        """
        t0 = time.perf_counter()
        all_candidates: List[OCRCandidate] = []

        # Primary engine
        if self._easy_reader:
            candidates = self._run_easyocr(plate_image)
            all_candidates.extend(candidates)

            # Upgrade check: run secondary if primary confidence is low
            best_easy = max(candidates, key=lambda c: c.quality_score) if candidates else None
            needs_upgrade = not best_easy or best_easy.confidence < CONFIDENCE_UPGRADE_THRESHOLD

            if needs_upgrade and self._paddle_reader:
                all_candidates.extend(self._run_paddleocr(plate_image))

        elif self._paddle_reader:
            all_candidates.extend(self._run_paddleocr(plate_image))

        # Tesseract as last resort
        if not all_candidates and self._tesseract_available:
            all_candidates.extend(self._run_tesseract(plate_image))

        ms = round((time.perf_counter() - t0) * 1000, 2)

        if not all_candidates:
            logger.warning(
                "ocr_no_candidates",
                engines=self._engines_loaded,
                image_shape=plate_image.shape,
                processing_ms=ms,
            )
            return OCRResult(
                text="",
                confidence=0.0,
                quality_score=0.0,
                is_valid_format=False,
                has_valid_state_code=False,
                engine_used="none",
                candidates=[],
                processing_time_ms=ms,
            )

        # Rank by composite quality score
        all_candidates.sort(key=lambda c: c.quality_score, reverse=True)
        best = all_candidates[0]

        logger.info(
            "ocr_result",
            text=best.normalized,
            confidence=round(best.confidence, 3),
            quality_score=round(best.quality_score, 3),
            engine=best.engine,
            valid_format=best.is_valid_format,
            valid_state=best.has_valid_state_code,
            candidates=[
                {"text": c.normalized, "conf": round(c.confidence, 3), "engine": c.engine}
                for c in all_candidates[:5]
            ],
            processing_ms=ms,
        )

        return OCRResult(
            text=best.normalized,
            confidence=best.confidence,
            quality_score=best.quality_score,
            is_valid_format=best.is_valid_format,
            has_valid_state_code=best.has_valid_state_code,
            engine_used=best.engine,
            candidates=all_candidates,
            processing_time_ms=ms,
        )

    # ── Engine loaders ────────────────────────────────────────────

    def _load_easyocr(self) -> None:
        try:
            import easyocr
            self._easy_reader = easyocr.Reader(
                ["en"],
                gpu=settings.GPU_ENABLED,
                model_storage_directory="/app/ai/models/easyocr",
                verbose=False,
                quantize=True,     # ~2x faster, minimal accuracy loss
            )
            self._engines_loaded.append("easyocr")
            logger.info("easyocr_loaded", gpu=settings.GPU_ENABLED)
        except ImportError:
            logger.warning("easyocr_not_installed", hint="pip install easyocr")
        except Exception as e:
            logger.error("easyocr_load_failed", error=str(e))

    def _load_paddleocr(self) -> None:
        try:
            from paddleocr import PaddleOCR
            self._paddle_reader = PaddleOCR(
                use_angle_cls=True,
                lang="en",
                use_gpu=settings.GPU_ENABLED,
                show_log=False,
                det_db_box_thresh=0.4,
                rec_batch_num=1,
            )
            self._engines_loaded.append("paddleocr")
            logger.info("paddleocr_loaded", gpu=settings.GPU_ENABLED)
        except ImportError:
            logger.warning("paddleocr_not_installed", hint="pip install paddlepaddle paddleocr")
        except Exception as e:
            logger.error("paddleocr_load_failed", error=str(e))

    def _check_tesseract(self) -> None:
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self._tesseract_available = True
            self._engines_loaded.append("tesseract")
            logger.info("tesseract_available")
        except Exception:
            logger.warning("tesseract_not_available", hint="brew install tesseract OR apt install tesseract-ocr")

    # ── Engine runners ────────────────────────────────────────────

    def _run_easyocr(self, image: np.ndarray) -> List[OCRCandidate]:
        try:
            results = self._easy_reader.readtext(
                image,
                detail=1,
                paragraph=False,
                text_threshold=0.5,
                low_text=0.3,
                width_ths=1.0,
                decoder="beamsearch",
            )
            candidates = []
            for (_, text, conf) in results:
                if conf < OCR_MIN_CONFIDENCE or len(text.strip()) < 4:
                    continue
                candidates.append(OCRCandidate(text=text, confidence=conf, engine="easyocr"))
            return candidates
        except Exception as e:
            logger.error("easyocr_read_error", error=str(e))
            return []

    def _run_paddleocr(self, image: np.ndarray) -> List[OCRCandidate]:
        try:
            result = self._paddle_reader.ocr(image, cls=True)
            if not result or not result[0]:
                return []
            candidates = []
            for line in result[0]:
                if not line or not line[1]:
                    continue
                text, conf = line[1][0], line[1][1]
                if conf < OCR_MIN_CONFIDENCE or len(text.strip()) < 4:
                    continue
                candidates.append(OCRCandidate(text=text, confidence=conf, engine="paddleocr"))
            return candidates
        except Exception as e:
            logger.error("paddleocr_read_error", error=str(e))
            return []

    def _run_tesseract(self, image: np.ndarray) -> List[OCRCandidate]:
        try:
            import pytesseract
            # PSM 7 = treat image as a single text line (good for plates)
            custom_config = r"--psm 7 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            text = pytesseract.image_to_string(image, config=custom_config).strip()
            if len(text) < 4:
                return []
            # Tesseract doesn't return per-character confidence for simple string mode
            # Use data mode to get word-level confidence
            data = pytesseract.image_to_data(image, config=custom_config, output_type=pytesseract.Output.DICT)
            confs = [int(c) for c in data["conf"] if str(c).lstrip("-").isdigit() and int(c) > 0]
            avg_conf = (sum(confs) / len(confs) / 100.0) if confs else 0.4
            if avg_conf < OCR_MIN_CONFIDENCE:
                return []
            return [OCRCandidate(text=text, confidence=avg_conf, engine="tesseract")]
        except Exception as e:
            logger.error("tesseract_read_error", error=str(e))
            return []

    @property
    def engines_loaded(self) -> List[str]:
        return list(self._engines_loaded)


# ── Text normalization ────────────────────────────────────────────

# Common OCR confusions in specific positions
# Format: position_range → {bad_char: correct_char}
CHAR_FIXES_LETTER_POSITIONS = {"0": "O", "1": "I", "5": "S", "8": "B"}
CHAR_FIXES_DIGIT_POSITIONS = {"O": "0", "I": "1", "S": "5", "B": "8", "Z": "2", "G": "6"}


def _is_bh_series(candidate: str) -> bool:
    """
    True if the (already normalized, uppercase) candidate is a Bharat-series
    plate: ``YYBH####XX`` — 2 year digits, literal BH, 4 number digits, 2 series
    letters. Used both to skip state-code validation and to drive position-aware
    OCR corrections (year digits must not be turned into letters).
    """
    if len(candidate) != 10:
        return False
    return (
        candidate[0:2].isdigit()
        and candidate[2:4] == "BH"
        and candidate[4:8].isdigit()
        and candidate[8:10].isalpha()
    )


def _is_morth_temp_series(candidate: str) -> bool:
    """
    True if the candidate matches the MoRTH temporary registration format:
    T[0-9]{4}[A-Z]{2}[0-9]{4}[A-Z]{1,2}
    """
    if not (12 <= len(candidate) <= 13):
        return False
    return (
        candidate[0] == "T"
        and candidate[1:5].isdigit()
        and candidate[5:7].isalpha()
        and candidate[7:11].isdigit()
        and candidate[11:].isalpha()
    )


def _normalize_plate(text: str) -> str:
    """
    Normalize OCR output to standard Indian plate format (SSDDLLDDDD / YYBH####XX / TMMYYSS####XX).
      Standard: SS = state, DD = district, LL = series, DDDD = number
      BH Series: YY = year, BH = Bharat, #### = number, XX = series
      MoRTH Temp: T = Temporary, MMYY = month/year, SS = state, #### = number, XX = series
    """
    # Remove common separators inserted by OCR
    text = re.sub(r"[\s\-_./\\|]", "", text.upper().strip())

    if len(text) < 6:
        return text

    chars = list(text)

    # Detect MoRTH temporary series: e.g., T0526MH1234AB
    is_morth_temp = False
    if len(chars) >= 12 and chars[0] in ("T", "7"):
        digit_score = sum(1 for c in chars[1:5] if c.isdigit() or c in CHAR_FIXES_DIGIT_POSITIONS)
        digit_score += sum(1 for c in chars[7:11] if c.isdigit() or c in CHAR_FIXES_DIGIT_POSITIONS)
        letter_score = sum(1 for c in chars[5:7] if c.isalpha() or c in CHAR_FIXES_LETTER_POSITIONS)
        letter_score += sum(1 for c in chars[11:] if c.isalpha() or c in CHAR_FIXES_LETTER_POSITIONS)
        if digit_score + letter_score >= 9:
            is_morth_temp = True

    # Detect BH series: e.g. YYBH1234XX (length 10)
    # Check if characters at index 2,3 are BH (allowing common OCR confusion like 8, B, H)
    is_bh = False
    if not is_morth_temp and len(chars) >= 8:
        c2 = chars[2]
        c3 = chars[3]
        if c2 in ("B", "8") and c3 in ("H", "A", "4"):
            is_bh = True

    if is_morth_temp:
        chars[0] = "T"
        for i in range(1, 5):
            chars[i] = CHAR_FIXES_DIGIT_POSITIONS.get(chars[i], chars[i])
        for i in range(5, 7):
            chars[i] = CHAR_FIXES_LETTER_POSITIONS.get(chars[i], chars[i])
        for i in range(7, 11):
            chars[i] = CHAR_FIXES_DIGIT_POSITIONS.get(chars[i], chars[i])
        for i in range(11, len(chars)):
            chars[i] = CHAR_FIXES_LETTER_POSITIONS.get(chars[i], chars[i])
    elif is_bh:
        # Positions 0-1: year → must be digits
        for i in range(min(2, len(chars))):
            chars[i] = CHAR_FIXES_DIGIT_POSITIONS.get(chars[i], chars[i])
        # Positions 2-3: "BH"
        if len(chars) > 2:
            chars[2] = "B"
        if len(chars) > 3:
            chars[3] = "H"
        # Positions 4-7: registration number → must be digits
        for i in range(4, min(8, len(chars))):
            chars[i] = CHAR_FIXES_DIGIT_POSITIONS.get(chars[i], chars[i])
        # Positions 8+: series letters → must be letters
        for i in range(8, len(chars)):
            chars[i] = CHAR_FIXES_LETTER_POSITIONS.get(chars[i], chars[i])
    else:
        # Standard plate normalization
        # Chars 0-1: state code -> must be letters
        for i in range(min(2, len(chars))):
            chars[i] = CHAR_FIXES_LETTER_POSITIONS.get(chars[i], chars[i])

        # Char 2: must be digit
        if len(chars) > 2:
            chars[2] = CHAR_FIXES_DIGIT_POSITIONS.get(chars[2], chars[2])

        if len(chars) > 3:
            # Char 3: determine if it's part of district code (digit) or series (letter)
            # If it is a digit or commonly confused with a digit, make it digit.
            c3 = chars[3]
            if c3.isdigit() or c3 in CHAR_FIXES_DIGIT_POSITIONS:
                chars[3] = CHAR_FIXES_DIGIT_POSITIONS.get(c3, c3)
                series_start_idx = 4
            else:
                series_start_idx = 3

            # Trailing registration number is at most 4 digits, series letters at most 3 letters.
            # Determine valid range for partition point `p` between series letters and number digits
            min_p = max(series_start_idx, len(chars) - 4)
            max_p = min(series_start_idx + 3, len(chars) - 1)

            if min_p <= max_p:
                best_p = min_p
                best_score = -9999

                strongly_letters = set("ACDEFHJKLMNOPQRTUVWXY")
                strongly_digits = set("0123456789")

                for p in range(min_p, max_p + 1):
                    score = 0
                    # Left part (letters)
                    for idx in range(series_start_idx, p):
                        char = chars[idx]
                        if char in strongly_letters:
                            score += 2
                        elif char in CHAR_FIXES_LETTER_POSITIONS:
                            score += 1
                        elif char in strongly_digits:
                            score -= 10

                    # Right part (digits)
                    for idx in range(p, len(chars)):
                        char = chars[idx]
                        if char in strongly_digits:
                            score += 2
                        elif char in CHAR_FIXES_DIGIT_POSITIONS:
                            score += 1
                        elif char in strongly_letters:
                            score -= 10

                    if score > best_score:
                        best_score = score
                        best_p = p

                # Normalise series letters: series_start_idx to best_p - 1
                for i in range(series_start_idx, best_p):
                    chars[i] = CHAR_FIXES_LETTER_POSITIONS.get(chars[i], chars[i])

                # Normalise trailing digits: best_p to end
                for i in range(best_p, len(chars)):
                    chars[i] = CHAR_FIXES_DIGIT_POSITIONS.get(chars[i], chars[i])
            else:
                # Fallback: normalize everything else to digits if the length is too short
                for i in range(series_start_idx, len(chars)):
                    chars[i] = CHAR_FIXES_DIGIT_POSITIONS.get(chars[i], chars[i])

    return "".join(chars)


# Module-level singleton
plate_ocr = PlateOCR()
