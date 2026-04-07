// ─── supabase.ts ──────────────────────────────────────────────────────────────
// Cliente Supabase para React Native.
//
// Diferencias vs el cliente web (@zona-zero/infrastructure):
//   - storage: mmkvStorageAdapter  → NO AsyncStorage, NO detectSessionInUrl
//   - detectSessionInUrl: false    → No aplica en mobile
//   - autoRefreshToken: true       → El SDK renueva automáticamente via MMKV
//
// NUNCA usar getServerSupabaseClient() en el móvil — ese requiere
// SUPABASE_SERVICE_ROLE_KEY que no debe existir en el bundle del cliente.

import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { mmkvStorageAdapter } from './mmkv';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[ZonaZero Mobile] EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY son requeridas.',
  );
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: mmkvStorageAdapter,   // ← MMKV en vez de AsyncStorage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,     // ← Desactivado en React Native
  },
});

// ─── Helpers de sesión ────────────────────────────────────────────────────────

/** Devuelve el usuario actualmene autenticado, o null si no hay sesión */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Devuelve el JWT access_token de la sesión activa, o null */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Cierra sesión y limpia la sesión de MMKV via el storage adapter */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}