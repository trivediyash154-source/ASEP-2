import type { Metadata } from "next";
import { TopBar } from "@/components/shared/layout/TopBar";
import { SettingsView } from "@/components/settings/SettingsView";
import { RoleGuard } from "@/components/shared/RoleGuard";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" subtitle="Pipeline configuration · Storage · Notifications · Thresholds" />
      <RoleGuard capability="settings:read" label="Settings">
        <SettingsView />
      </RoleGuard>
    </>
  );
}
