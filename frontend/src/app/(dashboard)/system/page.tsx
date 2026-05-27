import type { Metadata } from "next";
import { TopBar } from "@/components/shared/layout/TopBar";
import { SystemView } from "@/components/system/SystemView";
import { RoleGuard } from "@/components/shared/RoleGuard";

export const metadata: Metadata = { title: "System Monitor" };

export default function SystemPage() {
  return (
    <>
      <TopBar title="System Monitor" subtitle="Infrastructure health · AI pipeline · Service status" />
      <RoleGuard capability="system:view" label="System Health">
        <SystemView />
      </RoleGuard>
    </>
  );
}
