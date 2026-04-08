// ─── app/(dashboard)/vehicles/[vehicleId]/page.tsx ───────────────────────────
// Server Component shell para la pantalla de detalle de un vehículo.

import { VehicleDetailPage } from '@/features/vehicles/vehicle-detail-page';

export default function VehicleDetailRoute({
  params,
}: {
  params: { vehicleId: string };
}) {
  return <VehicleDetailPage vehicleId={params.vehicleId} />;
}

export function generateMetadata({ params }: { params: { vehicleId: string } }) {
  return {
    title: `Vehículo · ZonaZero`,
    description: `Detalle, historial y telemetría del vehículo ${params.vehicleId}`,
  };
}
