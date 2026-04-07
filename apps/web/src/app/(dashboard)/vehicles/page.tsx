// ─── app/(dashboard)/vehicles/page.tsx ────────────────────────────────────────
import { VehiclesPage } from '@/features/vehicles/vehicles-page';

export const metadata = { title: 'Flotilla — ZonaZero' };

export default function VehiclesRoute() {
  return <VehiclesPage />;
}
