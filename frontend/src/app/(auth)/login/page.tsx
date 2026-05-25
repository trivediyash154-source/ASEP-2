"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/lib/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ─── Personas — replaces the old plain-text credential dump ────── */

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
    caption: "Field operations",
    description:
      "Live tracking streams, device adjustments, and citation overwatch controls.",
    icon: Radar,
    email: "operator@enforcement.gov",
    password: "Admin@1234",
    badge: "OP-CONSOLE",
  },
  {
    key: "command",
    title: "Admin Command Center",
    caption: "Full system access",
    description:
      "Database analytics, compliance auditing rules, and access permission arrays.",
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
  const { login, isLoading, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [persona, setPersona] = useState<PersonaKey | null>(null);
  const [typingTimer, setTypingTimer] = useState<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  useEffect(
    () => () => {
      if (typingTimer) clearInterval(typingTimer);
    },
    [typingTimer]
  );

  /* Subtle auto-type — fills the inputs character-by-character so judges
     can see what's being injected, without exposing a static cred dump. */
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
    try {
      await login(email, password);
      toast.success("Surveillance module armed", {
        description: "Routing to operations console…",
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const msg =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? "Please correct the highlighted fields"
          : (err as { message?: string })?.message?.includes("Network")
          ? "Cannot reach the platform. Check your connection."
          : "Invalid credentials";
      setError(msg);
    }
  }

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">
      {/* ─── LEFT — operational brand panel ───────────────────────── */}
      <aside className="hidden lg:flex relative lg:w-[44%] xl:w-[40%] flex-col justify-between p-12 text-foreground bg-sage-radial">
        <div className="absolute inset-0 -z-10 bg-warm-mesh" aria-hidden />
        <div className="absolute inset-0 -z-10 bg-peach-radial" aria-hidden />
        <div className="absolute inset-0 -z-10 opacity-[0.35] bg-grain [background-size:24px_24px]" aria-hidden />

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
            <span className="inline-flex items-center gap-1.5 px-2 h-6 rounded-md border border-sage-300 bg-sage-100/70 text-2xs font-semibold uppercase tracking-[0.16em] text-sage-800 mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-sage-600 animate-pulse" />
              Restricted system
            </span>
            <h1 className="font-display text-4xl xl:text-5xl font-semibold tracking-tightest leading-[1.05] text-balance">
              National AI surveillance
              <br />
              for transport enforcement.
            </h1>
            <p className="mt-5 text-base text-foreground-muted text-pretty leading-relaxed">
              Real-time ANPR, multi-tier compliance verification, and automated
              challan workflows. Built for transport authorities operating at
              city, state, and national scale.
            </p>
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
              <div
                key={l}
                className="rounded-xl bg-surface/70 border border-border/60 backdrop-blur-[2px] p-4"
              >
                <dt className="font-display text-xl font-semibold text-foreground tabular-nums tracking-tight">
                  {v}
                </dt>
                <dd className="mt-1 text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle">
                  {l}
                </dd>
              </div>
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
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[440px]"
        >
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sage-600 ring-1 ring-sage-700/30">
              <Sparkles className="h-4 w-4 text-sand-50" />
            </div>
            <span className="font-display text-sm font-semibold tracking-tight">
              VAAHAN AI
            </span>
          </div>

          <header className="mb-6">
            <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-foreground-subtle">
              Secure access · Tier 1
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
              Select your access persona
            </h2>
            <p className="mt-1.5 text-sm text-foreground-muted">
              Choose the operational profile you're entering as. Credentials are auto-provisioned for this demo build.
            </p>
          </header>

          {/* ── Persona cards ───────────────────────────────────────── */}
          <ul className="space-y-2 mb-5">
            {PERSONAS.map((p) => {
              const active = persona === p.key;
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => selectPersona(p)}
                    className={cn(
                      "group w-full text-left rounded-xl border bg-surface p-3.5 transition-all",
                      "flex items-center gap-3",
                      active
                        ? "border-sage-500 ring-2 ring-sage-200 shadow-card-md"
                        : "border-border hover:border-border-strong hover:bg-stone-50"
                    )}
                  >
                    <span
                      className={cn(
                        "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors",
                        active
                          ? "bg-sage-600 text-white ring-1 ring-sage-700/30"
                          : "bg-sage-100 text-sage-800 ring-1 ring-sage-200 group-hover:bg-sage-200"
                      )}
                    >
                      <p.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground tracking-tight">
                          {p.title}
                        </span>
                        <span className="font-mono text-2xs uppercase tracking-[0.14em] text-foreground-subtle">
                          {p.badge}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-foreground-muted text-pretty">
                        {p.description}
                      </p>
                    </div>
                    <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground-subtle shrink-0">
                      {p.caption}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* ── Error banner ────────────────────────────────────────── */}
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

          {/* ── Credential fields (filled by persona auto-type) ─────── */}
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

          <div className="mt-6 pt-4 border-t border-border flex items-start gap-2.5">
            <div className="mt-0.5 h-7 w-7 rounded-md bg-sage-100 border border-sage-200 flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-sage-700" />
            </div>
            <p className="text-xs text-foreground-subtle leading-relaxed">
              Rotating refresh tokens. Account locks after 5 failed attempts.
              Every authentication is audit-logged with IP + user-agent.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// ─── Pulse-glow CTA — a one-off variant of the regular Button ────────

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
        "relative inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg",
        "bg-sage-600 text-white text-sm font-semibold tracking-[0.06em] uppercase",
        "transition-[background-color,box-shadow,transform] duration-150",
        "hover:bg-sage-700 active:scale-[0.985]",
        "disabled:opacity-55 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-focus",
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-sage-300/0"
        style={{
          animation: "pulseRing 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite",
          boxShadow: "0 0 0 0 rgba(127,136,118,0.45)",
        }}
      />
      {loading && (
        <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}
