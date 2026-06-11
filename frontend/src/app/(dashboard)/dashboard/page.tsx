"use client";

import { TopBar } from "@/components/shared/layout/TopBar";
import { CommandCenterView } from "@/components/dashboard/CommandCenterView";

export default function DashboardPage() {
  return (
    <>
      <TopBar
        eyebrow="Operations"
        title="Command center"
        subtitle="Live threat feed, statewide intelligence, and the enforcement queue on one screen."
      />
      <CommandCenterView />
    </>
  );
}
