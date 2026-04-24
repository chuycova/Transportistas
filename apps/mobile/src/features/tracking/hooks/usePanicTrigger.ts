// ─── usePanicTrigger.ts ───────────────────────────────────────────────────────
// Envía una alerta SOS por socket o HTTP (fallback), guarda alerta local
// y dispara notificación + vibración.

import { useCallback } from 'react';
import { Alert, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { emitPanicAlert } from '@lib/socket';
import { getAccessToken } from '@lib/supabase';
import { saveLocalAlert } from '@lib/database';
import { API_URL } from '@lib/constants';

interface UsePanicTriggerParams {
  vehicleId:      string;
  lastCoordinate: { lat: number; lng: number } | null;
}

export function usePanicTrigger({ vehicleId, lastCoordinate }: UsePanicTriggerParams) {
  const triggerPanic = useCallback(async () => {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    const payload = {
      vehicleId,
      coordinate: lastCoordinate
        ? { lat: lastCoordinate.lat, lng: lastCoordinate.lng }
        : undefined,
    };

    const sent = emitPanicAlert(payload);
    if (!sent) {
      try {
        const token = await getAccessToken();
        await fetch(`${API_URL}/api/v1/tracking/panic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
      } catch { /* fallback silencioso */ }
    }

    await saveLocalAlert({
      type: 'off_route',
      message: 'SOS enviado — se ha notificado al centro de control',
    });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SOS Enviado',
        body: 'Centro de control notificado. Mantén la calma.',
        data: { type: 'panic' },
      },
      trigger: null,
    });
    Alert.alert('SOS Enviado', 'Centro de control notificado. Mantén la calma.');
  }, [vehicleId, lastCoordinate]);

  return { triggerPanic };
}
