"use client";

import { TopBar } from "@/components/shared/layout/TopBar";
import { VehicleDossierView } from "@/components/vehicles/VehicleDossierView";
import { formatPlate } from "@/lib/intel/vehicleDossier";

interface Props {
  params: { plate: string };
}

export default function VehicleDossierPage({ params }: Props) {
  const plate = decodeURIComponent(params.plate);
  const formatted = formatPlate(plate);

  return (
    <>
      <TopBar
        eyebrow="Vehicle intelligence"
        title={formatted}
        subtitle="Composite registry, insurance, RTO, and enforcement record."
      />
      <VehicleDossierView plate={plate} />
    </>
  );
}
