"use client";

import { TopBar } from "@/components/shared/layout/TopBar";
import { CommandCenterView } from "@/components/dashboard/CommandCenterView";
import { LiveEventRail } from "@/components/shared/event-rail/LiveEventRail";

export default function DashboardPage() {
  return (
    <>
      <TopBar
        eyebrow="Operations"
        title="Command center"
        subtitle="Real-time AI surveillance, enforcement workflows, and fleet telemetry."
      />
      <div className="px-4 sm:px-6 pt-3">
        <LiveEventRail />
      </div>
      <CommandCenterView />
    </>
  );
}
