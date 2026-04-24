// ─── useTripActions.ts ────────────────────────────────────────────────────────
// Acciones sobre el viaje activo del conductor:
//   - handleStart:         in_transit + escribe MMKV + navega al mapa
//   - handleAtDestination: at_destination
//   - handleComplete:      completed + limpia MMKV

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { setStr, storage } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';
import { updateTripStatus, type DriverTrip } from './useTrips';

interface UseTripActionsParams {
  activeTrip:    DriverTrip | null | undefined;
  refetch:       () => Promise<void>;
  onNavigateMap: () => void;
}

export function useTripActions({ activeTrip, refetch, onNavigateMap }: UseTripActionsParams) {

  const handleStart = useCallback(async () => {
    if (!activeTrip) return;
    try {
      await updateTripStatus(activeTrip.id, 'in_transit', {
        started_at: new Date().toISOString(),
      });
      // Persistir el viaje activo en MMKV para que TrackingScreen lo tome
      setStr(MMKV_KEYS.ACTIVE_TRIP_ID, activeTrip.id);
      if (activeTrip.route_id) setStr(MMKV_KEYS.ACTIVE_ROUTE_ID, activeTrip.route_id);
      onNavigateMap();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al iniciar viaje');
    }
  }, [activeTrip, onNavigateMap]);

  const handleAtDestination = useCallback(async () => {
    if (!activeTrip) return;
    try {
      await updateTripStatus(activeTrip.id, 'at_destination');
      void refetch();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al actualizar estado');
    }
  }, [activeTrip, refetch]);

  const handleComplete = useCallback(async () => {
    if (!activeTrip) return;
    Alert.alert(
      'Completar viaje',
      '¿Confirmas que el viaje ha sido completado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          onPress: async () => {
            try {
              await updateTripStatus(activeTrip.id, 'completed', {
                completed_at: new Date().toISOString(),
              });
              // Limpiar el trip activo del MMKV
              storage.delete(MMKV_KEYS.ACTIVE_TRIP_ID);
              void refetch();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Error al completar viaje');
            }
          },
        },
      ],
    );
  }, [activeTrip, refetch]);

  return { handleStart, handleAtDestination, handleComplete };
}
