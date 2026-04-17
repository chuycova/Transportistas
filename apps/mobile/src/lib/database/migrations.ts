// ─── database/migrations.ts ───────────────────────────────────────────────────
// Migraciones de WatermelonDB. Se ejecutan automáticamente al detectar que
// la versión del schema cambió.
//
// Regla: nunca modificar migraciones ya distribuidas — solo agregar nuevas.

import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // v1 → v2: agrega trip_id a gps_pings para asociar pings con viajes
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'gps_pings',
          columns: [{ name: 'trip_id', type: 'string', isOptional: true }],
        }),
      ],
    },
  ],
});
