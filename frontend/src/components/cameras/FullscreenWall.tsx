"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shrink, X } from "lucide-react";

import { useCamerasStore } from "@/lib/stores/cameras.store";
import { cn } from "@/lib/utils";
import type { Camera } from "@/lib/types";

import { CameraFeedCanvas } from "./primitives/CameraFeedCanvas";
import { LiveStatusChip } from "./primitives/LiveStatusChip";
import { LiveClock } from "./primitives/LiveClock";

interface Props {
  cameras: Camera[];
}

/**
 * Fullscreen tactical multi-camera wall.
 *
 *  - All active cameras visible in a single dense grid
 *  - Click any feed to focus it as the hero on exit
 *  - Esc / F to exit
 */
export function FullscreenWall({ cameras }: Props) {
  const open = useCamerasStore((s) => s.fullscreen);
  const setFullscreen = useCamerasStore((s) => s.setFullscreen);
  const selectCamera = useCamerasStore((s) => s.selectCamera);
  const selectedId = useCamerasStore((s) => s.selectedCameraId);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "f" || e.key === "F") {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setFullscreen]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const visible = cameras.filter((c) => c.status === "active" || c.status === "error");

  // Choose a tactical grid layout based on count
  const cols =
    visible.length <= 1
      ? "grid-cols-1"
      : visible.length <= 4
      ? "grid-cols-2"
      : visible.length <= 6
      ? "grid-cols-2 lg:grid-cols-3"
      : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] bg-stone-950 flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          {/* Top bar */}
          <header className="flex items-center justify-between px-5 py-3 border-b border-stone-800 bg-stone-950/95 backdrop-blur-sm">
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2 h-6 rounded-md border border-sage-300/40 bg-sage-500/10 text-2xs font-semibold uppercase tracking-[0.18em] text-sage-200">
                Tactical wall
              </span>
              <span className="hidden md:inline font-mono text-2xs text-stone-400 tracking-[0.14em] uppercase">
                {visible.length} feeds · Multi-cam ops mode
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-stone-800 bg-stone-900/70 font-mono text-2xs text-stone-300">
                <LiveClock format="iso" />
              </span>
              <span className="hidden md:inline-flex h-7 items-center gap-2 px-2 rounded-md border border-stone-800 bg-stone-900/70 text-2xs text-stone-300 font-mono">
                <kbd className="px-1 py-0.5 rounded bg-stone-800 text-stone-200">F</kbd>
                <span>·</span>
                <kbd className="px-1 py-0.5 rounded bg-stone-800 text-stone-200">Esc</kbd>
                <span className="opacity-70">to exit</span>
              </span>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                aria-label="Exit tactical wall"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-stone-700 bg-stone-900 text-2xs font-semibold uppercase tracking-[0.12em] text-stone-200 hover:bg-stone-800"
              >
                <Shrink className="h-3 w-3" />
                Exit
              </button>
            </div>
          </header>

          {/* Grid */}
          <main className="flex-1 overflow-auto p-4">
            <div className={cn("grid gap-3", cols)}>
              {visible.map((c) => (
                <FullscreenTile
                  key={c.id}
                  camera={c}
                  focused={c.id === selectedId}
                  onClick={() => selectCamera(c.id)}
                />
              ))}
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FullscreenTile({
  camera,
  focused,
  onClick,
}: {
  camera: Camera;
  focused: boolean;
  onClick: () => void;
}) {
  const isOnline = camera.status === "active";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative rounded-lg overflow-hidden border bg-stone-950 text-left",
        "transition-[border-color,box-shadow,transform] duration-200",
        focused
          ? "border-sage-400 shadow-[0_0_0_2px_rgba(169,179,148,0.32)]"
          : "border-stone-800 hover:border-stone-600"
      )}
    >
      <CameraFeedCanvas
        cameraId={camera.id}
        cameraCode={camera.camera_id}
        density="comfortable"
        online={isOnline}
        hud="minimal"
      />

      <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none">
        <LiveStatusChip variant={isOnline ? "live" : "error"} />
      </div>

      <div className="absolute bottom-0 inset-x-0 px-3 py-2 bg-gradient-to-t from-stone-950 to-transparent pointer-events-none">
        <p className="font-mono text-2xs text-stone-300 tracking-[0.14em] uppercase truncate">
          {camera.camera_id}
        </p>
        <p className="text-xs text-stone-100 font-medium truncate">{camera.name}</p>
      </div>
    </button>
  );
}
