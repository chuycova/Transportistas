// ─── useGpsTracking.ts ────────────────────────────────────────────────────────
// Hook que gestiona el ciclo Start/Stop del tracking GPS.
//
// Estrategia:
//   - Foreground: watchPositionAsync con alta precisión
//   - Background: startLocationUpdatesAsync (requiere permisos AlwaysAllow en iOS)
//   - Offline: enqueuePing → WatermelonDB (synced=false)
//   - Online: emitLocationPing → socket → backend ProcessLocationUseCase

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import NetInfo from '@react-native-community/netinfo';
import {
  BACKGROUND_GPS_TASK,
  GPS_INTERVAL_MS,
  GPS_DISTANCE_INTERVAL_M,
  MMKV_KEYS,
} from '@lib/constants';
import { setStr, setBool, getBool } from '@lib/mmkv';
import { emitLocationPing, emitTrackingStart, emitTrackingStop, isSocketConnected } from '@lib/socket';
import { enqueuePing } from '@lib/database';

export interface GpsTrackingOptions {
  vehicleId: string;
  tenantId: string;
  routeId?: string;
  tripId?: string;
}

export interface GpsTrackingState {
  isTracking: boolean;
  lastCoordinate: { lat: number; lng: number } | null;
  heading: number | null;
  permissionStatus: Location.PermissionStatus | null;
  error: string | null;
}

export function useGpsTracking(options: GpsTrackingOptions) {
  const [state, setState] = useState<GpsTrackingState>({
    isTracking: false,
    lastCoordinate: null,
    heading: null,
    permissionStatus: null,
    error: null,
  });

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ─── Solicitar permisos ───────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setState((prev) => ({ ...prev, permissionStatus: status }));
    })();
  }, []);

  // ─── Handler de posición (foreground) ────────────────────────────────────
  const handleLocation = useCallback(async (location: Location.LocationObject) => {
    const { latitude: lat, longitude: lng, speed, heading, accuracy } = location.coords;
    const { vehicleId, tenantId, routeId, tripId } = optionsRef.current;

    setState((prev) => ({ ...prev, lastCoordinate: { lat, lng }, heading: heading ?? prev.heading }));

    const payload = {
      vehicleId,
      tenantId,
      routeId,
      tripId,
      coordinate: { lat, lng },
      speedKmh:   speed  != null ? Number((speed  * 3.6).toFixed(1)) : undefined,
      headingDeg: heading != null ? Math.round(heading) : undefined,
      accuracyM:  accuracy != null ? Math.round(accuracy) : undefined,
      recordedAt: new Date(location.timestamp).toISOString(),
    };

    const sent = emitLocationPing(payload);

    if (!sent) {
      // Sin socket → encolar en WatermelonDB
      await enqueuePing({
        vehicleId,
        tenantId,
        routeId,
        tripId,
        lat,
        lng,
        speedKmh:   payload.speedKmh,
        headingDeg: payload.headingDeg,
        accuracyM:  payload.accuracyM,
        recordedAt: location.timestamp,
      });
    }
  }, []);

  // ─── Iniciar tracking ─────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    const { vehicleId, tenantId, routeId } = optionsRef.current;

    if (state.permissionStatus !== Location.PermissionStatus.GRANTED) {
      setState((prev) => ({ ...prev, error: 'Permisos de ubicación no otorgados.' }));
      return;
    }

    // Guardar contexto en MMKV para la tarea en background
    setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID, vehicleId);
    setStr(MMKV_KEYS.ACTIVE_ROUTE_ID, routeId ?? '');
    setStr('tenantId', tenantId);
    setBool(MMKV_KEYS.TRACKING_ACTIVE, true);

    try {
      // Foreground watch
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: GPS_INTERVAL_MS,
          distanceInterval: GPS_DISTANCE_INTERVAL_M,
        },
        handleLocation,
      );

      // Background GPS (requiere permiso AlwaysAllow en iOS)
      const bgStatus = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus.status === Location.PermissionStatus.GRANTED) {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_GPS_TASK);
        if (isRegistered) {
          await Location.startLocationUpdatesAsync(BACKGROUND_GPS_TASK, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: GPS_INTERVAL_MS * 2, // Menos frecuente en bg
            distanceInterval: GPS_DISTANCE_INTERVAL_M,
            showsBackgroundLocationIndicator: true, // iOS: barra azul
            foregroundService: {
              notificationTitle: 'ZonaZero — Tracking activo',
              notificationBody: 'Tu ubicación se está enviando en tiempo real.',
              notificationColor: '#6C63FF',
            },
          });
        }
      }

      // Notificar al backend que esta sesión pertenece a este vehículo
      // Solo emitir si vehicleId es un UUID válido (no vacío)
      if (vehicleId) {
        emitTrackingStart(vehicleId, tenantId);
      }

      setState((prev) => ({ ...prev, isTracking: true, error: null }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar tracking';
      setState((prev) => ({ ...prev, error: msg }));
    }
  }, [state.permissionStatus, handleLocation]);

  // ─── Detener tracking ─────────────────────────────────────────────────────
  const stopTracking = useCallback(async () => {
    watchRef.current?.remove();
    watchRef.current = null;

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_GPS_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_GPS_TASK);
    }

    // Notificar al backend antes de desconectar para que marque el vehículo inactive
    emitTrackingStop();

    setBool(MMKV_KEYS.TRACKING_ACTIVE, false);
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      watchRef.current?.remove();
    };
  }, []);

  return { ...state, startTracking, stopTracking };
}
