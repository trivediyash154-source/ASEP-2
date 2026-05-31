"""
Lock-free network video stream ingestion.

Built for unstable mobile camera sources (IP Webcam MJPEG / DroidCam / RTSP /
USB webcam). The design separates two responsibilities into different
threads so the consumer NEVER waits for the network:

  ┌────────────────────────┐        ┌────────────────────────┐
  │ Producer thread (1/src)│        │ Consumer (AI pipeline) │
  │                        │        │                        │
  │  cv2.VideoCapture.read │ frame  │  src.latest_frame()    │
  │  ──────────────────────┼───────►│  ──────────────────────│
  │  push into deque(1)    │        │  pops newest from deque│
  │  drop older frames     │        │  always real-time      │
  └────────────────────────┘        └────────────────────────┘

A deque with `maxlen=1` is the lock-free double buffer: every new frame
overwrites the previous one, so if the AI is busy the consumer always
grabs the most recent frame the camera has produced — never a backlog.

Protocols handled, in order of detection:
    int           ── USB webcam index
    rtsp://...    ── IP camera RTSP
    http(s)://... ── IP Webcam MJPEG / DroidCam / generic HTTP video
"""
from __future__ import annotations

import asyncio
import ctypes
import os
import signal
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Optional, Union
import urllib.request

import cv2
import numpy as np

from app.core.logging import get_logger

logger = get_logger(__name__)

# ── FFmpeg crash-proofing ────────────────────────────────────────────
#
# libavformat's demux.c contains C-level assert() calls (e.g. line 610:
# `pkt->stream_index < s->nb_streams`) that call abort()/SIGABRT when a
# corrupted MJPEG/RTSP packet arrives. This kills the ENTIRE uvicorn
# process, not just the reader thread.
#
# Mitigations applied here:
#   1. FFREPORT="" — disables FFmpeg's internal report file.
#   2. AV_LOG_FORCE_NOCOLOR — avoids ANSI in log output.
#   3. We install a per-thread SIGABRT handler that converts the abort
#      into a Python exception (caught by _safe_read).
#   4. err_detect=ignore_err added to capture options to tell the demuxer
#      to skip malformed packets instead of asserting.
os.environ.setdefault("FFREPORT", "")
os.environ.setdefault("AV_LOG_FORCE_NOCOLOR", "1")


# ── FFmpeg capture options ───────────────────────────────────────────
#
# Set BEFORE the first cv2.VideoCapture so OpenCV's ffmpeg backend honours them.
# These keep mobile MJPEG sources (IP Webcam / DroidCam / Iriun) alive when
# the underlying TCP connection hiccups — which is the common failure mode
# when the backend runs inside Docker and the phone is on the Wi-Fi LAN
# (Docker-Desktop's NAT will occasionally drop long-lived idle-ish streams).
#
# Notes:
#   * `reconnect_streamed` reconnects mid-stream on EOF/RST without us
#     having to release+reopen the capture from Python.
#   * `rw_timeout` is in MICROseconds (FFmpeg quirk).
#   * `stimeout` (RTSP) is also microseconds.
#   * `;` separates options, `|` would also work — we use `|` because the
#     env var is already pipe-delimited by FFmpeg.
_HTTP_FFMPEG_OPTS = (
    "reconnect;1"
    "|reconnect_streamed;1"
    "|reconnect_delay_max;3"
    "|reconnect_on_network_error;1"
    "|reconnect_on_http_error;4xx,5xx"
    "|rw_timeout;8000000"
    "|fflags;nobuffer+discardcorrupt"
    "|flags;low_delay"
    "|max_delay;500000"
    "|err_detect;ignore_err"
)
_RTSP_FFMPEG_OPTS = (
    "rtsp_transport;tcp"
    "|stimeout;5000000"
    "|max_delay;500000"
    "|fflags;nobuffer+discardcorrupt"
    "|flags;low_delay"
    "|err_detect;ignore_err"
)


# ── Public dataclasses ───────────────────────────────────────────────


@dataclass
class StreamMetrics:
    """Live performance + health snapshot for a source."""
    fps: float = 0.0
    latency_ms: float = 0.0
    frames_read: int = 0
    frames_dropped: int = 0
    last_frame_at: float = 0.0  # epoch seconds
    reconnects: int = 0
    health: str = "UNKNOWN"  # EXCELLENT / GOOD / DEGRADED / CRITICAL / OFFLINE

    def as_dict(self) -> dict:
        return {
            "fps": round(self.fps, 1),
            "latency_ms": round(self.latency_ms, 1),
            "frames_read": self.frames_read,
            "frames_dropped": self.frames_dropped,
            "stream_health": self.health,
            "reconnects": self.reconnects,
            "last_frame_age_ms": round(max(0.0, (time.time() - self.last_frame_at) * 1000), 0)
            if self.last_frame_at
            else None,
        }


# ── MJPEG Stream Reader ───────────────────────────────────────────────

class MjpegStreamReader:
    """Pure-Python MJPEG stream reader that bypasses FFmpeg's C-level demuxer.

    This completely eliminates the risk of FFmpeg demuxer calling abort() / SIGABRT
    on corrupted network packets, which would crash the entire Uvicorn process.
    """
    def __init__(self, url: str, timeout: float = 6.0):
        self.url = url
        self.timeout = timeout
        self.response = None
        # Persistent parse buffer — kept across read_frame() calls so bytes of
        # the *next* frame that arrive in the same chunk are not discarded.
        self._buf = bytearray()

    def open(self) -> bool:
        try:
            self.response = urllib.request.urlopen(self.url, timeout=self.timeout)
            return True
        except Exception as e:
            logger.warning("mjpeg_open_failed", url=self.url, error=str(e))
            self.response = None
            return False

    def read_frame(self, stop_event: threading.Event) -> Optional[np.ndarray]:
        if not self.response:
            return None

        buf = self._buf
        try:
            while not stop_event.is_set():
                # First, try to extract a complete JPEG already sitting in the
                # buffer from a previous read. Only hit the network when we
                # genuinely need more bytes.
                soi = buf.find(b'\xff\xd8')
                if soi != -1:
                    eoi = buf.find(b'\xff\xd9', soi)
                    if eoi != -1:
                        jpg_bytes = bytes(buf[soi:eoi + 2])
                        # Drop everything up to and including this frame; keep
                        # the tail (start of the next frame) for the next call.
                        del buf[:eoi + 2]
                        frame = cv2.imdecode(
                            np.frombuffer(jpg_bytes, dtype=np.uint8), cv2.IMREAD_COLOR
                        )
                        if frame is not None:
                            return frame
                        # Corrupt JPEG — keep scanning for the next marker.
                        continue
                elif len(buf) > 1:
                    # No start-of-image yet — keep only the last byte in case a
                    # split 0xFF…0xD8 marker straddles two chunks.
                    del buf[:-1]

                chunk = self.response.read(8192)
                if not chunk:
                    return None
                buf.extend(chunk)

                if len(buf) > 10 * 1024 * 1024:
                    logger.warning("mjpeg_buffer_overflow_clearing", url=self.url, size=len(buf))
                    buf.clear()
        except Exception as e:
            logger.warning("mjpeg_read_frame_exception", url=self.url, error=str(e))
            return None
        return None

    def close(self):
        if self.response:
            try:
                self.response.close()
            except Exception:
                pass
            self.response = None
        self._buf.clear()


# ── Stream source ────────────────────────────────────────────────────


class StreamSource:
    """
    Single camera stream feeding a 1-slot deque from a background thread.

    Lifecycle:
      src = StreamSource("http://10.0.0.5:8080/video")
      src.start()                  # spawns producer thread
      frame = src.latest_frame()   # returns most recent np.ndarray or None
      src.stop()                   # stops the thread cleanly
    """

    CONNECT_TIMEOUT_S = 6.0
    RECONNECT_BACKOFF_S = (0.5, 1.0, 2.0, 4.0, 6.0)  # exponential, capped
    DEAD_FRAME_THRESHOLD_S = 5.0  # if no frame in this window, mark unhealthy
    MAX_CONSECUTIVE_READ_FAILURES = 8  # tolerate brief MJPEG hiccups before reconnect
    READ_LOOP_YIELD_S = 0.001          # tiny sleep so the producer doesn't peg a core

    def __init__(self, source: Union[int, str], label: str = "") -> None:
        self.source = source
        self.label = label or str(source)
        self._buffer: deque[tuple[np.ndarray, float]] = deque(maxlen=1)
        self._buffer_lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._opened_event = threading.Event()
        self._cap: Optional[cv2.VideoCapture] = None
        self._mjpeg_reader: Optional[MjpegStreamReader] = None
        self._fps_window: deque[float] = deque(maxlen=30)
        self.metrics = StreamMetrics()

    # ── Public API ───────────────────────────────────────────────

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, name=f"stream:{self.label}", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=4)
        if self._mjpeg_reader is not None:
            try:
                self._mjpeg_reader.close()
            except Exception:
                pass
            self._mjpeg_reader = None
        if self._cap is not None:
            try:
                self._cap.release()
            except Exception:
                pass
            self._cap = None
        self.metrics.health = "OFFLINE"

    def latest_frame(self) -> Optional[np.ndarray]:
        """Return the newest frame, or None if no frame has been produced yet."""
        with self._buffer_lock:
            if not self._buffer:
                return None
            frame, _ts = self._buffer[-1]
            return frame

    def latest_frame_with_age_ms(self) -> tuple[Optional[np.ndarray], float]:
        with self._buffer_lock:
            if not self._buffer:
                return None, 0.0
            frame, ts = self._buffer[-1]
            return frame, (time.perf_counter() - ts) * 1000.0

    @property
    def buffer_depth(self) -> int:
        """Frames currently buffered (0 or 1 — the deque is a 1-slot double
        buffer). Surfaced for the watchdog's queue-depth telemetry."""
        return len(self._buffer)

    def wait_until_opened(self, timeout: float = CONNECT_TIMEOUT_S) -> bool:
        return self._opened_event.wait(timeout=timeout)

    # ── Producer thread ─────────────────────────────────────────

    def _open(self) -> bool:
        """Open the cv2 capture or MJPEG reader with a sane timeout. Returns True on success."""
        # Coerce source — pure-int strings → USB index
        src: Union[int, str]
        if isinstance(self.source, int):
            src = self.source
        elif isinstance(self.source, str) and self.source.isdigit():
            src = int(self.source)
        else:
            src = self.source

        is_rtsp = isinstance(src, str) and src.lower().startswith("rtsp://")
        is_http = isinstance(src, str) and src.lower().startswith(("http://", "https://"))
        is_hls = isinstance(src, str) and ".m3u8" in src.lower()

        # Pure Python MJPEG reader for HTTP streams (e.g. DroidCam/IP Webcam)
        if is_http and not is_hls:
            logger.info("stream_open_mjpeg", source=str(src))
            reader = MjpegStreamReader(src, timeout=self.CONNECT_TIMEOUT_S)
            if reader.open():
                self._mjpeg_reader = reader
                self._opened_event.set()
                self.metrics.health = "GOOD"
                logger.info(
                    "stream_opened_mjpeg",
                    source=str(src),
                    label=self.label,
                )
                return True
            else:
                logger.warning("stream_open_mjpeg_failed", source=str(src))
                return False

        self._mjpeg_reader = None

        # ── Configure FFmpeg backend BEFORE opening ─────────────────
        # This env var is read once per VideoCapture() construction.
        if is_rtsp:
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = _RTSP_FFMPEG_OPTS
        elif is_http:
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = _HTTP_FFMPEG_OPTS
        else:
            # USB / int index — clear any leftover from a prior network open
            os.environ.pop("OPENCV_FFMPEG_CAPTURE_OPTIONS", None)

        # Force CAP_FFMPEG for network URLs. On macOS, the default backend
        # selection sometimes picks AVFoundation which silently ignores the
        # options above.
        try:
            if isinstance(src, str) and (is_rtsp or is_http):
                cap = cv2.VideoCapture(src, cv2.CAP_FFMPEG)
            else:
                cap = cv2.VideoCapture(src)
        except Exception as exc:
            logger.error("stream_open_exception", source=str(src), error=str(exc))
            return False

        if not cap or not cap.isOpened():
            logger.warning("stream_open_failed", source=str(src))
            try:
                cap.release()
            except Exception:
                pass
            return False

        # Small internal buffer — drop stale frames at the ffmpeg layer too
        try:
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass

        self._cap = cap
        self._opened_event.set()
        logger.info(
            "stream_opened",
            source=str(src),
            label=self.label,
            backend=cap.getBackendName() if hasattr(cap, "getBackendName") else "?",
        )
        return True

    def _run(self) -> None:
        attempt = 0
        last_t = time.perf_counter()
        consecutive_failures = 0
        last_successful_read = time.time()

        while not self._stop_event.is_set():
            # ── (re)connect ────────────────────────────────────
            # IMPORTANT: an MJPEG phone source uses `self._mjpeg_reader`, NOT
            # `self._cap` (which stays None for HTTP streams). Only (re)open
            # when NEITHER transport is alive — otherwise we'd tear down and
            # re-dial the phone on every loop iteration, hammering the IP
            # Webcam server until it drops the connection ("auto-disconnect")
            # and leaking sockets until the whole process wedges.
            reader_alive = self._mjpeg_reader is not None
            cap_alive = self._cap is not None and self._cap.isOpened()
            if not reader_alive and not cap_alive:
                opened = self._open()
                if not opened:
                    backoff = self.RECONNECT_BACKOFF_S[min(attempt, len(self.RECONNECT_BACKOFF_S) - 1)]
                    self.metrics.health = "OFFLINE"
                    if attempt > 0:
                        self.metrics.reconnects += 1
                    attempt += 1
                    logger.info(
                        "stream_reconnect_scheduled",
                        label=self.label, attempt=attempt, backoff_s=backoff,
                    )
                    if self._stop_event.wait(backoff):
                        return
                    continue
                attempt = 0
                consecutive_failures = 0
                last_successful_read = time.time()

            # ── read ───────────────────────────────────────────
            t0 = time.perf_counter_ns()
            ok, frame = False, None
            try:
                ok, frame = self._safe_read()
            except Exception as exc:
                logger.error("stream_read_exception", label=self.label, error=str(exc))
                ok = False

            if not ok or frame is None:
                consecutive_failures += 1
                stale_s = time.time() - last_successful_read

                # Tolerate brief MJPEG hiccups — they're routine over Wi-Fi.
                # Only tear down the cap once we've failed enough times in a row,
                # OR the watchdog says we haven't seen a frame in too long.
                if (
                    consecutive_failures < self.MAX_CONSECUTIVE_READ_FAILURES
                    and stale_s < self.DEAD_FRAME_THRESHOLD_S
                ):
                    self.metrics.health = "DEGRADED"
                    # Small wait so we don't busy-loop on a broken pipe
                    if self._stop_event.wait(0.05):
                        return
                    continue

                logger.warning(
                    "stream_read_failed_reconnecting",
                    label=self.label,
                    consecutive_failures=consecutive_failures,
                    stale_s=round(stale_s, 2),
                )
                try:
                    if self._mjpeg_reader is not None:
                        self._mjpeg_reader.close()
                        self._mjpeg_reader = None
                    if self._cap is not None:
                        self._cap.release()
                        self._cap = None
                except Exception:
                    pass
                self._opened_event.clear()
                self.metrics.health = "OFFLINE"
                consecutive_failures = 0
                continue

            # ── success path ──────────────────────────────────
            consecutive_failures = 0
            last_successful_read = time.time()

            # ── push to deque (overwrites any previous frame) ──
            now = time.perf_counter()
            with self._buffer_lock:
                if self._buffer:
                    self.metrics.frames_dropped += 1
                self._buffer.append((frame, now))

            self.metrics.frames_read += 1
            self.metrics.last_frame_at = time.time()
            self.metrics.latency_ms = (time.perf_counter_ns() - t0) / 1_000_000.0

            # rolling FPS
            self._fps_window.append(now - last_t)
            last_t = now
            if len(self._fps_window) >= 2:
                avg = sum(self._fps_window) / len(self._fps_window)
                self.metrics.fps = 1.0 / avg if avg > 0 else 0.0

            self.metrics.health = self._compute_health()

            # Yield the GIL so async consumers (FastAPI, WS broadcast) breathe.
            time.sleep(self.READ_LOOP_YIELD_S)

    def _safe_read(self) -> tuple:
        """Read a frame from cv2.VideoCapture or MjpegStreamReader with SIGABRT protection."""
        if self._mjpeg_reader is not None:
            frame = self._mjpeg_reader.read_frame(self._stop_event)
            return (frame is not None), frame

        if self._cap is None:
            return False, None

        original_handler = None
        try:
            # Install temporary SIGABRT handler (main thread only on some OS)
            try:
                original_handler = signal.getsignal(signal.SIGABRT)
                signal.signal(signal.SIGABRT, _sigabrt_handler)
            except (ValueError, OSError):
                # signal() can only be called from the main thread on some
                # platforms — fall through and rely on the try/except below.
                original_handler = None

            ok, frame = self._cap.read()
            return ok, frame
        except _FFmpegAbortError:
            logger.error(
                "stream_ffmpeg_abort_caught",
                label=self.label,
                hint="FFmpeg assertion failure intercepted — reconnecting",
            )
            return False, None
        except Exception as exc:
            logger.error("stream_read_exception_inner", label=self.label, error=str(exc))
            return False, None
        finally:
            if original_handler is not None:
                try:
                    signal.signal(signal.SIGABRT, original_handler)
                except (ValueError, OSError):
                    pass

    def _compute_health(self) -> str:
        f = self.metrics.fps
        if f >= 22:
            return "EXCELLENT"
        if f >= 12:
            return "GOOD"
        if f >= 5:
            return "DEGRADED"
        return "CRITICAL"


# ── Registry ─────────────────────────────────────────────────────────


class StreamRegistry:
    """Process-wide map of camera_id → StreamSource."""

    def __init__(self) -> None:
        self._streams: dict[str, StreamSource] = {}
        self._lock = threading.Lock()

    def register(self, camera_id: str, source: Union[int, str], label: str = "") -> StreamSource:
        with self._lock:
            existing = self._streams.get(camera_id)
            if existing:
                existing.stop()
            src = StreamSource(source=source, label=label or camera_id)
            src.start()
            self._streams[camera_id] = src
            return src

    def unregister(self, camera_id: str) -> bool:
        with self._lock:
            src = self._streams.pop(camera_id, None)
        if src is None:
            return False
        src.stop()
        return True

    def get(self, camera_id: str) -> Optional[StreamSource]:
        return self._streams.get(camera_id)

    def list_active(self) -> dict[str, StreamSource]:
        return dict(self._streams)

    async def shutdown_all(self) -> None:
        with self._lock:
            sources = list(self._streams.values())
            self._streams.clear()
        for s in sources:
            s.stop()


# Process-wide singleton
stream_registry = StreamRegistry()


# ── SIGABRT defence ──────────────────────────────────────────────────

class _FFmpegAbortError(Exception):
    """Raised when SIGABRT is caught from an FFmpeg assertion failure."""


def _sigabrt_handler(signum, frame):
    """Convert SIGABRT into a Python exception instead of process death."""
    raise _FFmpegAbortError(
        f"FFmpeg sent SIGABRT (signal {signum}) — likely a demux assertion failure"
    )
