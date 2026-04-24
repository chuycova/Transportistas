// ─── useActiveRoute.ts ────────────────────────────────────────────────────────
// Lee waypoints, stops y tripId de MMKV cada vez que el tab gana foco.
// TrackingScreen permanece montado; sin este hook los datos serían stale.

import { useState, useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { LatLng } from 'react-native-maps';
import { getStr, storage } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';

export interface ActiveRouteState {
  routeId:        string;
  routeName:      string;
  vehicleId:      string;
  routeWaypoints: LatLng[];
  routeStops:     Array<{ name: string; lat: number; lng: number; order: number }>;
  tripId:         string | undefined;
  routeActive:    boolean;
  navVersion:     number;
  navFetchedRef:  React.MutableRefObject<boolean>;
  /** true cuando el conductor pausó el viaje (persiste en MMKV) */
  isPaused:       boolean;
  /** porcentaje de ruta recorrida al pausar (0-100) */
  pausedPct:      number;
  setTripId:      (id: string | undefined) => void;
  setPausedPct:   (pct: number) => void;
  setRouteWaypoints: (wps: LatLng[]) => void;
  setRouteStops:  (stops: Array<{ name: string; lat: number; lng: number; order: number }>) => void;
  setRouteActive: (v: boolean) => void;
  setNavVersion:  React.Dispatch<React.SetStateAction<number>>;
  setIsPaused:    (v: boolean) => void;
}

export function useActiveRoute(): ActiveRouteState {
  const isFocused = useIsFocused();
  const navFetchedRef = useRef(false);

  const [routeWaypoints, setRouteWaypoints] = useState<LatLng[]>([]);
  const [routeStops, setRouteStops] = useState<Array<{ name: string; lat: number; lng: number; order: number }>>([]);
  const [tripId, setTripId]       = useState<string | undefined>(() => getStr(MMKV_KEYS.ACTIVE_TRIP_ID));
  const [routeActive, setRouteActive] = useState(() => Boolean(getStr(MMKV_KEYS.ACTIVE_ROUTE_ID)));
  const [navVersion, setNavVersion]   = useState(0);
  const [isPaused, setIsPaused]       = useState(() => storage.getBoolean(MMKV_KEYS.TRIP_IS_PAUSED) ?? false);
  const [pausedPct, setPausedPct]     = useState(() => storage.getNumber(MMKV_KEYS.TRIP_PAUSED_PCT) ?? 0);

  useEffect(() => {
    if (!isFocused) return;

    const freshTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
    setTripId(freshTripId);

    // Sincronizar estado de pausa desde MMKV al ganar foco
    const paused = storage.getBoolean(MMKV_KEYS.TRIP_IS_PAUSED) ?? false;
    const pct    = storage.getNumber(MMKV_KEYS.TRIP_PAUSED_PCT) ?? 0;
    setIsPaused(paused);
    setPausedPct(pct);

    // Reset nav so it recalculates with fresh position
    navFetchedRef.current = false;
    setNavVersion((v) => v + 1);

    try {
      const raw = getStr(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS);
      if (!raw) {
        setRouteWaypoints([]);
        setRouteActive(false);
        return;
      }
      const parsed = (JSON.parse(raw) as Array<{ lat: number; lng: number }>)
        .map((p) => ({ latitude: p.lat, longitude: p.lng }));
      setRouteWaypoints(parsed);
      setRouteActive(true);
    } catch {
      setRouteWaypoints([]);
    }

    try {
      const raw = getStr(MMKV_KEYS.ACTIVE_ROUTE_STOPS);
      if (!raw) { setRouteStops([]); return; }
      setRouteStops(JSON.parse(raw) as Array<{ name: string; lat: number; lng: number; order: number }>);
    } catch { setRouteStops([]); }
  }, [isFocused]);

  return {
    routeId:        getStr(MMKV_KEYS.ACTIVE_ROUTE_ID)   ?? '',
    routeName:      getStr(MMKV_KEYS.ACTIVE_ROUTE_NAME)  ?? 'Ruta activa',
    vehicleId:      getStr(MMKV_KEYS.ACTIVE_VEHICLE_ID)  ?? '',
    routeWaypoints,
    routeStops,
    tripId,
    routeActive,
    navVersion,
    navFetchedRef,
    isPaused,
    pausedPct,
    setTripId,
    setRouteWaypoints,
    setRouteStops,
    setRouteActive,
    setNavVersion,
    setIsPaused,
    setPausedPct,
  };
}
