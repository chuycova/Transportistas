// ─── database/index.ts ────────────────────────────────────────────────────────
// Singleton de WatermelonDB sobre expo-sqlite.
//
// Úsalo así en cualquier hook o screen:
//   import { database } from '@lib/database';
//   const pingsCollection = database.get<GpsPing>('gps_pings');

import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import { GpsPing } from './models/GpsPing.model';
import { LocalAlert } from './models/LocalAlert.model';

// ─── Adapter SQLite (usa expo-sqlite internamente) ────────────────────────────
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,     // JSI adapter: más rápido que el bridge (requiere hermes)
  onSetUpError: (error) => {
    // En caso de corrupción de DB, eliminar y recrear
    console.error('[WatermelonDB] Setup error:', error);
  },
});

// ─── Instancia singleton ──────────────────────────────────────────────────────
export const database = new Database({
  adapter,
  modelClasses: [GpsPing, LocalAlert],
});

// ─── Helpers de escritura ─────────────────────────────────────────────────────

/** Encola un ping GPS en WatermelonDB (synced=false) */
export async function enqueuePing(params: {
  vehicleId: string;
  tenantId: string;
  routeId?: string;
  tripId?: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  headingDeg?: number;
  accuracyM?: number;
  recordedAt: number;
}): Promise<void> {
  await database.write(async () => {
    await database.get<GpsPing>('gps_pings').create((ping) => {
      ping.vehicleId  = params.vehicleId;
      ping.tenantId   = params.tenantId;
      ping.routeId    = params.routeId ?? null;
      ping.tripId     = params.tripId ?? null;
      ping.lat        = params.lat;
      ping.lng        = params.lng;
      ping.speedKmh   = params.speedKmh ?? null;
      ping.headingDeg = params.headingDeg ?? null;
      ping.accuracyM  = params.accuracyM ?? null;
      ping.recordedAt = params.recordedAt;
      ping.synced     = false;
    });
  });
}

/** Marca un ping como sincronizado */
export async function markPingSynced(ping: GpsPing): Promise<void> {
  await database.write(async () => {
    await ping.update((p) => {
      p.synced = true;
    });
  });
}

/** Guarda una alerta local recibida por push/socket */
export async function saveLocalAlert(params: {
  type: string;
  message: string;
}): Promise<void> {
  await database.write(async () => {
    await database.get<LocalAlert>('local_alerts').create((alert) => {
      alert.type       = params.type;
      alert.message    = params.message;
      alert.receivedAt = Date.now();
      alert.read       = false;
    });
  });
}
