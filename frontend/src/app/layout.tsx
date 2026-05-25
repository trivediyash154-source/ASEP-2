import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/shared/layout/Providers";
import "@/styles/globals.css";

// Inter: UI body text — optimised for screen at all sizes.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// IBM Plex Sans: display family for headings, KPIs, numerics — gives the
// industrial / instrument-panel character of the system.
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// JetBrains Mono: ANPR plates, IDs, hashes, log timestamps.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "VAAHAN AI — Intelligent Enforcement",
    template: "%s · VAAHAN AI",
  },
  description:
    "Industrial AI surveillance and automated enforcement. Real-time ANPR, forensic evidence, and challan workflows for transport authorities.",
  keywords: ["ANPR", "traffic enforcement", "AI surveillance", "smart city", "challan", "VAAHAN"],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${plex.variable} ${mono.variable} font-sans bg-background text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
