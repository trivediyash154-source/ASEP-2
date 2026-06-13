"""
Frame preprocessing pipeline for maximum OCR accuracy.
Handles low-light, motion blur, perspective correction, and noise reduction.
"""
import cv2
import numpy as np
from typing import Optional, Tuple


def preprocess_frame(frame: np.ndarray) -> np.ndarray:
    """Apply a lightweight preprocessing chain before YOLO inference."""
    frame = _normalize_exposure(frame)
    frame = _reduce_noise(frame)
    return frame


def preprocess_plate_crop(plate_crop: np.ndarray) -> np.ndarray:
    """
    Light-touch preprocessing for license-plate OCR.

    IMPORTANT: EasyOCR/PaddleOCR are deep recognition models trained on
    real-world photographs. They perform DRAMATICALLY worse on classically
    "cleaned" input (hard binarization, aggressive deskew, sharpening) — the
    very transforms that helped Tesseract in 2015 destroy the texture cues
    a modern model relies on.

    Measured on a clean rendered plate:
        raw crop            → EasyOCR reads "MH12AB1234" @ 0.91
        old heavy pipeline  → EasyOCR reads "9"          @ 0.29   (broken)

    So this pipeline now does the minimum that genuinely helps:
      1. Upscale small crops so glyphs are tall enough for the detector.
      2. A gentle CLAHE contrast lift on the luminance channel only — rescues
         low-light / backlit plates without touching glyph geometry.

    No deskew (EasyOCR is rotation-tolerant to ~15°), no sharpening, no
    binarization. The colour image is handed to the OCR engine as-is.
    """
    if plate_crop is None or plate_crop.size == 0:
        raise ValueError("Empty plate crop received")

    # Cap the longest side FIRST. The handheld-plate fallback can hand us a
    # full camera frame (e.g. 1613x605); running OCR + CLAHE on that is what
    # froze the backend for ~20s per pass. A plate stays legible far below this.
    plate_crop = _cap_longest_side(plate_crop, max_side=960)

    h = plate_crop.shape[0]
    # EasyOCR likes a glyph height of roughly 32–96px. Upscale anything
    # shorter than 64px; leave already-large crops alone (downscaling a
    # crisp plate only loses detail).
    if h < 64:
        plate_crop = _resize_to_standard(plate_crop, target_height=96)

    return _gentle_contrast(plate_crop)


def _cap_longest_side(img: np.ndarray, max_side: int = 960) -> np.ndarray:
    """Downscale so the longest side is <= ``max_side``; never upscale."""
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest <= max_side:
        return img
    scale = max_side / float(longest)
    return cv2.resize(
        img, (max(1, int(round(w * scale))), max(1, int(round(h * scale)))),
        interpolation=cv2.INTER_AREA,
    )


def _gentle_contrast(img: np.ndarray) -> np.ndarray:
    """CLAHE on the L channel only. Preserves colour + glyph edges."""
    if img.ndim == 2:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(img)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def _normalize_exposure(frame: np.ndarray) -> np.ndarray:
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)


def _reduce_noise(frame: np.ndarray) -> np.ndarray:
    return cv2.fastNlMeansDenoisingColored(frame, None, 3, 3, 7, 21)


def _resize_to_standard(img: np.ndarray, target_height: int = 64) -> np.ndarray:
    h, w = img.shape[:2]
    if h == 0:
        return img
    scale = target_height / h
    new_w = max(1, int(w * scale))
    return cv2.resize(img, (new_w, target_height), interpolation=cv2.INTER_LANCZOS4)


def _deskew(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    coords = np.column_stack(np.where(gray > 0))
    if coords.shape[0] < 10:
        return img
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 0.5:
        return img
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def _sharpen(img: np.ndarray) -> np.ndarray:
    kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    return cv2.filter2D(img, -1, kernel)


def _binarize(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)


def extract_plate_region(
    frame: np.ndarray, bbox: Tuple[int, int, int, int], padding: int = 8
) -> np.ndarray:
    """Crop a plate region from a frame with optional padding."""
    x1, y1, x2, y2 = bbox
    h, w = frame.shape[:2]
    x1 = max(0, x1 - padding)
    y1 = max(0, y1 - padding)
    x2 = min(w, x2 + padding)
    y2 = min(h, y2 + padding)
    return frame[y1:y2, x1:x2]
