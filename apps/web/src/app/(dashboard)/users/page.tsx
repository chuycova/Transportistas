// ─── app/(dashboard)/users/page.tsx ───────────────────────────────────────────
import { UsersPage } from '@/features/users/users-page';

export const metadata = { title: 'Usuarios — ZonaZero' };

export default function UsersRoute() {
  return <UsersPage />;
}
