import type { Metadata } from "next";
import { TopBar } from "@/components/shared/layout/TopBar";
import { SystemView } from "@/components/system/SystemView";

export const metadata: Metadata = { title: "System Monitor" };

export default function SystemPage() {
  return (
    <>
      <TopBar title="System Monitor" subtitle="Infrastructure health · AI pipeline · Service status" />
      <SystemView />
    </>
  );
}
