"""Synthetic MJPEG source for stability stress testing.

Serves an endless multipart/x-mixed-replace MJPEG stream of 960x540 frames,
each containing a randomly generated Indian-style number plate plus extra noise
text — deliberately the "text-busy, no real vehicle" case that drives the
handheld-OCR fallback (the path that OOM-killed the backend).

Run inside the backend container:
    python scripts/stress_mjpeg_source.py --port 9099 --fps 20
Then point a demo camera at  http://127.0.0.1:9099/video
"""
import argparse
import random
import string
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np

STATES = ["MH", "DL", "KA", "TN", "GJ", "UP", "RJ", "WB", "AP", "PB"]


def random_plate() -> str:
    s = random.choice(STATES)
    d = f"{random.randint(0, 99):02d}"
    L = "".join(random.choice(string.ascii_uppercase) for _ in range(2))
    n = f"{random.randint(0, 9999):04d}"
    return f"{s}{d}{L}{n}"


def make_frame() -> np.ndarray:
    # Noisy background so EasyOCR's detector has to work (mimics a phone screen).
    img = np.random.randint(40, 90, (540, 960, 3), dtype=np.uint8)
    # Plate card.
    cv2.rectangle(img, (300, 210), (660, 330), (240, 240, 240), -1)
    cv2.rectangle(img, (300, 210), (660, 330), (20, 20, 20), 4)
    cv2.putText(img, random_plate(), (315, 295), cv2.FONT_HERSHEY_SIMPLEX,
                1.6, (10, 10, 10), 5, cv2.LINE_AA)
    # Extra scattered text to stress the text detector (the slow path).
    for _ in range(6):
        x, y = random.randint(0, 820), random.randint(20, 520)
        cv2.putText(img, random_plate()[:random.randint(3, 8)], (x, y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7,
                    (random.randint(150, 255),) * 3, 2, cv2.LINE_AA)
    return img


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        if self.path not in ("/video", "/"):
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type",
                         "multipart/x-mixed-replace; boundary=frame")
        self.end_headers()
        period = 1.0 / self.server.fps
        try:
            while not self.server.stop_flag.is_set():
                t0 = time.time()
                ok, jpg = cv2.imencode(".jpg", make_frame(),
                                       [cv2.IMWRITE_JPEG_QUALITY, 80])
                if not ok:
                    continue
                buf = jpg.tobytes()
                self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n"
                                 b"Content-Length: " + str(len(buf)).encode() +
                                 b"\r\n\r\n" + buf + b"\r\n")
                dt = period - (time.time() - t0)
                if dt > 0:
                    time.sleep(dt)
        except (BrokenPipeError, ConnectionResetError):
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=9099)
    ap.add_argument("--fps", type=int, default=20)
    args = ap.parse_args()
    srv = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    srv.fps = args.fps
    srv.stop_flag = threading.Event()
    print(f"stress MJPEG source on :{args.port} @ {args.fps}fps", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
