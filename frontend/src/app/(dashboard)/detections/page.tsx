import type { Metadata } from "next";
import { TopBar } from "@/components/shared/layout/TopBar";
import { DetectionsView } from "@/components/detections/DetectionsView";

export const metadata: Metadata = { title: "Detections" };

export default function DetectionsPage() {
  return (
    <>
      <TopBar
        title="Detection Log"
        subtitle="All AI-processed vehicle detections · plate reads · violations"
      />
      <DetectionsView />
    </>
  );
}
