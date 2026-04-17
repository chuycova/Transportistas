import { TripDetailPage } from '@/features/trips/trip-detail-page';

export const metadata = { title: 'Detalle de viaje — ZonaZero' };

export default function Page({ params }: { params: { id: string } }) {
  return <TripDetailPage id={params.id} />;
}
