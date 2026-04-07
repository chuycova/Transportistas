// ─── features/auth/ports/IAuthRepository.ts ──────────────────────────────────
// Hexagonal Port — defines WHAT auth operations are needed.
// The domain/application layer depends ONLY on this interface (DIP).
// The adapter (supabase-auth.adapter.ts) implements the concrete details.

import type { User, Session } from '@supabase/supabase-js';

export interface IAuthRepository {
  /** Get the currently authenticated user, or null */
  getUser(): Promise<User | null>;

  /** Get the current session, or null */
  getSession(): Promise<Session | null>;

  /** Sign in with email and password */
  signInWithPassword(email: string, password: string): Promise<{ error: string | null }>;

  /** Sign out and clear the session */
  signOut(): Promise<void>;
}
