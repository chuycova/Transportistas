// ─── app/(auth)/login/page.tsx ────────────────────────────────────────────────
import { LoginPage } from '@/features/auth/login-page';

export const metadata = {
  title: 'Iniciar sesión — ZonaZero',
};

export default function LoginRoute() {
  return <LoginPage />;
}
