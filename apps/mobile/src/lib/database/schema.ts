// ─── schema.ts ────────────────────────────────────────────────────────────────
// Schema de WatermelonDB. Incrementa `version` cuando se añada/modifique
// una tabla — WatermelonDB ejecutará la migración automáticamente si
// configuras `migrations` en el Database (ver index.ts).

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    // ─── Cola de pings GPS (offline queue) ─────────────────────────────────
    tableSchema({
      name: 'gps_pings',
      columns: [
        { name: 'vehicle_id',   type: 'string' },
        { name: 'tenant_id',    type: 'string' },
        { name: 'route_id',     type: 'string',  isOptional: true },
        { name: 'trip_id',      type: 'string',  isOptional: true },
        { name: 'lat',          type: 'number' },
        { name: 'lng',          type: 'number' },
        { name: 'speed_kmh',    type: 'number',  isOptional: true },
        { name: 'heading_deg',  type: 'number',  isOptional: true },
        { name: 'accuracy_m',   type: 'number',  isOptional: true },
        { name: 'recorded_at',  type: 'number' }, // Date.now() ms
        { name: 'synced',       type: 'boolean' }, // false = pendiente de sync
      ],
    }),

    // ─── Historial de alertas de desvío (local, para el conductor) ─────────
    tableSchema({
      name: 'local_alerts',
      columns: [
        { name: 'type',        type: 'string' },
        { name: 'message',     type: 'string' },
        { name: 'received_at', type: 'number' },
        { name: 'read',        type: 'boolean' },
      ],
    }),
  ],
});
