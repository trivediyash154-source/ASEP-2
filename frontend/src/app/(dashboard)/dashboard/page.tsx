"use client";

import { TopBar } from "@/components/shared/layout/TopBar";
import { CommandCenterView } from "@/components/dashboard/CommandCenterView";

export default function DashboardPage() {
  return (
    <>
      <TopBar
        eyebrow="Operations"
        title="Command center"
        subtitle="Real-time AI surveillance, enforcement workflows, and fleet telemetry."
      />
      <CommandCenterView />
    </>
  );
}
