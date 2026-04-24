// ─── useCurrentUser.ts ────────────────────────────────────────────────────────
// Hook que expone el usuario autenticado actual desde Supabase Auth.
// Evita llamadas directas a supabase.auth en componentes.

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return user;
}
