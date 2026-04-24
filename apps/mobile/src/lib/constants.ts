// ─── constants.ts ─────────────────────────────────────────────────────────────
// Centraliza todas las URLs y parámetros de configuración de entorno.
// Expo expone variables EXPO_PUBLIC_* al bundle del cliente.

export const SUPABASE_URL = process.env['EXPO_PUBLIC_SUPABASE_URL'] ?? '';
export const SUPABASE_ANON_KEY = process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

export const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000';
export const SOCKET_URL = process.env['EXPO_PUBLIC_SOCKET_URL'] ?? 'http://localhost:3000';
export const GOOGLE_MAPS_API_KEY = process.env['EXPO_PUBLIC_GOOGLE_MAPS_API_KEY'] ?? '';

/** Intervalo de envío GPS en milisegundos (default: 5s) */
export const GPS_INTERVAL_MS = Number(process.env['EXPO_PUBLIC_GPS_INTERVAL_MS'] ?? 5000);

/** Distancia mínima de desplazamiento para emitir un ping (default: 10m) */
export const GPS_DISTANCE_INTERVAL_M = Number(
  process.env['EXPO_PUBLIC_GPS_DISTANCE_INTERVAL_M'] ?? 10,
);

/** Nombre de la tarea background registrada con expo-task-manager */
export const BACKGROUND_GPS_TASK = 'ZONA_ZERO_BACKGROUND_GPS';

// ─── MMKV Keys ──────────────────────────────────────────────────────────────
// Claves centralizadas para el storage MMKV. Evita typos dispersos.
export const MMKV_KEYS = {
  ACTIVE_VEHICLE_ID:      'activeVehicleId',
  ACTIVE_ROUTE_ID:        'activeRouteId',
  ACTIVE_ROUTE_NAME:      'activeRouteName',
  ACTIVE_TRIP_ID:         'activeTripId',           // ID del viaje activo actual
  TRACKING_ACTIVE:        'trackingActive',
  ACTIVE_ROUTE_WAYPOINTS: 'activeRouteWaypoints',   // JSON: {lat,lng}[]
  ACTIVE_ROUTE_STOPS:     'activeRouteStops',        // JSON: {name,lat,lng,order}[]
  LAST_WAYPOINT_IDX:      'lastWaypointIdx',         // índice del último waypoint al pausar
  TRIP_IS_PAUSED:         'tripIsPaused',            // boolean — ruta pausada por el conductor
  TRIP_PAUSED_PCT:        'tripPausedPct',           // number 0-100 — progreso al pausar
} as const;