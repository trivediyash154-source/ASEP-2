#!/usr/bin/env python3
"""
Vehicle + Plate Detection Debug Tool.

Usage:
  python scripts/debug_detection.py path/to/image.jpg
  python scripts/debug_detection.py path/to/image.jpg --save-annotated
  python scripts/debug_detection.py --webcam          # use webcam (index 0)
  python scripts/debug_detection.py path/to/video.mp4 --frames 10

Displays bounding boxes, confidence scores, and plate regions.
"""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import cv2
import numpy as np


def setup_env():
    import os
    os.environ.setdefault("SECRET_KEY", "debug-secret-key-minimum-32-characters-here")
    os.environ.setdefault("JWT_SECRET_KEY", "debug-jwt-key-minimum-32-characters-here")
    os.environ.setdefault("POSTGRES_PASSWORD", "debug")
    os.environ.setdefault("REDIS_PASSWORD", "")
    os.environ.setdefault("GPU_ENABLED", "false")
    os.environ.setdefault("YOLO_CONFIDENCE_THRESHOLD", "0.45")


def main():
    parser = argparse.ArgumentParser(description="Detection debug tool")
    parser.add_argument("source", nargs="?", default=None, help="Image or video path")
    parser.add_argument("--webcam", action="store_true", help="Use webcam input")
    parser.add_argument("--save-annotated", action="store_true", help="Save annotated output")
    parser.add_argument("--frames", type=int, default=1, help="Number of video frames to process")
    parser.add_argument("--output", default="/tmp/detection_debug", help="Output directory")
    args = parser.parse_args()

    setup_env()

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  DETECTION DEBUG TOOL — AI Enforcement Platform")
    print(f"{'='*60}\n")

    # Load detector
    from app.ai.detector import vehicle_detector
    print("[INIT] Loading YOLOv8 vehicle detector...")
    t0 = time.perf_counter()
    try:
        vehicle_detector.load()
        print(f"  ✓ Detector ready ({(time.perf_counter()-t0)*1000:.0f}ms)")
    except RuntimeError as e:
        print(f"  ✗ {e}")
        sys.exit(1)

    # Load OCR
    from app.ai.ocr import plate_ocr
    print("[INIT] Loading OCR engine...")
    try:
        plate_ocr.load()
        print(f"  ✓ OCR ready: {plate_ocr.engines_loaded}")
    except RuntimeError as e:
        print(f"  ✗ OCR not available: {e}")

    # Get frames
    frames = _get_frames(args)
    if not frames:
        print("[ERROR] No frames to process")
        sys.exit(1)

    print(f"\n[PROCESS] Analyzing {len(frames)} frame(s)...\n")

    from app.ai.preprocessor import preprocess_frame, preprocess_plate_crop, extract_plate_region

    for i, frame in enumerate(frames):
        print(f"  Frame {i+1}/{len(frames)} ({frame.shape[1]}x{frame.shape[0]})")
        t_frame = time.perf_counter()

        # Preprocess
        preprocessed = preprocess_frame(frame)

        # Detect
        t_det = time.perf_counter()
        detections = vehicle_detector.detect(preprocessed)
        det_ms = (time.perf_counter() - t_det) * 1000

        print(f"    Detection:  {len(detections)} vehicle(s) — {det_ms:.0f}ms")

        annotated = frame.copy()

        for j, det in enumerate(detections):
            x1, y1, x2, y2 = det.bbox.as_tuple
            print(f"\n    Vehicle {j+1}: {det.class_name} | conf={det.confidence:.3f}")
            print(f"      BBox: ({x1},{y1}) → ({x2},{y2})")

            # Draw vehicle box
            color = (0, 255, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            cv2.putText(annotated, f"{det.class_name} {det.confidence:.2f}",
                        (x1, y1-8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            if det.plate_bbox:
                px1, py1, px2, py2 = det.plate_bbox.as_tuple
                print(f"      Plate:  ({px1},{py1}) → ({px2},{py2}) | conf={det.plate_confidence:.3f}")
                cv2.rectangle(annotated, (px1, py1), (px2, py2), (0, 255, 255), 2)

                # OCR on plate
                plate_crop = extract_plate_region(frame, det.plate_bbox.as_tuple)
                if plate_crop.size > 0:
                    try:
                        processed_crop = preprocess_plate_crop(plate_crop)
                        t_ocr = time.perf_counter()
                        ocr_result = plate_ocr.read_plate(processed_crop)
                        ocr_ms = (time.perf_counter() - t_ocr) * 1000

                        print(f"      OCR:    '{ocr_result.text}' | conf={ocr_result.confidence:.3f} | {ocr_result.engine_used} | {ocr_ms:.0f}ms")
                        print(f"      Format: valid={ocr_result.is_valid_format} | state={ocr_result.has_valid_state_code} | reliable={ocr_result.is_reliable}")

                        if ocr_result.text:
                            cv2.putText(annotated, ocr_result.text,
                                        (px1, py2+18), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                        # Save plate crop
                        crop_path = out_dir / f"frame{i+1}_vehicle{j+1}_plate.jpg"
                        cv2.imwrite(str(crop_path), processed_crop)
                    except Exception as e:
                        print(f"      OCR:    FAILED — {e}")
            else:
                print(f"      Plate:  NOT DETECTED (plate_confidence={det.plate_confidence:.3f})")

        total_ms = (time.perf_counter() - t_frame) * 1000
        print(f"\n    Total frame time: {total_ms:.0f}ms")

        if args.save_annotated or True:  # Always save for debug
            out_path = out_dir / f"frame{i+1}_annotated.jpg"
            cv2.imwrite(str(out_path), annotated)
            print(f"    Saved: {out_path}")

    print(f"\n{'='*60}")
    print(f"  Output saved to: {out_dir}")
    print(f"{'='*60}\n")


def _get_frames(args) -> list:
    frames = []
    if args.webcam:
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("[ERROR] Cannot open webcam")
            return []
        ret, frame = cap.read()
        cap.release()
        if ret:
            frames.append(frame)
    elif args.source:
        path = Path(args.source)
        if not path.exists():
            print(f"[ERROR] Not found: {path}")
            return []
        if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
            img = cv2.imread(str(path))
            if img is not None:
                frames.append(img)
        else:
            # Video
            cap = cv2.VideoCapture(str(path))
            count = 0
            while count < args.frames:
                ret, frame = cap.read()
                if not ret:
                    break
                frames.append(frame)
                count += 1
                # Skip ahead
                for _ in range(10):
                    cap.read()
            cap.release()
    return frames


if __name__ == "__main__":
    main()
