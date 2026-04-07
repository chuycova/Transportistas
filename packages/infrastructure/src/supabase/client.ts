// Cliente Supabase singleton con tipo Database mínimo que permite
// operaciones de insert/update/select/rpc sin errores de tipo `never`.
// Cuando ejecutes: npx supabase gen types typescript --project-id <ID>
// reemplaza el tipo Database con el generado automáticamente.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './database.types.js';

// ─── Cliente para el Backend (service_role_key — NUNCA exponer al frontend) ──
let _serverClient: SupabaseClient<Database> | null = null;

export function getServerSupabaseClient(): SupabaseClient<Database> {
  if (_serverClient) return _serverClient;

  const url = typeof process !== 'undefined' ? process.env.SUPABASE_URL : undefined;
  const key = typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas para el cliente del servidor.',
    );
  }

  _serverClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _serverClient;
}

// ─── Cliente para el Frontend (anon_key — RLS activo) ─────────────────────────
let _browserClient: SupabaseClient<Database> | null = null;

export function getBrowserSupabaseClient(url: string, key: string): SupabaseClient<Database> {
  if (_browserClient) return _browserClient;

  if (!url || !key) {
    throw new Error(
      'URL y ANON_KEY son requeridas para inicializar el cliente del navegador.',
    );
  }

  _browserClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return _browserClient;
}
