import type { Metadata } from "next";
import { TopBar } from "@/components/shared/layout/TopBar";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { RoleGuard } from "@/components/shared/RoleGuard";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <TopBar title="Analytics" subtitle="AI performance · Detection trends · Revenue insights" />
      <RoleGuard capability="analytics:view" label="Analytics">
        <AnalyticsView />
      </RoleGuard>
    </>
  );
}
