// ─── useCameraFollow.ts ──────────────────────────────────────────────────────
// Sigue la posición y heading del conductor con animación Waze-style.
// Ignora movimientos menores a ~0.5m para no disparar animaciones constantes.

import { useEffect, useRef, useCallback } from 'react';
import type MapView from 'react-native-maps';

interface UseCameraFollowParams {
  mapRef:           React.RefObject<MapView>;
  isTracking:       boolean;
  effectivePosition: { lat: number; lng: number } | null;
  effectiveHeading:  number | null | undefined;
}

export function useCameraFollow({
  mapRef,
  isTracking,
  effectivePosition,
  effectiveHeading,
}: UseCameraFollowParams) {
  const lastCameraPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!isTracking || !mapRef.current || !effectivePosition) return;
    const last = lastCameraPosRef.current;
    if (
      last &&
      Math.abs(last.lat - effectivePosition.lat) < 0.000005 &&
      Math.abs(last.lng - effectivePosition.lng) < 0.000005
    ) return;
    lastCameraPosRef.current = { lat: effectivePosition.lat, lng: effectivePosition.lng };
    mapRef.current.animateCamera(
      {
        center:   { latitude: effectivePosition.lat, longitude: effectivePosition.lng },
        heading:  effectiveHeading ?? 0,
        pitch:    0,
        zoom:     17,
        altitude: 500,
      },
      { duration: 800 },
    );
  }, [effectivePosition, effectiveHeading, isTracking]);

  // Limpiar ref al detener para re-centrar al reiniciar
  useEffect(() => {
    if (!isTracking) lastCameraPosRef.current = null;
  }, [isTracking]);

  const centerOnMe = useCallback((
    position: { lat: number; lng: number } | null,
    heading:  number | null | undefined,
  ) => {
    if (!position || !mapRef.current) return;
    lastCameraPosRef.current = null;
    mapRef.current.animateCamera(
      {
        center:   { latitude: position.lat, longitude: position.lng },
        heading:  heading ?? 0,
        pitch:    0,
        zoom:     17,
        altitude: 500,
      },
      { duration: 400 },
    );
  }, []);

  return { centerOnMe };
}
