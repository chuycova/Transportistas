// ─── activateRoute.ts ─────────────────────────────────────────────────────────
// Persiste una ruta seleccionada en MMKV para que la pantalla de Mapa la cargue.
// NO crea el trip en BD — eso lo hace useTrackingToggle cuando el conductor
// pulsa "Iniciar ruta" en el BottomSheet del Mapa. Esto evita trips huérfanos
// cuando el conductor navega al Mapa pero no inicia el tracking.

import { setStr, storage } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';
import type { RouteItem } from '@features/routes/types';

interface ActivateRouteParams {
  route:     RouteItem;
  vehicleId: string;
}

export function activateRoute({ route, vehicleId }: ActivateRouteParams): void {
  // Limpiar cualquier estado de pausa previo para empezar limpio
  storage.delete(MMKV_KEYS.TRIP_IS_PAUSED);
  storage.delete(MMKV_KEYS.TRIP_PAUSED_PCT);
  storage.delete(MMKV_KEYS.LAST_WAYPOINT_IDX);
  storage.delete(MMKV_KEYS.ACTIVE_TRIP_ID);

  // Persistir ruta activa en MMKV
  setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID,      vehicleId);
  setStr(MMKV_KEYS.ACTIVE_ROUTE_ID,        route.id);
  setStr(MMKV_KEYS.ACTIVE_ROUTE_NAME,      route.name);
  setStr(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS, JSON.stringify(route.waypoints));
  setStr(MMKV_KEYS.ACTIVE_ROUTE_STOPS,     JSON.stringify(route.stops));
}
