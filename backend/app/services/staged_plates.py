"""
Staged-plate registry — scripted outcomes for the live VIP demo.
================================================================

WHY THIS EXISTS
---------------
During a live demo (Chief Minister / hackathon judges) the operator holds up
*specific printed plates* and needs a *specific, repeatable* enforcement story
for each — a clean pass, a fineable violation, and a critical watchlist hit.
This registry maps those exact plate strings to fixed outcomes so the on-stage
narrative is fully controlled and never depends on live OCR/registry luck.

A staged plate is matched *loosely* (Levenshtein distance ≤ MATCH_MAX_DIST)
against the OCR read, so a slightly-misread "MH12A81234" still resolves to the
scripted "MH12AB1234". When a staged plate matches, `compliance_engine` builds
the report straight from the spec below (owner/vehicle fields still come from
the deterministic synthetic dossier so the card looks real).

This is gated by env `DEMO_STAGED_PLATES` (default ON in dev). Turn it OFF for
any non-demo / production run.

╔══════════════════════════════════════════════════════════════════════════╗
║  THE SEED LIST — print these plates and hold them up on stage              ║
╠════════════════╤══════════════╤════════════════════════════════════════════╣
║  PLATE         │  OUTCOME     │  STORY                                      ║
╟────────────────┼──────────────┼────────────────────────────────────────────╢
║  MH12AB1234    │  CLEAR       │  Clean Pune vehicle, all papers valid       ║
║  TN09GH6745    │  HIGH        │  Expired insurance → challan issued         ║
║  MH14XY0099    │  CRITICAL    │  Blacklisted (Crime Branch watchlist)       ║
╚════════════════╧══════════════╧════════════════════════════════════════════╝
"""
from __future__ import annotations

from typing import Optional

# Loosely match a staged plate even when OCR misreads a character or two.
MATCH_MAX_DIST = 2


# Each spec fully scripts the enforcement card. `compliance_engine._compose_staged`
# reads these and builds a ComplianceReport (owner/vehicle come from the synthetic
# dossier, the four checks + score + outcome come from here).
#
# Field meanings:
#   risk_score / risk_band / outcome / reason  → exactly what the UI shows
#   registration|insurance|puc                 → ("VALID"|"EXPIRED"|"EXPIRING_SOON", days)
#                                                 days<0 = expired N days ago
#   blacklist_flagged / blacklist_reason       → watchlist hit
#   violation_label                            → headline shown on the challan
STAGED_PLATES: dict[str, dict] = {
    # ── CLEAN PASS — open the demo with a "nothing to see here" ──────────
    "MH12AB1234": {
        "scenario": "clear",
        "risk_score": 6,
        "risk_band": "CLEAR",
        "outcome": "CLEAR",
        "reason": "All documents valid; no enforcement action required",
        "registration": ("VALID", 412),
        "insurance": ("VALID", 233),
        "puc": ("VALID", 88),
        "blacklist_flagged": False,
        "blacklist_reason": None,
        "violation_label": None,
    },
    # ── FINEABLE VIOLATION — the bread-and-butter enforcement moment ─────
    "TN09GH6745": {
        "scenario": "expired_insurance",
        "risk_score": 62,
        "risk_band": "HIGH",
        "outcome": "CHALLAN",
        "reason": "Insurance expired 47 day(s) ago; PUC expired 12 day(s) ago",
        "registration": ("VALID", 190),
        "insurance": ("EXPIRED", -47),
        "puc": ("EXPIRED", -12),
        "blacklist_flagged": False,
        "blacklist_reason": None,
        "violation_label": "Expired Insurance",
    },
    # ── CRITICAL WATCHLIST HIT — the showstopper ─────────────────────────
    "MH14XY0099": {
        "scenario": "blacklisted",
        "risk_score": 94,
        "risk_band": "CRITICAL",
        "outcome": "CRITICAL_ALERT",
        "reason": "Watchlist hit — vehicle linked to Crime Branch chain-snatching alert",
        "registration": ("EXPIRED", -120),
        "insurance": ("EXPIRED", -120),
        "puc": ("EXPIRED", -60),
        "blacklist_flagged": True,
        "blacklist_reason": "Vehicle flagged by Crime Branch — chain-snatching investigation (FIR 0442/2026)",
        "violation_label": "Blacklisted Vehicle",
    },
}


def _norm(plate: str) -> str:
    return "".join(ch for ch in (plate or "").upper() if ch.isalnum())


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def match_staged(plate: str) -> Optional[tuple[str, dict]]:
    """Return (canonical_plate, spec) if `plate` loosely matches a staged plate.

    Loose match tolerates up to MATCH_MAX_DIST single-character OCR errors so a
    misread still resolves to the scripted plate. Exact matches always win.
    """
    p = _norm(plate)
    if not p:
        return None
    if p in STAGED_PLATES:
        return p, STAGED_PLATES[p]
    best: Optional[tuple[str, dict, int]] = None
    for canon, spec in STAGED_PLATES.items():
        # Skip wildly different lengths — cheap guard before the DP.
        if abs(len(p) - len(canon)) > MATCH_MAX_DIST:
            continue
        d = _levenshtein(p, canon)
        if d <= MATCH_MAX_DIST and (best is None or d < best[2]):
            best = (canon, spec, d)
    if best:
        return best[0], best[1]
    return None
