// ─── useTrackingToggle.ts ─────────────────────────────────────────────────────
// Maneja el inicio y parada del tracking:
//   - Al detener: abre StopTrackingDialog con opciones Pausar / Cancelar ruta
//     · Pausar:  guarda progress_pct + last_waypoint_idx en DB y MMKV (trip = 'paused')
//     · Cancelar: marca trip 'cancelled' y borra estado (comportamiento anterior)
//   - Al iniciar: crea el trip si no existe; si ya hay ACTIVE_TRIP_ID (reanudando),
//     reutiliza el trip existente marcándolo in_transit.

import { useCallback, useState } from 'react';
import { getStr, storage } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';
import { updateTripStatus } from '@features/trips/hooks/useTrips';
import { createTripFromActiveRoute } from '@features/trips/lib/create-trip-from-active-route';

interface UseTrackingToggleParams {
  isTracking:       boolean;
  startTracking:    () => Promise<void>;
  stopTracking:     () => Promise<void>;
  tenantId:         string;
  setTripId:        (id: string | undefined) => void;
  /** Índice del último waypoint alcanzado (de routeProgressIdx en TrackingScreen) */
  routeProgressIdx: number;
  /** Total de waypoints de la ruta activa */
  totalWaypoints:   number;
  setArrivalSuggested:   (v: boolean) => void;
  setArrivalDismissed:   (v: boolean) => void;
  setRouteStartRecorded: (v: boolean) => void;
  /** Actualiza el estado React de pausa (sincroniza con el bottom sheet) */
  setIsPaused:           (v: boolean) => void;
  setPausedPct:          (pct: number) => void;
}

export function useTrackingToggle({
  isTracking,
  startTracking,
  stopTracking,
  tenantId,
  setTripId,
  routeProgressIdx,
  totalWaypoints,
  setArrivalSuggested,
  setArrivalDismissed,
  setRouteStartRecorded,
  setIsPaused,
  setPausedPct,
}: UseTrackingToggleParams) {

  // ── Estado del diálogo de detención ──────────────────────────────────────
  const [stopDialogVisible, setStopDialogVisible] = useState(false);

  // Porcentaje calculado al momento de mostrar el diálogo (congelado)
  const [stopDialogPct, setStopDialogPct] = useState(0);

  // ── Abrir diálogo o iniciar tracking ─────────────────────────────────────
  const handleToggle = useCallback(async () => {
    if (isTracking) {
      // Calcular porcentaje actual y mostrarlo en el diálogo
      const pct = totalWaypoints > 1
        ? Math.round((routeProgressIdx / Math.max(totalWaypoints - 1, 1)) * 100)
        : 0;
      setStopDialogPct(pct);
      setStopDialogVisible(true);
    } else {
      // ── Iniciar ─────────────────────────────────────────────────────────────
      setArrivalSuggested(false);
      setArrivalDismissed(false);
      setRouteStartRecorded(false);

      const existingTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
      if (existingTripId) {
        // Trip pausado que se reanuda: marcar in_transit y limpiar paused_at
        try {
          await updateTripStatus(existingTripId, 'in_transit', {
            paused_at: null,
          });
          // Limpiar estado de pausa en MMKV
          storage.delete(MMKV_KEYS.TRIP_IS_PAUSED);
          storage.delete(MMKV_KEYS.TRIP_PAUSED_PCT);
          // Sync React state
          setIsPaused(false);
          setPausedPct(0);
          setTripId(existingTripId);
        } catch (e) {
          console.warn('[useTrackingToggle] No se pudo reanudar viaje:', e);
        }
      } else {
        // Nuevo viaje
        const { tripId: newId, error: tripError } = await createTripFromActiveRoute(tenantId);
        if (newId) {
          setTripId(newId);
        } else {
          console.warn('[useTrackingToggle] No se pudo crear viaje:', tripError);
        }
      }

      await startTracking();
    }
  }, [isTracking, startTracking, tenantId, setTripId,
      routeProgressIdx, totalWaypoints,
      setArrivalSuggested, setArrivalDismissed, setRouteStartRecorded,
      setIsPaused, setPausedPct]);

  // ── Handlers del diálogo ─────────────────────────────────────────────────

  const handleDialogContinue = useCallback(() => {
    setStopDialogVisible(false);
  }, []);

  const handleDialogPause = useCallback(async () => {
    setStopDialogVisible(false);
    const currentTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
    if (currentTripId) {
      try {
        await updateTripStatus(currentTripId, 'paused', {
          progress_pct:      stopDialogPct,
          last_waypoint_idx: routeProgressIdx,
          paused_at:         new Date().toISOString(),
        });
        storage.set(MMKV_KEYS.LAST_WAYPOINT_IDX, routeProgressIdx);
        storage.set(MMKV_KEYS.TRIP_IS_PAUSED,    true);
        storage.set(MMKV_KEYS.TRIP_PAUSED_PCT,   stopDialogPct);
        // Sync React state so bottom sheet shows paused UI immediately
        setIsPaused(true);
        setPausedPct(stopDialogPct);
      } catch (e) {
        console.warn('[useTrackingToggle] No se pudo pausar viaje:', e);
      }
    }
    void stopTracking();
  }, [stopDialogPct, routeProgressIdx, stopTracking, setIsPaused, setPausedPct]);

  const handleDialogCancel = useCallback(async () => {
    setStopDialogVisible(false);
    const currentTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
    if (currentTripId) {
      try {
        await updateTripStatus(currentTripId, 'cancelled');
        storage.delete(MMKV_KEYS.ACTIVE_TRIP_ID);
        storage.delete(MMKV_KEYS.LAST_WAYPOINT_IDX);
        storage.delete(MMKV_KEYS.TRIP_IS_PAUSED);
        storage.delete(MMKV_KEYS.TRIP_PAUSED_PCT);
        setTripId(undefined);
      } catch (e) {
        console.warn('[useTrackingToggle] No se pudo cancelar viaje:', e);
      }
    }
    void stopTracking();
  }, [stopTracking, setTripId]);

  return {
    handleToggle,
    // Dialog state + handlers for TrackingScreen to render StopTrackingDialog
    stopDialogVisible,
    stopDialogPct,
    handleDialogContinue,
    handleDialogPause,
    handleDialogCancel,
  };
}
