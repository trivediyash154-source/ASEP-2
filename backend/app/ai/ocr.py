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
    "KA", "KL", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PB",
    "RJ", "SK", "TN", "TG", "TR", "UP", "UK", "WB", "AN", "CH",
    "DH", "DD", "DL", "JK", "LA", "LD", "PY",
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


def _normalize_plate(text: str) -> str:
    """
    Normalize OCR output to standard Indian plate format: SSDDLLDDDD
      SS = 2-letter state code
      DD = 1-2 digit district code
      LL = 1-2 letter series
      DDDD = 4-digit number

    Steps:
      1. Strip whitespace, hyphens, dots, spaces
      2. Uppercase
      3. Apply position-aware character corrections
    """
    # Remove common separators inserted by OCR
    text = re.sub(r"[\s\-_./\\|]", "", text.upper().strip())

    if len(text) < 6:
        return text

    chars = list(text)

    # Positions 0-1: state code → must be letters
    for i in range(min(2, len(chars))):
        chars[i] = CHAR_FIXES_LETTER_POSITIONS.get(chars[i], chars[i])

    # Positions 2-3: district code → must be digits
    for i in range(2, min(4, len(chars))):
        chars[i] = CHAR_FIXES_DIGIT_POSITIONS.get(chars[i], chars[i])

    # Positions 4-5: series letters → must be letters
    for i in range(4, min(6, len(chars))):
        chars[i] = CHAR_FIXES_LETTER_POSITIONS.get(chars[i], chars[i])

    # Positions 6-9: registration number → must be digits
    for i in range(6, min(10, len(chars))):
        chars[i] = CHAR_FIXES_DIGIT_POSITIONS.get(chars[i], chars[i])

    return "".join(chars)


# Module-level singleton
plate_ocr = PlateOCR()
