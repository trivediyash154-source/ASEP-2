#!/usr/bin/env python3
"""
MJPEG test-plate server — feeds the REAL pipeline a controllable plate image.

Runs inside the backend container (it has cv2/numpy). The certification
orchestrator points the live demo pipeline at http://127.0.0.1:8089/video,
then switches the displayed plate via /set?plate=MH12AB1234. A request to
/set with no plate renders a blank frame (the "nothing held up" state).

This exercises the exact ingestion path a phone camera uses:
  MjpegStreamReader → StreamSource → demo pipeline → YOLO → handheld
  fallback OCR → compliance → persistence → evidence → WebSocket.

No pipeline code is mocked — this only replaces the phone.
"""
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import cv2
import numpy as np

PORT = 8089
FPS = 8
W, H = 1280, 720

_state_lock = threading.Lock()
_current_plate: str | None = None
_frame_cache: dict[str | None, np.ndarray] = {}


def _render(plate: str | None) -> np.ndarray:
    """Render a frame: neutral indoor background, optionally a held-up plate."""
    cached = _frame_cache.get(plate)
    if cached is not None:
        return cached

    # Soft vertical gradient background — looks like a wall, not a void.
    frame = np.zeros((H, W, 3), dtype=np.uint8)
    for y in range(H):
        v = 52 + int(26 * y / H)
        frame[y, :] = (v, v + 4, v + 7)
    # Mild sensor noise so JPEG frames differ slightly frame-to-frame.
    noise = np.random.default_rng(42).integers(-6, 6, (H, W, 1), dtype=np.int16)
    frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    if plate:
        # Plate proportions ~ real Indian HSRP (520x110mm → ~4.7:1).
        pw, ph = 880, 190
        x0, y0 = (W - pw) // 2, (H - ph) // 2
        # Shadow then plate body
        cv2.rectangle(frame, (x0 + 8, y0 + 10), (x0 + pw + 8, y0 + ph + 10), (28, 30, 33), -1)
        cv2.rectangle(frame, (x0, y0), (x0 + pw, y0 + ph), (248, 250, 252), -1)
        cv2.rectangle(frame, (x0, y0), (x0 + pw, y0 + ph), (20, 20, 20), 6)

        # Fit text to plate width
        font = cv2.FONT_HERSHEY_SIMPLEX
        scale, thick = 3.4, 9
        (tw, th), _ = cv2.getTextSize(plate, font, scale, thick)
        while tw > pw - 90 and scale > 0.8:
            scale -= 0.1
            (tw, th), _ = cv2.getTextSize(plate, font, scale, thick)
        tx = x0 + (pw - tw) // 2
        ty = y0 + (ph + th) // 2
        cv2.putText(frame, plate, (tx, ty), font, scale, (18, 18, 18), thick, cv2.LINE_AA)

    _frame_cache[plate] = frame
    return frame


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # silence per-request stderr spam
        pass

    def do_GET(self):
        global _current_plate
        parsed = urlparse(self.path)

        if parsed.path == "/health":
            body = json.dumps({"ok": True, "plate": _current_plate}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/set":
            q = parse_qs(parsed.query)
            plate = (q.get("plate", [""])[0] or "").strip().upper() or None
            with _state_lock:
                _current_plate = plate
            body = json.dumps({"ok": True, "plate": plate}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/video":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            period = 1.0 / FPS
            try:
                while True:
                    t0 = time.time()
                    with _state_lock:
                        plate = _current_plate
                    frame = _render(plate)
                    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
                    if ok:
                        data = buf.tobytes()
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ")
                        self.wfile.write(str(len(data)).encode())
                        self.wfile.write(b"\r\n\r\n")
                        self.wfile.write(data)
                        self.wfile.write(b"\r\n")
                    time.sleep(max(0.0, period - (time.time() - t0)))
            except (BrokenPipeError, ConnectionResetError):
                return

        self.send_response(404)
        self.send_header("Content-Length", "0")
        self.end_headers()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"cert_plate_server listening on :{PORT}")
    server.serve_forever()
