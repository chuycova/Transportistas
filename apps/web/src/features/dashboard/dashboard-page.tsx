'use client';
// ─── features/dashboard/dashboard-page.tsx ────────────────────────────────────
// Dashboard main page — live map + vehicle sidebar.
// Uses full-height flex row so sidebar and map fill the available space correctly.

import { LiveMap } from './live-map';
import { VehicleListSidebar } from './vehicle-list-sidebar';

export function DashboardPage() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <VehicleListSidebar />
      <div className="relative flex-1 h-full">
        <LiveMap />
      </div>
    </div>
  );
}
