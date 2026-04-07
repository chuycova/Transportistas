// ─── lib/supabase.ts ──────────────────────────────────────────────────────────
// Compatibility shim — provides a singleton instance for legacy imports.
// Long-term: migrate callers to import { createSupabaseBrowserClient } from '@/lib/supabase/client'.

'use client';

import { createSupabaseBrowserClient } from './supabase/client';

/**
 * Singleton lazy-initialized client for legacy callers that import
 * `supabase` from this path directly (historial-page, dev-ping-panel).
 */
let _instance: ReturnType<typeof createSupabaseBrowserClient> | null = null;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseBrowserClient>, {
  get(_target, prop) {
    if (!_instance) _instance = createSupabaseBrowserClient();
    return ((_instance as unknown) as Record<PropertyKey, unknown>)[prop];
  },
});
