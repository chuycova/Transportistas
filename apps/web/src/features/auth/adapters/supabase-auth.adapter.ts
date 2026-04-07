// ─── features/auth/adapters/supabase-auth.adapter.ts ─────────────────────────
// Hexagonal Adapter — implements IAuthRepository using Supabase browser client.
// This is the ONLY file in the auth feature that directly imports from @supabase/*.
//
// SOLID:
//   - SRP: handles auth operations only
//   - OCP: swap out Supabase by implementing IAuthRepository with another adapter
//   - DIP: the rest of the feature uses IAuthRepository, not this class directly

'use client';

import type { IAuthRepository } from '../ports/IAuthRepository';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

class SupabaseAuthAdapter implements IAuthRepository {
  private get client() {
    return createSupabaseBrowserClient();
  }

  async getUser(): Promise<User | null> {
    const { data } = await this.client.auth.getUser();
    return data.user ?? null;
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    return data.session ?? null;
  }

  async signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }
}

// Singleton adapter — exported as the concrete IAuthRepository
export const authRepository: IAuthRepository = new SupabaseAuthAdapter();
