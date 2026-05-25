"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity, AlertCircle, Camera, CheckCircle, ChevronRight,
  MapPin, Pause, Play, Plus, RefreshCw, Settings, Video, Wifi,
} from "lucide-react";
import { camerasApi } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Camera as CameraType } from "@/lib/types";
import { format, parseISO } from "date-fns";

type StatusFilter = "all" | "active" | "inactive" | "error";

export function CamerasView() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => camerasApi.list().then((r) => r.data),
    refetchInterval: 8_000,
  });

  const start = useMutation({
    mutationFn: (id: string) => camerasApi.start(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cameras"] }); toast.success("Stream started"); },
    onError: () => toast.error("Failed to start stream"),
  });
  const stop = useMutation({
    mutationFn: (id: string) => camerasApi.stop(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cameras"] }); toast.info("Stream stopped"); },
  });

  const filtered = cameras.filter((c: CameraType) =>
    filter === "all" || c.status === filter
  );

  const counts = {
    active: cameras.filter((c: CameraType) => c.status === "active").length,
    inactive: cameras.filter((c: CameraType) => c.status === "inactive").length,
    error: cameras.filter((c: CameraType) => c.status === "error").length,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-screen-2xl mx-auto space-y-5">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Active Streams", value: counts.active, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
            { label: "Offline", value: counts.inactive, color: "text-slate-500", bg: "bg-slate-50 border-slate-100" },
            { label: "Errors", value: counts.error, color: "text-red-600", bg: "bg-red-50 border-red-100" },
          ].map((s) => (
            <div key={s.label} className={cn("rounded-xl border p-4 text-center", s.bg)}>
              <p className={cn("text-2xl font-bold tabular-nums", s.color)}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(["all", "active", "inactive", "error"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all",
                  filter === f
                    ? "bg-white text-slate-900 shadow-card"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {f}
                {f !== "all" && (
                  <span className="ml-1.5 text-2xs text-slate-400">
                    {counts[f as keyof typeof counts]}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["cameras"] })}
              className="btn-secondary btn-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button className="btn-primary btn-sm">
              <Plus className="h-3.5 w-3.5" />
              Add Camera
            </button>
          </div>
        </div>

        {/* Camera grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => <CameraCardSkeleton key={i} />)
            : filtered.map((camera: CameraType, i: number) => (
                <CameraCard
                  key={camera.id}
                  camera={camera}
                  index={i}
                  onStart={() => start.mutate(camera.id)}
                  onStop={() => stop.mutate(camera.id)}
                  isStarting={start.isPending}
                  isStopping={stop.isPending}
                />
              ))
          }
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20">
            <Camera className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No cameras match this filter</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CameraCard({ camera, index, onStart, onStop, isStarting, isStopping }: {
  camera: CameraType; index: number;
  onStart: () => void; onStop: () => void;
  isStarting: boolean; isStopping: boolean;
}) {
  const isActive = camera.status === "active";
  const isError = camera.status === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="card-hover overflow-hidden rounded-xl"
    >
      {/* Video preview */}
      <div className="relative bg-slate-900 aspect-video overflow-hidden">
        {isActive ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
            {/* Simulated camera feed lines */}
            <div className="absolute inset-0 opacity-10">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-slate-500"
                  style={{ top: `${(i + 1) * 12.5}%` }} />
              ))}
            </div>
            <Video className="h-6 w-6 text-emerald-400 mb-2" />
            <span className="text-xs text-emerald-400 font-mono font-bold">STREAMING</span>
          </div>
        ) : isError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
            <AlertCircle className="h-6 w-6 text-red-400 mb-2" />
            <span className="text-xs text-red-400 font-mono">ERROR</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
            <Camera className="h-6 w-6 text-slate-600 mb-2" />
            <span className="text-xs text-slate-600 font-mono">OFFLINE</span>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <span className={cn(
            "badge text-2xs",
            isActive ? "badge-active" : isError ? "badge-error" : "badge-neutral"
          )}>
            {isActive && <span className="status-dot-live h-1.5 w-1.5" />}
            {camera.status}
          </span>
        </div>

        {/* Camera ID */}
        <div className="absolute bottom-3 left-3">
          <span className="font-mono text-2xs text-slate-400 bg-black/50 px-2 py-0.5 rounded">
            {camera.camera_id}
          </span>
        </div>

        {/* Error count */}
        {camera.error_count > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-red-600/90 text-white text-2xs px-2 py-0.5 rounded-full font-mono">
            <AlertCircle className="h-2.5 w-2.5" />
            {camera.error_count} err
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{camera.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
              <p className="text-xs text-slate-500 truncate">{camera.location}</p>
            </div>
          </div>
          <button className="btn-icon btn-sm shrink-0">
            <Settings className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Detections", value: camera.total_detections.toLocaleString() },
            { label: "FPS", value: camera.fps ?? "—" },
            { label: "Resolution", value: camera.resolution_width ? `${camera.resolution_width}p` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="text-center bg-slate-50 rounded-lg py-2 border border-slate-100">
              <p className="text-sm font-semibold text-slate-800 tabular-nums">{value}</p>
              <p className="text-2xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {camera.last_seen && (
          <p className="text-2xs text-slate-400 mb-3 font-mono">
            Last seen {format(parseISO(camera.last_seen), "dd MMM, HH:mm")}
          </p>
        )}

        {/* Control button */}
        {isActive ? (
          <button
            onClick={onStop}
            disabled={isStopping}
            className="w-full btn btn-sm bg-slate-100 text-slate-700 border border-slate-200
                       hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          >
            <Pause className="h-3.5 w-3.5" />
            Stop Stream
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={isStarting || !camera.rtsp_url && !camera.stream_url}
            className="w-full btn-primary btn-sm"
            title={!camera.rtsp_url && !camera.stream_url ? "No stream URL configured" : undefined}
          >
            <Play className="h-3.5 w-3.5" />
            Start Stream
          </button>
        )}
      </div>
    </motion.div>
  );
}

function CameraCardSkeleton() {
  return (
    <div className="card overflow-hidden rounded-xl">
      <div className="aspect-video skeleton" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
        </div>
        <div className="skeleton h-8 rounded-lg" />
      </div>
    </div>
  );
}
