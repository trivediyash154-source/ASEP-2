import type { Metadata } from "next";
import { TopBar } from "@/components/shared/layout/TopBar";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <TopBar title="Settings" subtitle="Pipeline configuration · Storage · Notifications · Thresholds" />
      <SettingsView />
    </>
  );
}
