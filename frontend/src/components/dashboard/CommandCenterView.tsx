"use client";

import { KpiRow } from "./KpiRow";
import { LiveActivityStream } from "./LiveActivityStream";
import { DetectionTrendChart } from "./DetectionTrendChart";
import { CameraHealthGrid } from "./CameraHealthGrid";
import { RecentEnforcement } from "./RecentEnforcement";

export function CommandCenterView() {
  return (
    <div className="page-shell page-enter space-y-6">
      <KpiRow />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <DetectionTrendChart />
          <CameraHealthGrid />
        </div>
        <div className="xl:col-span-1">
          <LiveActivityStream />
        </div>
      </div>

      <RecentEnforcement />
    </div>
  );
}
