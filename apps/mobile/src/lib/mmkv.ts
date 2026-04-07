// ─── mmkv.ts ──────────────────────────────────────────────────────────────────
// Instancia MMKV singleton + adapter compatible con Supabase Auth.
//
// Rol de MMKV en esta app:
//   - Sesión Supabase (JWT access_token, refresh_token, expiry)
//   - activeVehicleId, activeRouteId (selección del conductor)
//   - trackingActive flag (para restaurar estado al reiniciar)
//
// MMKV es ~30-50x más rápido que AsyncStorage y síncrono (JSI),
// lo que permite leer el JWT ANTES de inicializar el socket en App.tsx.

import { MMKV } from 'react-native-mmkv';

// ─── Instancia singleton ──────────────────────────────────────────────────────
export const storage = new MMKV({
  id: 'zona-zero-storage',
  // encryptionKey: 'REPLACE_WITH_SECURE_KEY_FROM_KEYCHAIN' ← activar en producción
});

// ─── Supabase Auth Storage Adapter ───────────────────────────────────────────
// Supabase acepta un objeto con { getItem, setItem, removeItem } para persistir
// la sesión en cualquier mecanismo de storage. Aquí delegamos en MMKV.
export const mmkvStorageAdapter = {
  getItem: (key: string): string | null => {
    return storage.getString(key) ?? null;
  },
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.delete(key);
  },
};

// ─── Helper: string ───────────────────────────────────────────────────────────
export function getStr(key: string): string | undefined {
  return storage.getString(key);
}

export function setStr(key: string, value: string): void {
  storage.set(key, value);
}

// ─── Helper: boolean ─────────────────────────────────────────────────────────
export function getBool(key: string): boolean {
  return storage.getBoolean(key) ?? false;
}

export function setBool(key: string, value: boolean): void {
  storage.set(key, value);
}

// ─── Helper: clear all (logout) ───────────────────────────────────────────────
export function clearStorage(): void {
  storage.clearAll();
}
