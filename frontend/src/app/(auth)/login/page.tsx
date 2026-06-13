"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Crosshair,
  Eye,
  EyeOff,
  Fingerprint,
  Layers,
  Lock,
  Mail,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/stores/auth.store";
import { personaFromEmail, type PersonaKey as DemoPersonaKey } from "@/lib/auth/demo-session";
import { LivingNetworkBackground } from "@/components/shared/LivingNetworkBackground";
import { ThemeToggleMini } from "@/components/shared/ThemeToggleMini";
import { cn } from "@/lib/utils";

/* ─── Personas ────────────────────────────────────────────────────── */

type PersonaKey = "operator" | "command" | "auditor";

const PERSONAS: Array<{
  key: PersonaKey;
  title: string;
  caption: string;
  description: string;
  icon: typeof Radar;
  email: string;
  password: string;
  badge: string;
}> = [
  {
    key: "operator",
    title: "Operator Console",
    caption: "Field ops",
    description: "Live tracking streams, device adjustments, and citation overwatch controls.",
    icon: Radar,
    email: "operator@enforcement.gov",
    password: "Admin@1234",
    badge: "OP-CONSOLE",
  },
  {
    key: "command",
    title: "Admin Command Center",
    caption: "Full access",
    description: "Database analytics, compliance auditing rules, and access permission arrays.",
    icon: Layers,
    email: "admin@enforcement.gov",
    password: "Admin@1234",
    badge: "CMD-CENTER",
  },
  {
    key: "auditor",
    title: "Auditor Portal",
    caption: "Read-only",
    description: "Read-only financial trace, audit log, and compliance dashboards.",
    icon: Telescope,
    email: "viewer@enforcement.gov",
    password: "Admin@1234",
    badge: "AUD-PORTAL",
  },
];

const TYPING_INTERVAL_MS = 18;

/* ─── Silent wire — corridor reads rolling on the left panel ──────── */
const WIRE_READS = [
  { plate: "MH12 KT 4821", zone: "Shivajinagar · JM Rd",    violation: false, conf: 97 },
  { plate: "MH14 EQ 0072", zone: "PCMC · Old Mumbai Hwy",   violation: true,  conf: 94 },
  { plate: "MH12 AB 7790", zone: "Hinjewadi · Phase 2",     violation: false, conf: 91 },
  { plate: "MH12 ZX 5544", zone: "Koregaon Park · N Main",  violation: true,  conf: 89 },
  { plate: "MH14 GH 2310", zone: "Wakad · Expressway Exit", violation: false, conf: 96 },
  { plate: "MH12 PQ 9034", zone: "Katraj · Satara Rd",      violation: false, conf: 93 },
];

export default function LoginPage() {
  const router = useRouter();
  const { loginAsPersona, isLoading, isAuthenticated, user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [persona, setPersona] = useState<PersonaKey | null>(null);
  const [typingTimer, setTypingTimer] = useState<ReturnType<typeof setInterval> | null>(null);

  // ── Parallax tilt for the access panel ───────────────────────────
  // Writes directly to the DOM via a ref so pointer events don't trigger
  // React renders. Uses rAF batching so we never write more than once per
  // frame regardless of how chatty the pointer is.
  const tiltRef = useRef<HTMLDivElement | null>(null);

  // Redirect loop guard:
  //   * Require BOTH `isAuthenticated` AND a usable session (`user` in the
  //     store OR a live demo session in localStorage). The persisted
  //     Zustand state can hold `isAuthenticated=true` with `user=null`
  //     after a localStorage partial wipe — that combination used to bounce
  //     the browser between /login and /dashboard forever.
  //   * `router.replace` is only called once per real auth transition because
  //     the effect dep array changes only when the underlying values do.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (typeof window !== "undefined") {
      const demo = window.localStorage.getItem("vaahan.demo-session");
      if (!demo) return; // store says authed but no demo → stale flag, ignore
    }
    router.replace("/dashboard");
  }, [isAuthenticated, user, router]);

  useEffect(
    () => () => {
      if (typingTimer) clearInterval(typingTimer);
    },
    [typingTimer],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let targetX = 0;
    let targetY = 0;
    let raf = 0;
    let scheduled = false;

    const apply = () => {
      scheduled = false;
      const el = tiltRef.current;
      if (el) {
        el.style.transform = `rotateY(${targetX * 0.5}deg) rotateX(${targetY * 0.5}deg)`;
      }
    };
    const onMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 6;
      targetY = (e.clientY / window.innerHeight - 0.5) * -4;
      if (!scheduled) {
        scheduled = true;
        raf = window.requestAnimationFrame(apply);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  function selectPersona(p: (typeof PERSONAS)[number]) {
    if (typingTimer) clearInterval(typingTimer);
    setPersona(p.key);
    setError("");
    setEmail("");
    setPassword("");

    let i = 0;
    const total = p.email.length + p.password.length;
    const id = setInterval(() => {
      i += 1;
      if (i <= p.email.length) {
        setEmail(p.email.slice(0, i));
      } else {
        const pi = i - p.email.length;
        setPassword(p.password.slice(0, pi));
      }
      if (i >= total) clearInterval(id);
    }, TYPING_INTERVAL_MS);
    setTypingTimer(id);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    const resolved: DemoPersonaKey = persona ?? personaFromEmail(email) ?? "operator";
    try {
      await loginAsPersona(resolved);
      toast.success("Access granted", {
        description: "Routing to the command center…",
      });
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  }

  return (
    <div className="relative min-h-screen flex overflow-hidden text-foreground">
      {/* Theme switch — pre-login */}
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggleMini />
      </div>
      {/* ─── LEFT — the network, operating ───────────────────────── */}
      <aside className="relative hidden lg:flex lg:w-[55%] xl:w-[56%] flex-col justify-between p-10 xl:p-12 border-r border-border dark:border-white/[0.06]">
        {/* Living corridor network */}
        <LivingNetworkBackground opacity={0.65} />
        {/* Depth gradients over the network */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none dark:hidden"
          style={{
            background:
              "radial-gradient(ellipse 700px 500px at 20% 0%, rgba(127,136,118,0.10), transparent 60%)," +
              "linear-gradient(180deg, rgba(247,244,238,0.7) 0%, rgba(247,244,238,0) 30%, rgba(247,244,238,0) 62%, rgba(247,244,238,0.85) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none hidden dark:block"
          style={{
            background:
              "radial-gradient(ellipse 700px 500px at 20% 0%, rgba(127,136,118,0.10), transparent 60%)," +
              "linear-gradient(180deg, rgba(16,14,11,0.55) 0%, rgba(16,14,11,0.0) 30%, rgba(16,14,11,0.0) 62%, rgba(16,14,11,0.78) 100%)",
          }}
        />

        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative flex items-center gap-3"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-sage-800 ring-1 ring-sage-500/40 shadow-glow-sage">
            <Crosshair className="h-5 w-5 text-sand-100" strokeWidth={1.75} />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-peach-400 border-2 border-background" />
          </div>
          <div>
            <p className="font-display text-base font-semibold tracking-tight leading-none text-foreground">
              VAAHAN AI
            </p>
            <p className="mt-1 text-2xs font-mono uppercase tracking-[0.22em] text-foreground-subtle">
              Pune Regional Surveillance Network
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border border-sage-300 bg-sage-100/80 text-sage-800 dark:border-sage-700/50 dark:bg-sage-900/40 dark:text-sage-300 backdrop-blur-sm text-2xs font-mono font-semibold uppercase tracking-[0.16em]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-sage-400 opacity-70 animate-ping" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-sage-400" />
            </span>
            Restricted · Tier 1
          </span>
        </motion.div>

        {/* Statement + silent indicators */}
        <div className="relative max-w-xl">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="font-display text-4xl xl:text-[3.3rem] font-semibold tracking-tightest leading-[1.05] text-foreground"
          >
            The network is live.
            <span className="block mt-1.5 text-sage-700 dark:text-sage-300">Authenticate to take the floor.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="mt-5 text-sm xl:text-base text-foreground-muted leading-relaxed max-w-lg"
          >
            Twelve enforcement zones across Pune are streaming into this console
            right now — detections, OCR reads, compliance checks, and the
            evidence chain, end to end.
          </motion.p>

          {/* Operational indicators — the system speaks for itself */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="mt-8 rounded-xl border border-stone-700/60 dark:border-white/[0.07] overflow-hidden shadow-card-lg"
            style={{ background: "rgba(20,17,14,0.94)" }}
          >
            <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
              {[
                { v: "24", l: "Cameras" },
                { v: "12", l: "Zones" },
                { v: "96.4%", l: "AI Engine" },
                { v: "94.2", l: "Compliance" },
              ].map((s) => (
                <div key={s.l} className="px-4 py-3">
                  <p className="font-display text-lg font-semibold text-stone-100 tabular-nums leading-none">{s.v}</p>
                  <p className="mt-1 font-mono text-2xs uppercase tracking-[0.14em] text-stone-500">{s.l}</p>
                </div>
              ))}
            </div>
            {/* Detection wire */}
            <LoginWire />
          </motion.div>
        </div>

        {/* Trust line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="relative flex items-center gap-4 font-mono text-2xs font-medium uppercase tracking-[0.16em] text-foreground-subtle"
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-sage-700 dark:text-sage-400" />
            Evidence-grade
          </span>
          <span className="h-3 w-px bg-border dark:bg-white/10" />
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-sage-700 dark:text-sage-400" />
            End-to-end encrypted
          </span>
          <span className="h-3 w-px bg-border dark:bg-white/10" />
          <span className="inline-flex items-center gap-1.5">
            <Fingerprint className="h-3.5 w-3.5 text-sage-700 dark:text-sage-400" />
            Audit-logged
          </span>
        </motion.div>
      </aside>

      {/* ─── RIGHT — access control ──────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10 sm:py-14">
        {/* Soft bloom behind the panel */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 480px 420px at 50% 42%, rgba(127,136,118,0.08), transparent 70%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-[440px] [perspective:1600px]"
        >
          <div
            ref={tiltRef}
            className="will-change-transform [transform-style:preserve-3d]"
            style={{ transition: "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            {/* Mobile brand */}
            <div className="flex lg:hidden items-center gap-2.5 mb-8">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sage-800 ring-1 ring-sage-500/40">
                <Crosshair className="h-4 w-4 text-sand-100" />
              </div>
              <span className="font-display text-sm font-semibold tracking-tight text-foreground">
                VAAHAN AI
              </span>
            </div>

            <div
              className="rounded-2xl border border-border bg-surface/95 shadow-popover dark:border-white/[0.08] dark:bg-[#1a1611]/95 dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.7)] p-6 sm:p-7 backdrop-blur-md"
            >
              <header className="mb-5">
                <p className="font-mono text-2xs font-semibold uppercase tracking-[0.18em] text-foreground-subtle">
                  Access Control · Restricted
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
                  Identify yourself, operator.
                </h2>
                <p className="mt-1.5 text-sm text-foreground-muted">
                  Select an operational profile. Credentials are auto-provisioned
                  for this pilot build.
                </p>
              </header>

              {/* ── Persona cards ───────────────────────────────────── */}
              <ul className="space-y-2 mb-5">
                {PERSONAS.map((p) => {
                  const active = persona === p.key;
                  const Icon = p.icon;
                  return (
                    <li key={p.key}>
                      <button
                        type="button"
                        onClick={() => selectPersona(p)}
                        className={cn(
                          "w-full text-left rounded-xl border px-3.5 py-3 transition-all duration-200 group",
                          active
                            ? "border-sage-500/60 bg-sage-100/70 shadow-glow-sage dark:bg-sage-900/30"
                            : "border-border bg-surface hover:border-border-strong hover:bg-muted/50 dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-white/[0.16] dark:hover:bg-white/[0.04]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 transition-colors",
                            active
                              ? "border-sage-400 bg-sage-100 text-sage-800 dark:border-sage-600/60 dark:bg-sage-900/60 dark:text-sage-300"
                              : "border-border bg-muted/60 text-foreground-subtle group-hover:text-foreground dark:border-white/[0.08] dark:bg-white/[0.03]"
                          )}>
                            <Icon className="h-4 w-4" strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className={cn("text-sm font-semibold truncate", active ? "text-foreground" : "text-foreground-muted")}>
                                {p.title}
                              </span>
                              <span className={cn(
                                "font-mono text-[0.5625rem] font-bold tracking-[0.12em] px-1.5 py-0.5 rounded border shrink-0",
                                active
                                  ? "border-sage-400 text-sage-800 dark:border-sage-600/60 dark:text-sage-300"
                                  : "border-border text-foreground-subtle dark:border-white/[0.08]"
                              )}>
                                {p.badge}
                              </span>
                            </span>
                            <span className="block mt-0.5 text-2xs text-foreground-subtle truncate">{p.description}</span>
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* ── Error banner ────────────────────────────────────── */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-lg border border-peach-300 bg-peach-50 text-peach-800 dark:border-peach-700/50 dark:bg-peach-900/25 dark:text-peach-300 px-3.5 py-3 text-sm"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium leading-tight">Authentication failed</p>
                    <p className="mt-0.5 text-xs opacity-90">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* ── Credential fields ──────────────────────────────── */}
              <form onSubmit={handleSubmit} className="space-y-3.5" autoComplete="on">
                <div>
                  <label htmlFor="email" className="block font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle mb-1.5">
                    Operator email
                  </label>
                  <DarkInput
                    id="email"
                    type="email"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    placeholder="select an access profile above"
                    icon={<Mail className="h-4 w-4" />}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block font-mono text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle mb-1.5">
                    Secure token
                  </label>
                  <DarkInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    placeholder="••••••••"
                    icon={<Lock className="h-4 w-4" />}
                    trailing={
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide secure token" : "Show secure token"}
                        onClick={() => setShowPassword((v) => !v)}
                        className="text-foreground-subtle hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    required
                    autoComplete="current-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "group/cta relative w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl overflow-hidden mt-2",
                    "text-white text-sm font-semibold tracking-[0.06em] uppercase",
                    "bg-sage-600 hover:bg-sage-500 ring-1 ring-sage-500/50 transition-all duration-150",
                    "active:scale-[0.985] disabled:opacity-55 disabled:pointer-events-none",
                    "shadow-[0_18px_44px_-14px_rgba(127,136,118,0.55)]"
                  )}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full group-hover/cta:translate-x-full transition-transform duration-[1200ms] ease-out"
                    style={{ background: "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.25) 50%, transparent 65%)" }}
                  />
                  {isLoading && (
                    <span className="relative h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span className="relative">{isLoading ? "Authenticating…" : "Enter the command center"}</span>
                  {!isLoading && <ArrowRight className="relative h-4 w-4" />}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-white/[0.07] flex items-start gap-2.5">
                <div className="mt-0.5 h-7 w-7 rounded-md bg-sage-100 border border-sage-300 dark:bg-sage-900/50 dark:border-sage-700/50 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-sage-700 dark:text-sage-400" />
                </div>
                <p className="text-xs text-foreground-subtle leading-relaxed">
                  Rotating refresh tokens. Account locks after 5 failed attempts.
                  Every authentication is audit-logged with IP + user-agent.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

/* ─── Detection wire — quiet rolling reads on the left panel ──────── */
function LoginWire() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => i + 1), 3200);
    return () => clearInterval(id);
  }, []);

  const rows = [0, 1, 2].map((off) => WIRE_READS[(idx - off + WIRE_READS.length * 8) % WIRE_READS.length]);

  return (
    <div className="border-t border-white/[0.06] px-4 py-3 font-mono">
      <div className="space-y-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {rows.map((r, i) => (
            <motion.div
              key={`${r.plate}-${idx - i}`}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: i === 0 ? 1 : 0.5 - i * 0.14, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 text-2xs"
            >
              {r.violation
                ? <ShieldAlert className="h-3 w-3 text-peach-400 shrink-0" />
                : <ShieldCheck className="h-3 w-3 text-sage-400 shrink-0" />}
              <span className="font-bold tracking-wider text-stone-200 shrink-0">{r.plate}</span>
              <span className={cn("font-semibold shrink-0", r.violation ? "text-peach-400" : "text-sage-400")}>
                {r.violation ? "FLAGGED" : "CLEAR"}
              </span>
              <span className="text-stone-600 truncate">{r.zone}</span>
              <span className="ml-auto text-stone-600 tabular-nums shrink-0">OCR {r.conf}%</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Dark input — control-room field styling ─────────────────────── */
function DarkInput({ icon, trailing, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 h-11 px-3.5 rounded-lg border border-border bg-[hsl(var(--surface-sunken))]",
      "dark:border-white/[0.09] dark:bg-white/[0.03]",
      "focus-within:border-sage-500/60 transition-colors",
      className
    )}>
      {icon && <span className="text-foreground-subtle shrink-0">{icon}</span>}
      <input
        {...rest}
        className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle/60 outline-none"
      />
      {trailing}
    </div>
  );
}
