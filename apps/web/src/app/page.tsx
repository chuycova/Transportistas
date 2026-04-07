// app/page.tsx
// Root route — middleware already guarantees the user is authenticated.
// Renders DashboardPage through app/(dashboard)/layout.tsx which provides AppShell.
// NOTE: Next.js route groups (dashboard) do NOT add URL segments —
//       app/(dashboard)/page.tsx and app/page.tsx BOTH map to "/".
//       We use a single page.tsx at root (not inside the group) and import
//       DashboardPage here. The AppShell is rendered by the (dashboard) layout
//       ONLY for URLs matched by files inside that group (vehicles, routes, historial).
//       The solution for the root "/" is to render AppShell + DashboardPage directly.
import { AppShell } from '@/features/shell/app-shell';
import { DashboardPage } from '@/features/dashboard/dashboard-page';

export const metadata = { title: 'Mapa en vivo — ZonaZero' };

export default function HomePage() {
  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  );
}
