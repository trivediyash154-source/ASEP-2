"use client";

import { TopBar } from "@/components/shared/layout/TopBar";
import { DemoSurveillanceConsole } from "@/components/cameras/demo/DemoSurveillanceConsole";

export default function DemoPage() {
  return (
    <>
      <TopBar
        eyebrow="Live demo"
        title="Demo theatre"
        subtitle="Mobile camera ingest · ANPR pipeline · concurrent compliance · automatic enforcement."
      />
      <DemoSurveillanceConsole />
    </>
  );
}
