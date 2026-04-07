// ─── lib/supabase/client.ts ───────────────────────────────────────────────────
// Browser-side Supabase client using @supabase/ssr.
// Stores the session in cookies (set by middleware) rather than localStorage,
// eliminating the XSS-accessible JWT storage of the previous Vite implementation.
//
// SOLID — SRP: This module is ONLY responsible for creating the browser client.
// Hexagonal — Infrastructure Adapter: lives outside domain/use-case layers.

import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('[ZonaZero Web] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
}

/**
 * Returns a Supabase browser client that syncs the auth session via cookies.
 * Call this only from Client Components ('use client').
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
