import type { Metadata } from "next";
import { TopBar } from "@/components/shared/layout/TopBar";
import { EvidenceView } from "@/components/evidence/EvidenceView";

export const metadata: Metadata = { title: "Evidence" };

export default function EvidencePage() {
  return (
    <>
      <TopBar
        title="Evidence Repository"
        subtitle="AI-captured frames · OCR results · Violation records"
      />
      <EvidenceView />
    </>
  );
}
