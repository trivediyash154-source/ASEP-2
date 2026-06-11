"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Apple,
  CheckCircle2,
  Loader2,
  Plug,
  Smartphone,
  Video,
  Wifi,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  cameraId: string;
  onClose: () => void;
  onConnected: (source: string) => void;
}

type Preset = "ip-webcam" | "iphone-http" | "droidcam-android" | "rtsp" | "webcam";

const PRESETS: Array<{
  key: Preset;
  title: string;
  desc: string;
  icon: typeof Smartphone;
  placeholder: string;
  helper: string;
}> = [
  {
    key: "ip-webcam",
    title: "IP Webcam (Android)",
    desc: "Stream from your Android phone over Wi-Fi using the IP Webcam app",
    icon: Smartphone,
    placeholder: "http://192.168.1.42:8080/video",
    helper:
      "Install 'IP Webcam' from Play Store → scroll down → Start server → use the IPv4 URL ending in /video. Keep the phone screen ON (the server pauses when locked on some Androids).",
  },
  {
    key: "iphone-http",
    title: "iPhone (Iriun / EpocCam)",
    desc: "iOS apps that expose a real HTTP/MJPEG stream",
    icon: Apple,
    placeholder: "http://192.168.1.42:8080/video",
    helper:
      "Free DroidCam on iOS does NOT expose an HTTP stream — it only works with their desktop client. Use 'Iriun Webcam' (port 8080, path /video) or 'EpocCam' instead. Same Wi-Fi as this machine.",
  },
  {
    key: "droidcam-android",
    title: "DroidCam (Android only)",
    desc: "MJPEG stream from DroidCam on Android",
    icon: Smartphone,
    placeholder: "http://192.168.1.42:4747/video",
    helper:
      "Android DroidCam exposes http://<phone-ip>:4747/video. On iPhone the free DroidCam does not — pick the 'iPhone' preset above instead.",
  },
  {
    key: "rtsp",
    title: "RTSP / IP camera",
    desc: "Real ONVIF or fixed IP camera (TCP transport)",
    icon: Wifi,
    placeholder: "rtsp://admin:pass@192.168.1.50:554/Streaming/Channels/101",
    helper: "Username / password are passed in the URL as standard RTSP auth.",
  },
  {
    key: "webcam",
    title: "Local webcam",
    desc: "USB or built-in laptop camera (host index)",
    icon: Video,
    placeholder: "0",
    helper:
      "On Docker for Mac the backend container can't normally access /dev/video*. Works best when backend runs natively or on Linux with --device.",
  },
];

type ProbeResult = {
  reachable: boolean;
  kind?: string;
  status?: number;
  content_type?: string | null;
  error?: string;
  hint?: string | null;
};

// Remembered across sessions so the operator taps Connect once on stage.
const LAST_SOURCE_KEY = "vaahan:lastSource";

export function MobileCameraConnect({ open, cameraId, onClose, onConnected }: Props) {
  const [preset, setPreset] = useState<Preset>("ip-webcam");
  const [source, setSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [probe, setProbe] = useState<ProbeResult | null>(null);

  const current = PRESETS.find((p) => p.key === preset)!;

  // Pre-fill the last source that worked on this machine — on stage you tap
  // Connect once, no typing. Falls back to the selected preset's placeholder.
  useEffect(() => {
    if (!open) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_SOURCE_KEY);
    } catch {
      /* localStorage unavailable */
    }
    setSource(last || current.placeholder);
    setProbe(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ONE button: probe, then connect on success, then remember the URL. Removes
  // the separate Test step so there's nothing to fumble live.
  async function connectFlow() {
    const url = source.trim();
    if (!url) {
      toast.error("Enter a stream source first");
      return;
    }
    setSubmitting(true);
    setProbe(null);
    try {
      // 1) Probe — fast, gives a clear reason if it's unreachable.
      let pr: ProbeResult | null = null;
      try {
        const r = await apiClient.post(`/cameras/demo/probe`, { source_url: url });
        pr = r.data as ProbeResult;
        setProbe(pr);
      } catch {
        pr = null; // probe failed to run — fall through and let /connect try anyway
      }
      if (pr && !pr.reachable) {
        toast.error("Source not reachable", { description: pr.hint || pr.error || "Check Wi-Fi, port, and the /video path." });
        return;
      }
      // 2) Connect.
      await apiClient.post(`/cameras/demo/${cameraId}/connect`, { source_url: url });
      try {
        localStorage.setItem(LAST_SOURCE_KEY, url);
      } catch {
        /* ignore */
      }
      toast.success("Stream opened", { description: "ANPR pipeline is processing frames live." });
      onConnected(url);
      onClose();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not connect";
      toast.error("Stream failed", { description: String(detail) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-stone-900/35 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 bg-surface border border-border rounded-2xl shadow-popover overflow-hidden"
          >
            <header className="flex items-start justify-between gap-3 p-5 border-b border-border">
              <div>
                <p className="section-eyebrow flex items-center gap-1.5">
                  <Plug className="h-3 w-3" />
                  Live source
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-foreground tracking-tight">
                  Connect a camera feed
                </h2>
                <p className="mt-1 text-xs text-foreground-muted">
                  Your last working source is pre-filled — just hit <span className="font-semibold">Connect</span>.
                  It probes the source, then opens the live pipeline.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-surface hover:bg-stone-50 dark:hover:bg-stone-800 text-foreground-subtle hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPreset(p.key);
                    setSource(p.placeholder);
                    setProbe(null);
                  }}
                  className={cn(
                    "text-left rounded-xl border p-3.5 transition-colors",
                    preset === p.key
                      ? "border-sage-500 bg-sage-50 ring-2 ring-sage-200 dark:bg-sage-900/30 dark:ring-sage-700/50"
                      : "border-border bg-surface hover:border-border-strong hover:bg-stone-50 dark:hover:bg-stone-800"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-md bg-sage-100 text-sage-800 ring-1 ring-sage-200 dark:bg-sage-900/40 dark:text-sage-300 dark:ring-sage-700/50 flex items-center justify-center">
                      <p.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground tracking-tight truncate">
                        {p.title}
                      </p>
                      <p className="text-2xs text-foreground-subtle truncate">{p.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-5 pb-2">
              <label
                htmlFor="src"
                className="block text-2xs font-semibold uppercase tracking-[0.16em] text-foreground-subtle mb-1.5"
              >
                Stream URL
              </label>
              <div className="flex gap-2">
                <input
                  id="src"
                  type="text"
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setProbe(null);
                  }}
                  placeholder={current.placeholder}
                  spellCheck={false}
                  className="flex-1 h-10 px-3 rounded-lg border border-border bg-surface text-sm font-mono text-foreground placeholder:text-foreground-subtle/70 outline-none focus:border-sage-500 focus:ring-focus"
                />
                <Button
                  onClick={connectFlow}
                  size="lg"
                  variant="primary"
                  loading={submitting}
                >
                  {submitting ? "Connecting…" : "Connect"}
                </Button>
              </div>
              <p className="mt-2 text-2xs text-foreground-subtle">{current.helper}</p>
            </div>

            {probe && (
              <div className="px-5 pb-3">
                <ProbeResultPanel probe={probe} />
              </div>
            )}

            <footer className="px-5 py-3 border-t border-border bg-stone-50/60 flex items-center gap-2.5 text-2xs text-foreground-subtle font-mono">
              <Loader2 className="h-3 w-3 opacity-50" />
              The backend now tolerates brief MJPEG hiccups and auto-reconnects on drop. If your phone is on Docker-NAT, expect a sub-second hitch on reconnect.
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ProbeResultPanel({ probe }: { probe: ProbeResult }) {
  if (probe.reachable && (probe.kind === "mjpeg" || (!probe.hint && probe.kind === "http"))) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-sage-200 bg-sage-50 px-3 py-2 text-2xs">
        <CheckCircle2 className="h-3.5 w-3.5 text-sage-700 mt-px shrink-0" />
        <div className="text-sage-900">
          <p className="font-semibold">Reachable</p>
          <p className="font-mono text-sage-800">
            {probe.kind?.toUpperCase()} · {probe.status ?? "?"} · {probe.content_type ?? "n/a"}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-peach-300 bg-peach-50 px-3 py-2 text-2xs">
      <AlertTriangle className="h-3.5 w-3.5 text-peach-700 mt-px shrink-0" />
      <div className="text-peach-900 min-w-0">
        <p className="font-semibold">
          {probe.reachable ? "Reachable, but not a stream" : "Not reachable"}
        </p>
        {probe.error && <p className="font-mono break-all">{probe.error}</p>}
        {probe.hint && <p className="mt-1">{probe.hint}</p>}
      </div>
    </div>
  );
}
