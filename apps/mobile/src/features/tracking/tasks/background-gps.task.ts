// ─── background-gps.task.ts ───────────────────────────────────────────────────
// Tarea registrada con expo-task-manager para GPS en segundo plano.
//
// IMPORTANTE: Este archivo DEBE importarse en App.tsx (o en el entry point)
// ANTES de que la app se monte, de lo contrario TaskManager no encuentra la tarea.
// Ver: https://docs.expo.dev/versions/latest/sdk/task-manager/
//
// Flujo:
//   1. expo-location llama a esta tarea con las nuevas coordenadas
//   2. Se intenta emitir via socket → si falla → se encola en WatermelonDB

import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { BACKGROUND_GPS_TASK, MMKV_KEYS } from '@lib/constants';
import { getStr } from '@lib/mmkv';
import { emitLocationPing } from '@lib/socket';
import { enqueuePing } from '@lib/database';

interface BackgroundLocationData {
  locations: LocationObject[];
}

TaskManager.defineTask<BackgroundLocationData>(BACKGROUND_GPS_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundGPS] Error:', error.message);
    return;
  }

  if (!data?.locations?.length) return;

  const vehicleId = getStr(MMKV_KEYS.ACTIVE_VEHICLE_ID);
  const routeId   = getStr(MMKV_KEYS.ACTIVE_ROUTE_ID);

  // Si no hay vehicleId guardado (sesión expirada / logout), ignorar
  if (!vehicleId) {
    console.warn('[BackgroundGPS] No hay vehicleId en MMKV, ignorando ping');
    return;
  }

  for (const location of data.locations) {
    const { latitude: lat, longitude: lng, speed, heading, accuracy } = location.coords;
    const recordedAt = new Date(location.timestamp).toISOString();

    const payload = {
      vehicleId,
      // tenantId se obtiene del JWT en el backend via el socket auth
      // pero lo necesitamos aquí para la DB offline. Se lee de MMKV.
      tenantId: getStr('tenantId') ?? '',
      routeId,
      coordinate: { lat, lng },
      speedKmh:   speed  != null ? Number((speed  * 3.6).toFixed(1)) : undefined,
      headingDeg: heading != null ? Math.round(heading) : undefined,
      accuracyM:  accuracy != null ? Math.round(accuracy) : undefined,
      recordedAt,
    };

    // Intentar emitir por socket; si no hay conexión → encolar en WatermelonDB
    const sent = emitLocationPing(payload);

    if (!sent) {
      await enqueuePing({
        vehicleId,
        tenantId: payload.tenantId,
        routeId:  routeId ?? undefined,
        lat,
        lng,
        speedKmh:   payload.speedKmh,
        headingDeg: payload.headingDeg,
        accuracyM:  payload.accuracyM,
        recordedAt: location.timestamp,
      });
    }
  }
});
