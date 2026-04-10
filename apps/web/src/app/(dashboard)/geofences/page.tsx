// ─── app/(dashboard)/geofences/page.tsx ───────────────────────────────────────
import { GeofencesPage } from '@/features/geofences/geofences-page';

export const metadata = { title: 'Geocercas — ZonaZero' };

export default function GeofencesRoute() {
  return <GeofencesPage />;
}
