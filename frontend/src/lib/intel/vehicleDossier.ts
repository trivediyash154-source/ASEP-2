/**
 * Vehicle intelligence dossier — deterministic synthesis of registry data
 * from the plate string. Same plate always produces the same dossier, so
 * the in-feed popup, evidence drawer, and full /vehicles/[plate] page all
 * agree on owner, compliance, and risk.
 *
 * In production this module is the seam where registry / insurance / RTO /
 * watchlist lookups land. The shape of `VehicleDossier` is the contract;
 * keep the consumers and they continue to work unchanged.
 */

export interface ComplianceStatus {
  ok: boolean;
  /** Short label, e.g. "Valid · 11mo" or "Expired 47d" */
  text: string;
  /** Optional absolute expiry date for the long-form view (ISO string) */
  expiresAt?: string;
  /** Days until expiry; negative means already expired */
  daysToExpiry?: number;
}

export interface VehicleDossier {
  plate: string;
  vaahanId: string;
  owner: { name: string; phoneMasked: string; address: string };
  vehicle: { make: string; model: string; year: number; color: string; category: string };
  compliance: {
    insurance: ComplianceStatus;
    rc: ComplianceStatus;
    puc: ComplianceStatus;
    fitness: ComplianceStatus;
  };
  risk: {
    score: number;            // 0–100
    band: "low" | "elevated" | "high" | "critical";
    priorEncounters: number;
    repeatOffender: boolean;
    watchlisted: boolean;
    blacklisted: boolean;
  };
  lastFlagged: { violation: string; daysAgo: number } | null;
}

const OWNER_NAMES = [
  "Aarav Sharma",     "Priya Iyer",      "Rohan Mehta",    "Ananya Reddy",
  "Vikram Kapoor",    "Saanvi Joshi",    "Aditya Verma",   "Kavya Nair",
  "Karan Bhatia",     "Diya Krishnan",   "Arjun Bose",     "Meera Pillai",
  "Rahul Deshmukh",   "Isha Chatterjee", "Yuvraj Sinha",   "Tara Menon",
  "Devansh Rao",      "Anushka Patel",   "Siddharth Khan", "Nisha Pradhan",
];

const VEHICLES = [
  { make: "Maruti",    model: "Swift",   category: "Hatchback" },
  { make: "Honda",     model: "City",    category: "Sedan" },
  { make: "Hyundai",   model: "Creta",   category: "SUV" },
  { make: "Tata",      model: "Nexon",   category: "SUV" },
  { make: "Mahindra",  model: "XUV700",  category: "SUV" },
  { make: "Toyota",    model: "Innova",  category: "MPV" },
  { make: "Kia",       model: "Seltos",  category: "SUV" },
  { make: "Bajaj",     model: "Pulsar",  category: "Motorcycle" },
  { make: "Royal Enfield", model: "Classic 350", category: "Motorcycle" },
  { make: "Ashok Leyland", model: "Dost",      category: "LCV" },
];

const COLORS = ["Pearl White", "Mineral Silver", "Galaxy Black", "Marine Blue", "Sunset Bronze", "Mahogany"];

const AREAS = [
  "Bandra West, Mumbai · 400050",
  "Andheri East, Mumbai · 400069",
  "Koregaon Park, Pune · 411001",
  "Indiranagar, Bengaluru · 560038",
  "Hauz Khas, New Delhi · 110016",
  "Salt Lake, Kolkata · 700091",
];

const VIOLATIONS = [
  "Expired Insurance", "Expired Registration", "Expired Pollution Cert",
  "Signal Jump", "Speeding", "No Helmet",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function maskPhone(h: number): string {
  const last4 = (h % 10000).toString().padStart(4, "0");
  return `+91 ••• ••• ${last4}`;
}

function dateInFuture(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function complianceFor(h: number, slotShift: number, forceExpired: boolean, validRangeDays: [number, number]): ComplianceStatus {
  if (forceExpired) {
    const daysExpired = 5 + ((h >> slotShift) % 220);
    return {
      ok: false,
      text: `Expired ${daysExpired}d`,
      expiresAt: dateInFuture(-daysExpired),
      daysToExpiry: -daysExpired,
    };
  }
  const span = validRangeDays[1] - validRangeDays[0];
  const days = validRangeDays[0] + ((h >> slotShift) % Math.max(1, span));
  // Friendly text: months for short ranges, year for long
  const text = days < 60
    ? `Valid · ${days}d`
    : days < 365
    ? `Valid · ${Math.round(days / 30)}mo`
    : `Valid · ${dateInFuture(days).slice(0, 4)}`;
  return { ok: true, text, expiresAt: dateInFuture(days), daysToExpiry: days };
}

/**
 * Synthesise a full vehicle dossier from a plate string. When `violationHint`
 * is provided, the matching compliance field is force-expired so the dossier
 * agrees with the violation type that triggered the lookup.
 */
export function buildDossier(plate: string, violationHint?: string | null): VehicleDossier {
  const normalisedPlate = plate.replace(/\s+/g, "").toUpperCase();
  const h = hash(normalisedPlate);
  const owner = OWNER_NAMES[h % OWNER_NAMES.length];
  const vehicle = VEHICLES[(h >> 3) % VEHICLES.length];
  const color = COLORS[(h >> 6) % COLORS.length];
  const area = AREAS[(h >> 9) % AREAS.length];
  const year = 2015 + ((h >> 2) % 10);

  // Treat violation hints as authoritative for which compliance is broken.
  // Outside that, allocate failures stochastically so plates feel varied.
  const insRand = h % 11 === 0;
  const rcRand  = (h >> 4) % 13 === 0;
  const pucRand = (h >> 7) % 7 === 0;

  const insExpired = violationHint === "Expired Insurance" || insRand;
  const rcExpired  = violationHint === "Expired Registration" || rcRand;
  const pucExpired = violationHint === "Expired Pollution Cert" || pucRand;
  const fitnessExpired = (h >> 11) % 23 === 0; // rare

  const anyExpired = insExpired || rcExpired || pucExpired;
  const priorEncounters = anyExpired ? 1 + (h % 17) : (h % 4);
  const repeatOffender = priorEncounters >= 4;
  const watchlisted = repeatOffender || (h >> 13) % 19 === 0;
  const blacklisted = (h >> 17) % 47 === 0;

  // Risk score weighted by compliance + history
  let score = 0;
  if (insExpired)     score += 22;
  if (rcExpired)      score += 28;
  if (pucExpired)     score += 14;
  if (fitnessExpired) score += 18;
  score += Math.min(28, priorEncounters * 3);
  if (watchlisted)    score += 12;
  if (blacklisted)    score += 22;
  // Add some deterministic noise for variety
  score += (h >> 19) % 8;
  score = Math.max(0, Math.min(100, score));

  const band: VehicleDossier["risk"]["band"] =
    score >= 80 ? "critical" :
    score >= 55 ? "high" :
    score >= 30 ? "elevated" : "low";

  const lastFlagged = priorEncounters > 0
    ? {
        violation:
          violationHint
            ?? VIOLATIONS[(h >> 5) % VIOLATIONS.length],
        daysAgo: priorEncounters === 0 ? 999 : ((h >> 8) % 30) + 1,
      }
    : null;

  return {
    plate: normalisedPlate,
    vaahanId: (h % 999999).toString().padStart(6, "0"),
    owner: { name: owner, phoneMasked: maskPhone(h), address: area },
    vehicle: { make: vehicle.make, model: vehicle.model, year, color, category: vehicle.category },
    compliance: {
      insurance: complianceFor(h, 1, insExpired, [60, 365]),
      rc:        complianceFor(h, 4, rcExpired,  [180, 1825]),
      puc:       complianceFor(h, 7, pucExpired, [30, 365]),
      fitness:   complianceFor(h, 10, fitnessExpired, [365, 1825]),
    },
    risk: {
      score, band,
      priorEncounters, repeatOffender,
      watchlisted, blacklisted,
    },
    lastFlagged,
  };
}

/**
 * Pretty-print the plate for display: "MH12AB1234" → "MH 12 AB 1234".
 * Falls back to the original string if it doesn't match the Indian format.
 */
export function formatPlate(plate: string): string {
  const p = plate.replace(/\s+/g, "").toUpperCase();
  const m = p.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/);
  if (!m) return p;
  return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}

export function riskBandStyle(band: VehicleDossier["risk"]["band"]) {
  switch (band) {
    case "critical": return { tone: "peach" as const, label: "Critical" };
    case "high":     return { tone: "peach" as const, label: "High" };
    case "elevated": return { tone: "bronze" as const, label: "Elevated" };
    case "low":      return { tone: "sage" as const, label: "Low" };
  }
}
