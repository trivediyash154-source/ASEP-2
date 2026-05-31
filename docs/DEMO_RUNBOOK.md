# VAAHAN AI — Live Demo Run Order

For a non-technical VIP audience (Chief Minister / judges). Replay mode is the
**safe spine**; the live phone camera is the **finale**.

---

## 0. Cold start (one command)

```bash
./start.sh           # brings up all services, migrates, seeds, prints the URL
# already running?  ->  ./start.sh --status
# wedged / want a clean slate the night before:  ./start.sh --fresh
```

Wait until `http://localhost` loads and the backend is healthy:

```bash
docker exec enforcement-backend curl -s http://localhost:8000/health   # {"status":"healthy",...}
```

Demo logins (auto-fill on the login screen): `operator@enforcement.gov` / `Admin@1234`.

The synthetic background generator is **OFF by default** (`LIVE_ACTIVITY_ENABLED=false`)
so nothing fabricated appears in the live feed. Don't change that for the demo.

---

## 1. Open on the projector

1. Log in as **operator**.
2. Go to **Demo theatre** → it opens on **Controlled replay** (the safe spine).

## 2. Controlled replay (lead with this — it cannot fail)

- Step through 2–3 curated cases. Each one animates the pipeline and produces a
  forensic dossier + enforcement card. Deterministic — same result every run.
- This establishes the story: detect → read plate → check compliance → enforce.

## 3. Live theatre (the finale)

1. Switch to the **Live theatre** tab.
2. On the phone: open **IP Webcam** → **Start server** → keep the screen **ON**,
   same Wi-Fi as the laptop.
3. Laptop: **Connect mobile camera**. Your last working URL is pre-filled —
   just tap **Connect** (it probes, then opens the stream). First time only,
   paste `http://<phone-ip>:8080/video`.
4. Watch the **pipeline rail** light up: DECODE → DETECT → OCR → COMPLIANCE → CHALLAN.
5. Hold up the printed plates **one at a time**, steady, ~3 seconds each:

   | Plate          | What the room sees |
   | -------------- | ------------------ |
   | `MH12AB1234`   | CLEAR — all papers valid (green) |
   | `TN09GH6745`   | HIGH — expired insurance → **challan issued** |
   | `MH14XY0099`   | CRITICAL — blacklisted, Crime Branch watchlist + **alert chime** |

6. On a violation, click **View e-challan (PDF)** on the card — official document
   with evidence photo, QR to pay, fine, owner. Bilingual labels on the card.

> **Guaranteed result:** even a glare-y / off-angle / non-standard plate produces a
> card within ~3s (it falls back to the best read, snapped to a valid plate, routed
> to manual review). You will not get a dead screen.

---

## If something goes wrong on stage

- **Stream won't connect / drops:** the rail/overlay shows RECONNECTING and recovers
  on its own. If not, click **Force reconnect**, or **Abandon** and re-Connect.
  Worst case: fall back to **Controlled replay** — it never needs the network.
- **Backend feels stuck:** `docker restart enforcement-backend`, wait ~20s, reconnect.
- **Nothing reads:** make sure the phone screen is ON and on the same Wi-Fi; the
  pre-filled URL must end in `/video`.

---

## Reset between rehearsals

Staged-plate detections/challans accumulate in the DB. To clear demo data without a
full wipe is optional — they don't harm the demo (dedupe + fresh cards per run). For a
fully clean slate: `./start.sh --fresh` (wipes volumes, re-seeds) — do this the night
before, not minutes before.

---

## Flags (already set in docker-compose.yml)

| Flag | Default | Meaning |
| ---- | ------- | ------- |
| `LIVE_ACTIVITY_ENABLED` | `false` | No synthetic background detections in the live feed |
| `DEMO_GUARANTEE_RESULT` | `true`  | Always produce an enforcement card (never a dead screen) |
| `DEMO_STAGED_PLATES`    | `true`  | The three printed plates resolve to their scripted outcomes |
