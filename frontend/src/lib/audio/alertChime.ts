/**
 * Lazy Web Audio dual-tone chime — synthesizes a premium "operational alert"
 * ping without loading any sample files. Cheap, low-latency, and gated by an
 * explicit unlock() that must run inside a user gesture (browser policy).
 *
 * Usage:
 *   await unlockAudio();           // call on first user interaction
 *   await playChime("violation");  // fires the synthesized tone
 */

type ChimeTone = "violation" | "scan" | "alert";

let ctx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/**
 * Required by Safari + Chrome autoplay policy. Call from a click / keydown
 * handler before the first playChime. Subsequent calls are no-ops.
 */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") await c.resume();
    // 1ms silent buffer to fully wake the engine on iOS
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    unlocked = true;
  } catch {
    /* silent */
  }
}

/**
 * Synthesize a short dual-tone chime. Profile is tuned per `tone`:
 *
 *   violation  – two-tone bell, fast attack, peach-ish 880→660Hz
 *   scan       – soft single-tone, 660Hz, subtle
 *   alert      – sharper warble, 990→440Hz
 */
export async function playChime(tone: ChimeTone = "violation"): Promise<void> {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") await c.resume();
  const t0 = c.currentTime;

  const profile = {
    violation: { f1: 880, f2: 660, dur: 0.42, gain: 0.18 },
    scan:      { f1: 660, f2: 660, dur: 0.22, gain: 0.10 },
    alert:     { f1: 990, f2: 440, dur: 0.55, gain: 0.20 },
  }[tone];

  // Two oscillators for the dual-tone character
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  o1.type = "sine";
  o2.type = "sine";
  o1.frequency.setValueAtTime(profile.f1, t0);
  o2.frequency.setValueAtTime(profile.f2, t0);
  o2.frequency.linearRampToValueAtTime(profile.f2 * 0.94, t0 + profile.dur);

  // Soft attack, exponential decay envelope
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(profile.gain, t0 + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + profile.dur);

  // Mild low-pass to take the edge off the sine
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 2200;
  filt.Q.value = 0.6;

  o1.connect(env);
  o2.connect(env);
  env.connect(filt);
  filt.connect(c.destination);

  o1.start(t0);
  o2.start(t0 + 0.025);
  o1.stop(t0 + profile.dur + 0.05);
  o2.stop(t0 + profile.dur + 0.05);
}
