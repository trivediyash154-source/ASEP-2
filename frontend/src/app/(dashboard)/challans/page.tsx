import type { Metadata } from "next";
import { TopBar } from "@/components/shared/layout/TopBar";
import { ChallansView } from "@/components/challans/ChallansView";

export const metadata: Metadata = { title: "Challans" };

export default function ChallansPage() {
  return (
    <>
      <TopBar title="Challan Management" subtitle="Issue, track, and export traffic violation fines" />
      <ChallansView />
    </>
  );
}
