// app/page.tsx
// Root route — middleware guarantees user is authenticated.
// "/" → Centro de Control (overview). Mapa en vivo → /map.
// El AppShell se renderiza aquí directamente porque este archivo
// está fuera del route group (dashboard) y no hereda su layout.
import { AppShell } from '@/features/shell/app-shell';
import { DashboardPage } from '@/features/dashboard/dashboard-page';

export const metadata = { title: 'Centro de Control — ZonaZero' };

export default function HomePage() {
  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  );
}

