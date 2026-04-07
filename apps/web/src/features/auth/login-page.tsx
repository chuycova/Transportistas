'use client';
// ─── features/auth/login-page.tsx ─────────────────────────────────────────────
// Login page — Client Component. Dev bypass REMOVED.
// Uses the auth adapter (IAuthRepository) instead of calling Supabase directly.
// On success, Next.js middleware detects the new session cookie and redirects to /.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { authRepository } from './adapters/supabase-auth.adapter';
import { useRouter } from 'next/navigation';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await authRepository.signInWithPassword(
      email.trim().toLowerCase(),
      password,
    );

    if (authError) {
      setError(
        authError === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : authError,
      );
      setLoading(false);
      return;
    }

    // Refresh so middleware re-reads the new session cookie and redirects to /
    router.refresh();
    router.push('/');
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] h-[50vh] w-[50vw] rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[50vh] w-[50vw] rounded-full bg-accent/20 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent"
            >
              ZonaZero
            </motion.h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Portal de Monitoreo Analítico
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground/80">
                Email Corporativo
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="operador@zonazero.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground/80">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-semibold text-white shadow-xl transition-all hover:scale-[1.02] hover:shadow-primary/25 disabled:pointer-events-none disabled:opacity-70"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Conectando...
                </span>
              ) : (
                'Acceder al Sistema'
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
