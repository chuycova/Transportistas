// ─── lib/supabase/server.ts ───────────────────────────────────────────────────
// Server-side Supabase client using @supabase/ssr.
// Reads and writes HttpOnly cookies via Next.js `cookies()` API.
// Used in Server Components, Route Handlers, and middleware.
//
// Security: the JWT lives in a HttpOnly cookie — not accessible from JS,
// defending against XSS-based token theft.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Returns a Supabase server client that reads/writes the auth session
 * from HttpOnly cookies. Must only be called from Server Components
 * or Route Handlers (not from 'use client' components).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll can be called from Server Components that render in a read-only context.
          // The middleware handles refreshing the session in that case.
        }
      },
    },
  });
}
