import { IncidentDetailPage } from '@/features/incidents/incident-detail-page';

export const metadata = { title: 'Incidente — ZonaZero' };

export default function Page({ params }: { params: { id: string } }) {
  return <IncidentDetailPage incidentId={params.id} />;
}
