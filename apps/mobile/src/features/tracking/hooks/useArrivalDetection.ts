// ─── useArrivalDetection.ts ───────────────────────────────────────────────────
// Detecta:
//  1. Llegada al primer waypoint → registra route_started_at
//  2. Proximidad al último waypoint → sugiere finalizar

import { useState, useEffect, useCallback } from 'react';
import type { LatLng } from 'react-native-maps';
import { updateTripStatus } from '@features/trips/hooks/useTrips';
import { getStr } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';

function haversine2d(a: { lat: number; lng: number }, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - a.lat) * Math.PI) / 180;
  const dLng = ((bLng - a.lng) * Math.PI) / 180;
  const sinA = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sinA), Math.sqrt(1 - sinA));
}

interface UseArrivalDetectionParams {
  isTracking:       boolean;
  effectivePosition: { lat: number; lng: number } | null;
  lastCoordinate:   { lat: number; lng: number } | null;
  routeWaypoints:   LatLng[];
  simProgress:      number; // 0‒1
}

export interface ArrivalDetectionState {
  arrivalSuggested:  boolean;
  arrivalDismissed:  boolean;
  routeStartRecorded: boolean;
  setArrivalSuggested:  (v: boolean) => void;
  setArrivalDismissed:  (v: boolean) => void;
  setRouteStartRecorded:(v: boolean) => void;
}

export function useArrivalDetection({
  isTracking,
  effectivePosition,
  lastCoordinate,
  routeWaypoints,
  simProgress,
}: UseArrivalDetectionParams): ArrivalDetectionState {
  const [arrivalSuggested,  setArrivalSuggested]  = useState(false);
  const [arrivalDismissed,  setArrivalDismissed]  = useState(false);
  const [routeStartRecorded, setRouteStartRecorded] = useState(false);

  const firstWp = routeWaypoints[0];
  const lastWp  = routeWaypoints[routeWaypoints.length - 1];

  const distToStart = useCallback((pos: { lat: number; lng: number } | null) => {
    if (!pos || !firstWp) return Infinity;
    return haversine2d(pos, firstWp.latitude, firstWp.longitude);
  }, [firstWp]);

  const distToEnd = useCallback((pos: { lat: number; lng: number } | null) => {
    if (!pos || !lastWp) return Infinity;
    return haversine2d(pos, lastWp.latitude, lastWp.longitude);
  }, [lastWp]);

  // Detectar llegada al primer punto → route_started_at
  useEffect(() => {
    if (!isTracking || routeStartRecorded) return;
    if (distToStart(effectivePosition) <= 100) {
      setRouteStartRecorded(true);
      const currentTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
      if (currentTripId) {
        void updateTripStatus(currentTripId, 'in_transit', {
          route_started_at: new Date().toISOString(),
        }).catch(() => { /* no crítico */ });
      }
    }
  }, [isTracking, routeStartRecorded, effectivePosition, distToStart]);

  // Detectar proximidad al último punto → sugerir finalizar
  useEffect(() => {
    if (!isTracking || arrivalDismissed) return;
    const near = simProgress >= 0.95 || distToEnd(lastCoordinate) <= 300;
    if (near && !arrivalSuggested) setArrivalSuggested(true);
  }, [simProgress, lastCoordinate, isTracking, arrivalDismissed, arrivalSuggested, distToEnd]);

  return {
    arrivalSuggested,
    arrivalDismissed,
    routeStartRecorded,
    setArrivalSuggested,
    setArrivalDismissed,
    setRouteStartRecorded,
  };
}
