// ─── useRouteLifecycle.ts ────────────────────────────────────────────────────
// Gestiona el ciclo de vida de la ruta activa:
//   - clearRouteState:    limpia MMKV + estado local
//   - handleCompleteTrip: finaliza el trip en DB, detiene tracking, resetea flags
//   - handleSheetChange:  cancela trip huérfano si el sheet se descarta sin iniciar tracking

import { useCallback } from 'react';
import type { LatLng } from 'react-native-maps';
import { storage, getStr } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';
import { supabase } from '@lib/supabase';
import { updateTripStatus } from '@features/trips/hooks/useTrips';

interface UseRouteLifecycleParams {
  // Simulador GPS (necesario para pausar al completar)
  sim: { pause: () => void };
  // GPS tracking
  stopTracking: () => Promise<void>;
  isTracking: boolean;
  // State setters de useActiveRoute
  setTripId:         (id: string | undefined) => void;
  setRouteWaypoints: (wps: LatLng[]) => void;
  setRouteStops:     (stops: Array<{ name: string; lat: number; lng: number; order: number }>) => void;
  setRouteActive:    (v: boolean) => void;
  setNavToStartPath: (path: LatLng[]) => void;
  navFetchedRef:     React.MutableRefObject<boolean>;
  // State setters de useArrivalDetection
  setArrivalSuggested:   (v: boolean) => void;
  setArrivalDismissed:   (v: boolean) => void;
  setRouteStartRecorded: (v: boolean) => void;
  setIsPaused:           (v: boolean) => void;
}

export function useRouteLifecycle({
  sim,
  stopTracking,
  isTracking,
  setTripId,
  setRouteWaypoints,
  setRouteStops,
  setRouteActive,
  setNavToStartPath,
  navFetchedRef,
  setArrivalSuggested,
  setArrivalDismissed,
  setRouteStartRecorded,
  setIsPaused,
}: UseRouteLifecycleParams) {

  // ── Limpiar toda la ruta del estado local y de MMKV ─────────────────────
  const clearRouteState = useCallback(() => {
    storage.delete(MMKV_KEYS.ACTIVE_ROUTE_ID);
    storage.delete(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS);
    storage.delete(MMKV_KEYS.ACTIVE_ROUTE_STOPS);
    // Al limpiar la ruta, el estado de pausa ya no aplica
    storage.delete(MMKV_KEYS.TRIP_IS_PAUSED);
    storage.delete(MMKV_KEYS.TRIP_PAUSED_PCT);
    storage.delete(MMKV_KEYS.LAST_WAYPOINT_IDX);
    setIsPaused(false);
    setRouteWaypoints([]);
    setRouteStops([]);
    setNavToStartPath([]);
    setRouteActive(false);
    navFetchedRef.current = false;
  }, [setIsPaused, setRouteWaypoints, setRouteStops, setNavToStartPath, setRouteActive, navFetchedRef]);

  // ── Completar viaje (botón "Finalizar" / banner de llegada) ──────────────
  const handleCompleteTrip = useCallback(async () => {
    const currentTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
    if (currentTripId) {
      try {
        const now = new Date().toISOString();
        await updateTripStatus(currentTripId, 'completed', {
          completed_at: now,
          route_completed_at: now,
        });
        storage.delete(MMKV_KEYS.ACTIVE_TRIP_ID);
        setTripId(undefined);
      } catch (e) {
        console.warn('[useRouteLifecycle] No se pudo marcar viaje como completado:', e);
      }
    } else {
      console.warn('[useRouteLifecycle] handleCompleteTrip: no se encontró ACTIVE_TRIP_ID');
    }
    sim.pause();
    void stopTracking();
    setArrivalSuggested(false);
    setArrivalDismissed(false);
    setRouteStartRecorded(false);
    clearRouteState();
  }, [sim, stopTracking, setTripId, setArrivalSuggested, setArrivalDismissed,
      setRouteStartRecorded, clearRouteState]);

  // ── Sheet dismiss: sólo cancela trip huérfano si NO está pausado ─────────
  // Si la ruta está pausada y el conductor desliza el sheet hacia abajo,
  // se mantiene el trip y el estado MMKV para que pueda reanudarlo desde
  // la pantalla Rutas.
  //
  // IMPORTANTE: leemos TRIP_IS_PAUSED directamente de MMKV (síncrono) en lugar
  // de usar el valor `isPaused` de React state. Cuando el usuario pausa,
  // setIsPaused(true) se encola como state update, pero el BottomSheet puede
  // disparar onChange(-1) con el callback viejo (closure stale donde isPaused
  // aún es false). MMKV siempre refleja la última escritura.
  const handleSheetChange = useCallback((idx: number) => {
    if (idx !== -1 || isTracking) return;
    // Leer directamente de MMKV para evitar stale closure
    const pausedInMmkv = storage.getBoolean(MMKV_KEYS.TRIP_IS_PAUSED) ?? false;
    if (pausedInMmkv) return;
    const orphanedTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
    if (orphanedTripId) {
      void supabase
        .from('trips')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          cancellation_reason: 'Descartado desde pantalla Mapa sin iniciar tracking',
        })
        .eq('id', orphanedTripId)
        .then(({ error: err }) => {
          if (err) console.warn('[useRouteLifecycle] Error cancelando trip huérfano:', err.message);
        });
    }
    storage.delete(MMKV_KEYS.ACTIVE_TRIP_ID);
    clearRouteState();
  }, [isTracking, clearRouteState]);

  return { clearRouteState, handleCompleteTrip, handleSheetChange };
}
