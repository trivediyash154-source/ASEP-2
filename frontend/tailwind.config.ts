import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

/**
 * VAAHAN AI — Cinematic Government Intelligence Design System
 *
 * Palette: earthy industrial command-center.
 * Sage / peach / bronze on warm-neutral surfaces.
 * Threat classification: clear → critical.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1600px" },
    },
    extend: {
      fontFamily: {
        sans:    ["var(--font-inter)",  ...fontFamily.sans],
        display: ["var(--font-plex)",   "var(--font-inter)", ...fontFamily.sans],
        mono:    ["var(--font-mono)",   ...fontFamily.mono],
      },
      colors: {
        // ── Semantic tokens (HSL via CSS vars) ────────────────────
        background:           "hsl(var(--background))",
        surface:              "hsl(var(--surface))",
        "surface-elevated":   "hsl(var(--surface-elevated))",
        "surface-sunken":     "hsl(var(--surface-sunken))",
        foreground:           "hsl(var(--foreground))",
        "foreground-muted":   "hsl(var(--foreground-muted))",
        "foreground-subtle":  "hsl(var(--foreground-subtle))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        highlight: { DEFAULT: "hsl(var(--highlight))", foreground: "hsl(var(--highlight-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        border:         "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring:  "hsl(var(--ring))",

        // ── Threat classification (alpha-value enables bg-threat-*/10 etc.) ──
        threat: {
          clear:    "hsl(var(--threat-clear) / <alpha-value>)",
          low:      "hsl(var(--threat-low) / <alpha-value>)",
          medium:   "hsl(var(--threat-medium) / <alpha-value>)",
          high:     "hsl(var(--threat-high) / <alpha-value>)",
          critical: "hsl(var(--threat-critical) / <alpha-value>)",
        },

        // ── Brand scales ──────────────────────────────────────────
        sage: {
          50:  "#F4F5F2",
          100: "#E8EAE3",
          200: "#D2D6C8",
          300: "#A9B394",
          400: "#969D87",
          500: "#7F8876",
          600: "#67705E",
          700: "#525947",
          800: "#404633",
          900: "#2D3322",
        },
        peach: {
          50:  "#FDF4EF",
          100: "#FCE8DD",
          200: "#F8CFB6",
          300: "#F2B294",
          400: "#ED9F7E",
          500: "#E58060",
          600: "#D26B4A",
          700: "#B0563C",
          800: "#8F4634",
          900: "#6B3727",
        },
        bronze: {
          50:  "#FAF3EB",
          100: "#F3E4D2",
          200: "#E5C7A8",
          300: "#D5A77E",
          400: "#C9925F",
          500: "#BD8658",
          600: "#A0703F",
          700: "#815A33",
          800: "#654629",
          900: "#4A3520",
        },
        sand: {
          50:  "#FBF7F2",
          100: "#F4ECDF",
          200: "#E8D8C8",
          300: "#DAC5B0",
          400: "#C9AC8F",
          500: "#B79377",
          600: "#9A7758",
          700: "#7E6147",
          800: "#604A38",
          900: "#43342A",
        },
        stone: {
          50:  "#FAFAF8",
          100: "#F4F4F0",
          150: "#ECECE6",
          200: "#E2E1DA",
          300: "#CBCAC0",
          400: "#A6A498",
          500: "#7C7970",
          600: "#5C5A53",
          700: "#45433E",
          800: "#2E2D29",
          900: "#1A1917",
          950: "#0F0E0C",
        },

        // ── Status ────────────────────────────────────────────────
        status: {
          success: "#5C8A6E",
          warning: "#C9925F",
          danger:  "#B95C5C",
          info:    "#7C8FA3",
          neutral: "#7C7970",
        },
      },

      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        xl:   "calc(var(--radius) + 4px)",
        "2xl":"calc(var(--radius) + 8px)",
      },

      boxShadow: {
        "xs":         "0 1px 1px 0 rgba(45,51,34,0.03)",
        "sm":         "0 1px 2px 0 rgba(45,51,34,0.04), 0 1px 1px 0 rgba(45,51,34,0.03)",
        "card":       "0 1px 2px 0 rgba(45,51,34,0.04), 0 1px 3px -1px rgba(45,51,34,0.05)",
        "card-md":    "0 2px 4px -1px rgba(45,51,34,0.05), 0 4px 8px -2px rgba(45,51,34,0.06)",
        "card-lg":    "0 4px 8px -2px rgba(45,51,34,0.06), 0 12px 24px -4px rgba(45,51,34,0.08)",
        "panel":      "0 0 0 1px rgba(45,51,34,0.05), 0 2px 6px rgba(45,51,34,0.04)",
        "popover":    "0 4px 12px rgba(45,51,34,0.08), 0 16px 40px -8px rgba(45,51,34,0.12), 0 0 0 1px rgba(45,51,34,0.04)",
        "inset-sunken":"inset 0 1px 2px 0 rgba(45,51,34,0.04)",
        "focus":      "0 0 0 3px rgba(127,136,118,0.22)",
        "focus-accent":"0 0 0 3px rgba(237,159,126,0.28)",
        "focus-danger":"0 0 0 3px rgba(185,92,92,0.22)",
        // Operational glow shadows
        "glow-sage":    "0 0 12px 2px rgba(127,136,118,0.28)",
        "glow-peach":   "0 0 12px 2px rgba(237,159,126,0.32)",
        "glow-bronze":  "0 0 12px 2px rgba(189,134,88,0.32)",
        "glow-threat":  "0 0 16px 4px rgba(185,92,92,0.35)",
        "inner-top":    "inset 0 1px 0 rgba(255,255,255,0.08)",
      },

      fontSize: {
        "2xs":    ["0.6875rem", { lineHeight: "0.9375rem", letterSpacing: "0.02em" }],
        "xs":     ["0.75rem",   { lineHeight: "1.125rem" }],
        "sm":     ["0.8125rem", { lineHeight: "1.25rem" }],
        "base":   ["0.9375rem", { lineHeight: "1.4375rem" }],
        "lg":     ["1.0625rem", { lineHeight: "1.625rem" }],
        "xl":     ["1.25rem",   { lineHeight: "1.75rem",  letterSpacing: "-0.005em" }],
        "2xl":    ["1.5rem",    { lineHeight: "2rem",     letterSpacing: "-0.01em" }],
        "3xl":    ["1.875rem",  { lineHeight: "2.25rem",  letterSpacing: "-0.015em" }],
        "4xl":    ["2.375rem",  { lineHeight: "2.75rem",  letterSpacing: "-0.02em" }],
        "5xl":    ["3rem",      { lineHeight: "1.1",      letterSpacing: "-0.025em" }],
        "display":["3.75rem",   { lineHeight: "1.05",     letterSpacing: "-0.03em" }],
      },

      letterSpacing: {
        tightest: "-0.03em",
        data: "0.005em",
        op: "0.12em",        // operational label spacing
      },

      transitionTimingFunction: {
        "out-quart":    "cubic-bezier(0.25, 1, 0.5, 1)",
        "out-expo":     "cubic-bezier(0.16, 1, 0.3, 1)",
        "in-out-quart": "cubic-bezier(0.76, 0, 0.24, 1)",
        "spring":       "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },

      transitionDuration: {
        "150": "150ms",
        "250": "250ms",
        "400": "400ms",
        "600": "600ms",
      },

      backgroundImage: {
        "grain":         "radial-gradient(rgba(45,51,34,0.025) 1px, transparent 1px)",
        "sage-radial":   "radial-gradient(circle at top right, rgba(169,179,148,0.18), transparent 60%)",
        "peach-radial":  "radial-gradient(circle at bottom left, rgba(237,159,126,0.16), transparent 55%)",
        "warm-mesh":     "linear-gradient(135deg, #FBF7F2 0%, #F4ECDF 100%)",
        "panel-hairline":"linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)",
        // Cinematic dark overlays
        "dark-radial":   "radial-gradient(circle at 30% 20%, rgba(127,136,118,0.06), transparent 50%)",
        "scan-line":     "linear-gradient(180deg, transparent, rgba(169,179,148,0.08) 50%, transparent)",
      },

      animation: {
        "fade-in":        "fadeIn 0.25s cubic-bezier(0.16,1,0.3,1)",
        "fade-up":        "fadeUp 0.4s cubic-bezier(0.16,1,0.3,1)",
        "fade-down":      "fadeDown 0.4s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-left":  "slideInLeft 0.3s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-right": "slideInRight 0.3s cubic-bezier(0.16,1,0.3,1)",
        "scale-in":       "scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        "pulse-soft":     "pulseSoft 2.4s ease-in-out infinite",
        "pulse-ring":     "pulseRing 2s cubic-bezier(0.16,1,0.3,1) infinite",
        "shimmer":        "shimmer 1.8s linear infinite",
        "counter-tick":   "counterTick 0.4s cubic-bezier(0.16,1,0.3,1)",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        // Operational
        "scan-sweep":     "scanSweep 3.5s linear infinite",
        "ocr-pulse":      "ocrPulse 1.8s ease-in-out infinite",
        "ai-lock":        "aiLockPulse 1.5s ease-in-out 3",
        "threat-glow":    "threatGlow 2.4s ease-in-out infinite",
        "radar-ping":     "radarPing 2s ease-out infinite",
        "signal-flicker": "signalFlicker 4s linear infinite",
        "reveal-right":   "revealRight 0.6s cubic-bezier(0.16,1,0.3,1) forwards",
      },

      keyframes: {
        fadeIn:     { "0%": { opacity: "0" },                                "100%": { opacity: "1" } },
        fadeUp:     { "0%": { opacity: "0", transform: "translateY(8px)" },  "100%": { opacity: "1", transform: "translateY(0)" } },
        fadeDown:   { "0%": { opacity: "0", transform: "translateY(-8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideInLeft:  { "0%": { opacity: "0", transform: "translateX(-12px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
        slideInRight: { "0%": { opacity: "0", transform: "translateX(12px)" },  "100%": { opacity: "1", transform: "translateX(0)" } },
        scaleIn:    { "0%": { opacity: "0", transform: "scale(0.96)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        pulseSoft:  { "0%, 100%": { opacity: "1" }, "50%": { opacity: "0.5" } },
        pulseRing:  { "0%": { transform: "scale(1)", opacity: "0.55" }, "70%": { transform: "scale(2.2)", opacity: "0" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
        shimmer:    { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        counterTick:{ "0%": { transform: "translateY(6px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        // Operational keyframes
        scanSweep:    { "0%": { top: "-2px", opacity: "0" }, "5%": { opacity: "1" }, "95%": { opacity: "1" }, "100%": { top: "100%", opacity: "0" } },
        ocrPulse:     { "0%, 100%": { opacity: "0.4", boxShadow: "0 0 0 0 rgba(169,179,148,0)" }, "50%": { opacity: "1", boxShadow: "0 0 8px 2px rgba(169,179,148,0.4)" } },
        aiLockPulse:  { "0%, 100%": { opacity: "0", transform: "scale(1.02)" }, "40%": { opacity: "1", transform: "scale(1)" } },
        threatGlow:   { "0%, 100%": { boxShadow: "0 0 4px 0 currentColor" }, "50%": { boxShadow: "0 0 14px 2px currentColor" } },
        radarPing:    { "0%": { transform: "scale(0.4)", opacity: "0.9" }, "80%": { transform: "scale(2.2)", opacity: "0" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
        signalFlicker:{ "0%, 89%, 91%, 96%, 100%": { opacity: "1" }, "90%": { opacity: "0.35" }, "95%": { opacity: "0.6" } },
        revealRight:  { "0%": { clipPath: "inset(0 100% 0 0)" }, "100%": { clipPath: "inset(0 0% 0 0)" } },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
