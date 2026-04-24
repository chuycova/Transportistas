// ─── useNavToStart.ts ─────────────────────────────────────────────────────────
// Calcula y mantiene la ruta de navegación desde la posición del conductor
// hasta el primer waypoint de la ruta asignada.
// Se re-calcula cuando el tab gana foco (navVersion) o al reiniciar tracking.

import { useState, useEffect, useCallback } from 'react';
import type { LatLng } from 'react-native-maps';
import { haversineDistance } from '../lib/geo';
import { fetchDirectionsToStart } from '../lib/directions';
import { emitNavigationRoute, onSocketReconnect } from '@lib/socket';

interface UseNavToStartParams {
  driverPosition: { lat: number; lng: number } | null;
  routeWaypoints: LatLng[];
  navVersion:     number;
  navFetchedRef:  React.MutableRefObject<boolean>;
  isTracking:     boolean;
  vehicleId:      string;
  routeId:        string;
}

export function useNavToStart({
  driverPosition,
  routeWaypoints,
  navVersion,
  navFetchedRef,
  isTracking,
  vehicleId,
  routeId,
}: UseNavToStartParams): {
  navToStartPath: LatLng[];
  setNavToStartPath: (path: LatLng[]) => void;
} {
  const [navToStartPath, setNavToStartPath] = useState<LatLng[]>([]);

  // Calcular ruta hacia el inicio
  useEffect(() => {
    if (!driverPosition || routeWaypoints.length === 0) return;
    if (navFetchedRef.current) return;
    const startPoint = routeWaypoints[0]!;
    const dist = haversineDistance(
      { lat: driverPosition.lat, lng: driverPosition.lng },
      { lat: startPoint.latitude, lng: startPoint.longitude },
    );
    if (dist < 50) {
      navFetchedRef.current = true;
      return;
    }
    navFetchedRef.current = true;
    void fetchDirectionsToStart(
      { lat: driverPosition.lat, lng: driverPosition.lng },
      { lat: startPoint.latitude, lng: startPoint.longitude },
    ).then((path) => {
      setNavToStartPath(path);
      if (vehicleId && routeId && path.length >= 2) {
        emitNavigationRoute(
          vehicleId,
          routeId,
          path.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        );
      }
    }).catch(() => { /* silencioso */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverPosition, routeWaypoints, navVersion]);

  // Re-emitir la ruta de navegación al (re)conectar el socket.
  // Cubre el caso donde la ruta se calculó ANTES de que el socket estuviera listo
  // (tab ganó foco → Directions API → emit → socket null → se perdió).
  useEffect(() => {
    if (!isTracking || !vehicleId || !routeId) return;
    const cleanup = onSocketReconnect(() => {
      if (navToStartPath.length >= 2) {
        emitNavigationRoute(
          vehicleId,
          routeId,
          navToStartPath.map((p) => ({ lat: p.latitude, lng: p.longitude })),
        );
      }
    });
    return cleanup;
  }, [isTracking, vehicleId, routeId, navToStartPath]);

  // Limpiar al detener tracking
  useEffect(() => {
    if (!isTracking) {
      navFetchedRef.current = false;
      setNavToStartPath([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking]);

  return { navToStartPath, setNavToStartPath };
}
