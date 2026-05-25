#!/usr/bin/env python3
"""
OCR Debug Tool — tests the full OCR pipeline on a single image.

Usage:
  python scripts/debug_ocr.py path/to/plate.jpg
  python scripts/debug_ocr.py path/to/plate.jpg --show-steps
  python scripts/debug_ocr.py path/to/plate.jpg --engine easyocr

Outputs: confidence scores, all candidate reads, preprocessing results.
"""

import argparse
import sys
import time
from pathlib import Path

# Allow running from project root without installing the package
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import cv2
import numpy as np


def main():
    parser = argparse.ArgumentParser(description="Debug OCR pipeline on a plate image")
    parser.add_argument("image", help="Path to plate image (JPG/PNG)")
    parser.add_argument("--show-steps", action="store_true", help="Save intermediate preprocessing images")
    parser.add_argument("--engine", default="all", choices=["easyocr", "paddleocr", "tesseract", "all"])
    parser.add_argument("--output-dir", default="/tmp/ocr_debug", help="Output directory for debug images")
    args = parser.parse_args()

    img_path = Path(args.image)
    if not img_path.exists():
        print(f"[ERROR] Image not found: {img_path}")
        sys.exit(1)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Minimal env setup
    import os
    os.environ.setdefault("SECRET_KEY", "debug-secret-key-minimum-32-characters-here")
    os.environ.setdefault("JWT_SECRET_KEY", "debug-jwt-key-minimum-32-characters-here")
    os.environ.setdefault("POSTGRES_PASSWORD", "debug")
    os.environ.setdefault("REDIS_PASSWORD", "")
    os.environ.setdefault("OCR_ENGINE", args.engine)
    os.environ.setdefault("GPU_ENABLED", "false")

    print(f"\n{'='*60}")
    print(f"  OCR DEBUG TOOL — AI Enforcement Platform")
    print(f"{'='*60}")
    print(f"  Image:  {img_path}")
    print(f"  Engine: {args.engine}")
    print(f"  Output: {out_dir}")
    print(f"{'='*60}\n")

    # Load image
    frame = cv2.imread(str(img_path))
    if frame is None:
        print(f"[ERROR] OpenCV could not read: {img_path}")
        sys.exit(1)
    print(f"[OK] Loaded image: {frame.shape[1]}x{frame.shape[0]} px")

    # ── Step 1: Preprocessing ─────────────────────────────────────
    print("\n[STEP 1] Preprocessing plate crop...")
    from app.ai.preprocessor import preprocess_plate_crop

    steps_dir = out_dir / "steps"
    steps_dir.mkdir(exist_ok=True)

    t0 = time.perf_counter()
    try:
        processed = preprocess_plate_crop(frame)
        preprocess_ms = (time.perf_counter() - t0) * 1000
        print(f"  ✓ Preprocessing complete ({preprocess_ms:.1f}ms)")
        print(f"  Input:  {frame.shape[1]}x{frame.shape[0]} px")
        print(f"  Output: {processed.shape[1]}x{processed.shape[0]} px")
    except Exception as e:
        print(f"  ✗ Preprocessing failed: {e}")
        processed = frame

    if args.show_steps:
        # Save raw crop
        cv2.imwrite(str(steps_dir / "01_original.jpg"), frame)
        cv2.imwrite(str(steps_dir / "02_preprocessed.jpg"), processed)
        print(f"  Saved preprocessing steps to {steps_dir}")

    # ── Step 2: OCR ───────────────────────────────────────────────
    print("\n[STEP 2] Loading OCR engines...")
    from app.ai.ocr import plate_ocr

    try:
        plate_ocr.load()
        print(f"  ✓ Engines loaded: {plate_ocr.engines_loaded}")
    except RuntimeError as e:
        print(f"  ✗ OCR load failed: {e}")
        sys.exit(1)

    print("\n[STEP 3] Running OCR on original image...")
    t0 = time.perf_counter()
    result_orig = plate_ocr.read_plate(frame)
    orig_ms = (time.perf_counter() - t0) * 1000

    print(f"\n  === ORIGINAL IMAGE RESULTS ===")
    _print_result(result_orig, orig_ms)

    print("\n[STEP 4] Running OCR on preprocessed image...")
    t0 = time.perf_counter()
    result_proc = plate_ocr.read_plate(processed)
    proc_ms = (time.perf_counter() - t0) * 1000

    print(f"\n  === PREPROCESSED IMAGE RESULTS ===")
    _print_result(result_proc, proc_ms)

    # ── Verdict ───────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("  VERDICT")
    print(f"{'='*60}")

    best = result_proc if result_proc.quality_score >= result_orig.quality_score else result_orig
    label = "preprocessed" if result_proc.quality_score >= result_orig.quality_score else "original"

    if best.is_reliable:
        print(f"  ✓ RELIABLE READ from {label} image")
        print(f"    Plate:       {best.text}")
        print(f"    Confidence:  {best.confidence:.3f}")
        print(f"    Quality:     {best.quality_score:.3f}")
        print(f"    Format OK:   {best.is_valid_format}")
        print(f"    State valid: {best.has_valid_state_code}")
    else:
        print(f"  ✗ UNRELIABLE — confidence {best.confidence:.3f} below threshold")
        if best.text:
            print(f"    Best guess:  {best.text} (not trusted for enforcement)")
        print("  Suggestions:")
        print("    • Check image quality (blur, lighting, resolution)")
        print("    • Try --show-steps to see preprocessing stages")
        print("    • Minimum recommended plate crop: 120x40px")

    print(f"\n  Debug images saved to: {out_dir}")
    print()


def _print_result(result, ms: float) -> None:
    print(f"    Text:        '{result.text}'")
    print(f"    Confidence:  {result.confidence:.3f}")
    print(f"    Quality:     {result.quality_score:.3f}")
    print(f"    Valid format:{result.is_valid_format}")
    print(f"    State code:  {result.has_valid_state_code}")
    print(f"    Engine:      {result.engine_used}")
    print(f"    Reliable:    {result.is_reliable}")
    print(f"    Time:        {ms:.1f}ms")
    if result.candidates:
        print(f"    All candidates ({len(result.candidates)}):")
        for c in result.candidates[:6]:
            marker = "→" if c.normalized == result.text else " "
            print(f"      {marker} '{c.normalized}' | conf={c.confidence:.3f} | score={c.quality_score:.3f} | {c.engine}")


if __name__ == "__main__":
    main()
