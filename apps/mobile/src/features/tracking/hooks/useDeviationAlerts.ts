// ─── useDeviationAlerts.ts ────────────────────────────────────────────────────
// Conecta el socket al montar, escucha alertas de desvío y dispara
// notificación local + vibración + registro en BD local.

import { useEffect } from 'react';
import { Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { connectSocket, disconnectSocket, onDeviationAlert } from '@lib/socket';
import { saveLocalAlert } from '@lib/database';
import { getAccessToken } from '@lib/supabase';

export function useDeviationAlerts() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void (async () => {
      const token = await getAccessToken();
      if (!token) return;
      connectSocket(token);
      cleanup = onDeviationAlert(async (alert) => {
        Vibration.vibrate([0, 300, 100, 300]);
        await saveLocalAlert({
          type: 'off_route',
          message: `Desvío detectado: ${Math.round(alert.deviationM)}m fuera de ruta`,
        });
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Desvío detectado',
            body: `Estás ${Math.round(alert.deviationM)}m fuera de la ruta. Regresa al trayecto.`,
            data: { type: 'deviation', ...alert },
          },
          trigger: null,
        });
      });
    })();
    return () => { cleanup?.(); disconnectSocket(); };
  }, []);
}
