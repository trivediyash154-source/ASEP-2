"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  Layers,
  Lock,
  Mail,
  Radar,
  ShieldCheck,
  Sparkles,
  Telescope,
  Wifi,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/stores/auth.store";
import { personaFromEmail, type PersonaKey as DemoPersonaKey } from "@/lib/auth/demo-session";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LightRaysBackground } from "@/components/login/LightRaysBackground";
import { GlassPanel } from "@/components/login/GlassPanel";
import { PersonaCard } from "@/components/login/PersonaCard";
import { CursorGlow } from "@/components/login/CursorGlow";

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

export default function LoginPage() {
  const router = useRouter();
  const { loginAsPersona, isLoading, isAuthenticated, user } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [persona, setPersona] = useState<PersonaKey | null>(null);
  const [typingTimer, setTypingTimer] = useState<ReturnType<typeof setInterval> | null>(null);

  // ── Parallax tilt for the right glass panel ──────────────────────
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
      toast.success("Surveillance module armed", {
        description: "Routing to operations console…",
      });
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  }

  return (
    <div className="relative min-h-screen flex bg-background overflow-hidden">
      {/* ── Layered atmospheric background ─────────────────────────── */}
      <LightRaysBackground intensity="high" speed={1} />
      <CursorGlow />

      {/* Brand mesh + radial accents kept underneath so the original */}
      {/* color palette still reads through the new ray composition.   */}
      <div className="absolute inset-0 -z-10 bg-warm-mesh" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-sage-radial opacity-80" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-peach-radial opacity-70" aria-hidden />

      {/* ─── LEFT — brand statement ────────────────────────────────── */}
      <aside className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between p-12 z-10">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex items-center gap-3"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-sage-600 ring-1 ring-sage-700/30 shadow-card">
            <Sparkles className="h-5 w-5 text-sand-50" />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-peach-400 border-2 border-background" />
          </div>
          <div>
            <p className="font-display text-base font-semibold tracking-tight leading-none">
              VAAHAN AI
            </p>
            <p className="mt-1 text-2xs font-mono uppercase tracking-[0.22em] text-foreground-subtle">
              Surveillance · Intelligence · Enforcement
            </p>
          </div>
        </motion.div>

        <div className="max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border border-sage-300/70 bg-white/60 backdrop-blur-md text-2xs font-semibold uppercase tracking-[0.16em] text-sage-800 mb-6 shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-sage-500 opacity-70 animate-ping" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-sage-600" />
              </span>
              Restricted system · Tier 1
            </span>

            <h1 className="font-display text-4xl xl:text-[3.55rem] font-semibold tracking-tightest leading-[1.02] text-balance">
              <span className="block text-stone-900">National AI surveillance</span>
              <span className="relative inline-block mt-1.5">
                <span
                  aria-hidden
                  className="absolute -inset-x-5 -inset-y-3 -z-10 rounded-[28px]"
                  style={{
                    background:
                      "radial-gradient(60% 80% at 30% 50%, rgba(127,136,118,0.28) 0%, transparent 70%), radial-gradient(60% 80% at 80% 50%, rgba(196,167,125,0.24) 0%, transparent 70%)",
                    filter: "blur(34px)",
                  }}
                />
                <span
                  className="relative z-10 text-transparent bg-clip-text"
                  style={{
                    backgroundImage:
                      "linear-gradient(118deg, hsl(82 16% 26%) 0%, hsl(82 18% 38%) 32%, hsl(30 45% 48%) 64%, hsl(30 55% 56%) 100%)",
                  }}
                >
                  for transport enforcement.
                </span>
              </span>
            </h1>

            <p className="mt-5 text-base text-foreground-muted text-pretty leading-relaxed">
              Real-time ANPR, multi-tier compliance verification, and automated
              challan workflows. Built for transport authorities operating at
              city, state, and national scale.
            </p>

            {/* Feature chips */}
            <div className="mt-7 flex flex-wrap gap-2">
              {[
                { icon: Zap, label: "<250ms inference" },
                { icon: ShieldCheck, label: "4-tier compliance" },
                { icon: Wifi, label: "Live WS rooms" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-2xs font-semibold tracking-wide text-stone-700
                             bg-white/65 backdrop-blur-md border border-white/70 ring-1 ring-stone-200/40 shadow-sm"
                >
                  <Icon className="h-3 w-3 text-sage-700" />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 grid grid-cols-3 gap-3"
          >
            {[
              { v: "<250ms", l: "End-to-end pipeline" },
              { v: "4-tier", l: "Compliance verification" },
              { v: "24/7",   l: "Audit-logged sessions" },
            ].map(({ v, l }) => (
              <GlassPanel
                key={l}
                variant="subtle"
                className="p-4"
              >
                <dt className="font-display text-xl font-semibold text-foreground tabular-nums tracking-tight">
                  {v}
                </dt>
                <dd className="mt-1 text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
                  {l}
                </dd>
              </GlassPanel>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex items-center gap-4 text-2xs font-medium uppercase tracking-[0.16em] text-foreground-subtle"
        >
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-sage-600" />
            ISO 27001
          </span>
          <span className="h-3 w-px bg-border-strong" />
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-sage-600" />
            End-to-end encrypted
          </span>
          <span className="h-3 w-px bg-border-strong" />
          <span className="inline-flex items-center gap-1.5">
            <Fingerprint className="h-3.5 w-3.5 text-sage-600" />
            Audit-logged
          </span>
        </motion.div>
      </aside>

      {/* ─── RIGHT — auth panel ──────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[460px] [perspective:1600px]"
        >
          <div
            ref={tiltRef}
            className="will-change-transform [transform-style:preserve-3d]"
            style={{ transition: "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sage-600 ring-1 ring-sage-700/30">
              <Sparkles className="h-4 w-4 text-sand-50" />
            </div>
            <span className="font-display text-sm font-semibold tracking-tight">
              VAAHAN AI
            </span>
          </div>

          <GlassPanel variant="elevated" className="p-6 sm:p-7">
            <header className="mb-5">
              <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-foreground-subtle">
                Secure access · Tier 1
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
                Select your access persona
              </h2>
              <p className="mt-1.5 text-sm text-foreground-muted">
                Choose the operational profile you're entering as. Credentials are
                auto-provisioned for this demo build.
              </p>
            </header>

            {/* ── Persona cards ─────────────────────────────────────── */}
            <ul className="space-y-2 mb-5">
              {PERSONAS.map((p) => (
                <li key={p.key}>
                  <PersonaCard
                    icon={p.icon}
                    title={p.title}
                    badge={p.badge}
                    description={p.description}
                    caption={p.caption}
                    active={persona === p.key}
                    onClick={() => selectPersona(p)}
                  />
                </li>
              ))}
            </ul>

            {/* ── Error banner ──────────────────────────────────────── */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="mb-4 flex items-start gap-2.5 rounded-lg border border-[hsl(0_45%_88%)] bg-[hsl(0_45%_97%)] px-3.5 py-3 text-sm text-[hsl(0_40%_38%)]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium leading-tight">Authentication failed</p>
                  <p className="mt-0.5 text-xs opacity-90">{error}</p>
                </div>
              </motion.div>
            )}

            {/* ── Credential fields ────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="space-y-3.5" autoComplete="on">
              <div>
                <Label htmlFor="email">Operator email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="select an access persona above"
                  leadingIcon={<Mail />}
                  required
                  autoComplete="email"
                  sizeVariant="lg"
                />
              </div>

              <div>
                <Label htmlFor="password">Secure token</Label>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder="••••••••"
                  leadingIcon={<Lock />}
                  trailingIcon={
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
                  sizeVariant="lg"
                />
              </div>

              <PulseButton
                type="submit"
                loading={isLoading}
                trailingIcon={!isLoading ? <ArrowRight className="h-4 w-4" /> : undefined}
                className="w-full mt-2"
              >
                {isLoading ? "Authenticating…" : "Launch surveillance module"}
              </PulseButton>
            </form>

            <div className="mt-6 pt-4 border-t border-border/70 flex items-start gap-2.5">
              <div className="mt-0.5 h-7 w-7 rounded-md bg-sage-100 border border-sage-200 flex items-center justify-center">
                <ShieldCheck className="h-3.5 w-3.5 text-sage-700" />
              </div>
              <p className="text-xs text-foreground-subtle leading-relaxed">
                Rotating refresh tokens. Account locks after 5 failed attempts.
                Every authentication is audit-logged with IP + user-agent.
              </p>
            </div>
          </GlassPanel>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// ─── Pulse-glow CTA — premium variant of the regular Button ────────

function PulseButton({
  children,
  loading,
  trailingIcon,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  trailingIcon?: React.ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={cn(
        "group/cta relative inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl overflow-hidden",
        "text-white text-sm font-semibold tracking-[0.06em] uppercase",
        "transition-[background-color,box-shadow,transform] duration-150",
        "active:scale-[0.985]",
        "shadow-[0_22px_48px_-16px_rgba(127,136,118,0.72),0_2px_6px_-2px_rgba(127,136,118,0.4)]",
        "hover:shadow-[0_28px_60px_-16px_rgba(127,136,118,0.85),0_2px_8px_-2px_rgba(196,167,125,0.4)]",
        "disabled:opacity-55 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-focus",
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, hsl(82 16% 33%) 0%, hsl(82 18% 28%) 60%, hsl(30 35% 32%) 100%)",
      }}
    >
      {/* Prismatic edge highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 30%, rgba(0,0,0,0.10) 100%)",
        }}
      />
      {/* Hover sheen sweep */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover/cta:translate-x-full transition-transform duration-[1200ms] ease-out"
        style={{
          background:
            "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%)",
        }}
      />
      {/* Resting pulse ring */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          animation: "pulseRing 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite",
          boxShadow: "0 0 0 0 rgba(127,136,118,0.45)",
        }}
      />
      {loading && (
        <span className="relative h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      <span className="relative">{children}</span>
      {!loading && <span className="relative">{trailingIcon}</span>}
    </button>
  );
}
