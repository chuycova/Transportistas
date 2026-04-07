// ─── app/(dashboard)/layout.tsx ───────────────────────────────────────────────
// Dashboard layout — wraps all protected routes with the AppShell nav
// and initializes the Socket.io connection for real-time tracking.
// 'use client' is NOT here — AppShell and SocketInitialize are client components
// imported into a Server Component shell.

import { AppShell } from '@/features/shell/app-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
