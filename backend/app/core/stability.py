"""
Process-wide stability primitives.

This module centralises every guard that keeps the live-camera pipeline from
overwhelming the backend (the failure mode that OOM-killed the process when an
IP-Webcam was connected). Nothing here is feature work — it is purely load
shedding, concurrency bounding, and memory hygiene.

Guarantees provided:
  * OCR_GATE        — at most ONE heavy OCR runs across the whole process. A
                      frame is skipped (not queued) if OCR is already running.
  * EVIDENCE limits — fire-and-forget evidence writes are bounded and tracked,
                      so they can never accumulate frame copies without limit.
  * memory guard    — rss_mb() + trim_memory() let the watchdog shed load and
                      compact the heap BEFORE the container OOM limit is hit.
  * thread caps     — torch / OpenCV native pools are capped so inference can't
                      fan out across every core and starve the event loop.
"""
from __future__ import annotations

import asyncio
import ctypes
import ctypes.util
import gc
import os

from app.core.logging import get_logger

logger = get_logger(__name__)


# ── OCR concurrency gate ──────────────────────────────────────────────
# A single process-wide lock. The pipeline checks `OCR_GATE.locked()` and, if
# an OCR is already in flight (this camera or any other), it DROPS OCR for the
# current frame instead of stacking a second multi-second, memory-spiking pass.
# This is the core "no frame is processed while another OCR runs" guarantee.
OCR_GATE = asyncio.Lock()

# Hard ceiling on how long a single OCR pass may take before the awaiting
# coroutine gives up. The underlying thread can't be force-killed, but input is
# size-capped upstream so a real pass is ~1-2s; this is a catastrophe backstop.
OCR_HARD_TIMEOUT_S = float(os.getenv("OCR_HARD_TIMEOUT_S", "12"))


# ── Background-task tracking (evidence writes etc.) ───────────────────
# Fire-and-forget tasks need a strong reference (else they can be GC'd
# mid-flight) AND a bound (else a slow disk lets them pile up holding frame
# copies → memory leak). We keep both here.
EVIDENCE_MAX_INFLIGHT = int(os.getenv("EVIDENCE_MAX_INFLIGHT", "4"))
_BG_TASKS: "set[asyncio.Task]" = set()


def spawn_background(coro, *, name: str | None = None) -> asyncio.Task | None:
    """Schedule a fire-and-forget task, holding a strong ref until it finishes.

    Returns None (and closes the coroutine) if we're already at the in-flight
    ceiling — the caller's work is DROPPED rather than queued, which is the
    correct behaviour for non-critical writes under load.
    """
    if len(_BG_TASKS) >= EVIDENCE_MAX_INFLIGHT:
        coro.close()
        return None
    task = asyncio.create_task(coro, name=name)
    _BG_TASKS.add(task)
    task.add_done_callback(_BG_TASKS.discard)
    return task


def background_task_count() -> int:
    return len(_BG_TASKS)


# ── Memory guard ──────────────────────────────────────────────────────
try:
    import psutil

    _PROC: "psutil.Process | None" = psutil.Process()
except Exception:  # pragma: no cover - psutil should be present
    _PROC = None

# Tuned for the 4G backend container: trim at soft, shed load at hard, both
# well below the limit so the kernel OOM-killer never fires.
MEM_SOFT_MB = float(os.getenv("MEM_SOFT_MB", "2200"))
MEM_HARD_MB = float(os.getenv("MEM_HARD_MB", "3000"))

_libc: "ctypes.CDLL | bool | None" = None


def _get_libc():
    global _libc
    if _libc is None:
        try:
            _libc = ctypes.CDLL(ctypes.util.find_library("c") or "libc.so.6", use_errno=True)
        except Exception:
            _libc = False
    return _libc or None


def rss_mb() -> float:
    """Resident set size of this process in MiB (0.0 if unavailable)."""
    if _PROC is None:
        return 0.0
    try:
        return _PROC.memory_info().rss / (1024 * 1024)
    except Exception:
        return 0.0


def trim_memory() -> None:
    """Force a GC pass and return freed arenas to the OS (glibc malloc_trim).

    CPython + glibc tend to hold freed heap pages; after a burst of large OCR /
    OpenCV allocations the RSS stays high even once the objects are gone.
    malloc_trim(0) compacts it back down, which is what keeps RSS *flat* over a
    multi-hour stream instead of ratcheting upward.
    """
    gc.collect()
    libc = _get_libc()
    if libc is not None and hasattr(libc, "malloc_trim"):
        try:
            libc.malloc_trim(0)
        except Exception:
            pass


def configure_runtime_limits() -> None:
    """Cap native inference thread pools. Call once at startup.

    YOLO (torch) and EasyOCR/OpenCV will otherwise spawn one worker per core.
    On a busy event loop that both starves async I/O and multiplies peak memory.
    Two threads is plenty for a 12-FPS single-camera pipeline.
    """
    n = max(1, int(os.getenv("INFERENCE_THREADS", "2")))
    # Belt-and-braces: also set the env vars some libs read at import time.
    for var in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
        os.environ.setdefault(var, str(n))
    try:
        import torch

        torch.set_num_threads(n)
    except Exception:
        pass
    try:
        import cv2

        cv2.setNumThreads(n)
    except Exception:
        pass
    logger.info(
        "runtime_limits_configured",
        inference_threads=n,
        mem_soft_mb=MEM_SOFT_MB,
        mem_hard_mb=MEM_HARD_MB,
        ocr_hard_timeout_s=OCR_HARD_TIMEOUT_S,
        evidence_max_inflight=EVIDENCE_MAX_INFLIGHT,
    )
