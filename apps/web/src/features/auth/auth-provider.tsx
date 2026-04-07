'use client';
// ─── features/auth/auth-provider.tsx ─────────────────────────────────────────
// Auth context for Client Components. Uses @supabase/ssr browser client.
// The session itself lives in HttpOnly cookies managed by middleware.ts —
// this provider only exposes the reactive user/session state.
//
// NOTE: The dummy dev bypass (admin@zonazero.com / admin) has been REMOVED.
// Use real Supabase credentials configured in .env.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ─── Port interface (keeps components decoupled from Supabase) ────────────────
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    // Initialize from current session (stored in cookie by middleware)
    const initializeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (error) {
        console.error('[AuthProvider] Session init error', error);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeAuth();

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      // Refresh the Server Component tree so middleware re-evaluates cookies
      router.refresh();
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Full page navigation (not client-side router.push) so the middleware
    // re-evaluates the now-cleared Supabase HttpOnly cookie on the next request.
    // router.push() is too fast — middleware still sees the old cookie in the same cycle.
    window.location.href = '/login';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
