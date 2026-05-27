"use client";

import { TopBar } from "@/components/shared/layout/TopBar";
import { SurveillanceCommandCenter } from "@/components/cameras/SurveillanceCommandCenter";
import { RoleGuard } from "@/components/shared/RoleGuard";

export default function CamerasPage() {
  return (
    <>
      <TopBar
        eyebrow="Surveillance"
        title="Operations wall"
        subtitle="Live AI-mediated camera feeds, incident stream, and forensic evidence drawer."
      />
      <RoleGuard capability="cameras:view" label="Cameras">
        <SurveillanceCommandCenter />
      </RoleGuard>
    </>
  );
}
