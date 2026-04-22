// ─── usePingSync.ts ───────────────────────────────────────────────────────────
// Hook que drena la cola offline de WatermelonDB hacia el backend.
//
// Se activa cuando:
//   - NetInfo detecta reconexión de red
//   - El socket se reconecta al servidor
//   - La pantalla se monta (por si la app abrió con red disponible)
//
// Procesa todos los pings pendientes en lotes de BATCH_SIZE hasta vaciar la cola.
// Si un ping falla (sin socket ni HTTP), detiene el lote para evitar envíos
// desordenados y reintentará en la próxima reconexión.

import { useEffect, useRef, useCallback } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { Q } from '@nozbe/watermelondb';
import { database, markPingSynced } from '@lib/database';
import type { GpsPing } from '@lib/database/models/GpsPing.model';
import { emitLocationPing, isSocketConnected, onSocketReconnect } from '@lib/socket';
import { API_URL, MMKV_KEYS } from '@lib/constants';
import { getBool } from '@lib/mmkv';
import { supabase } from '@lib/supabase';

const BATCH_SIZE = 50;

export function usePingSync() {
  const isSyncing = useRef(false);

  const drainQueue = useCallback(async () => {
    // No drena si el tracking está inactivo: evita que pings offline lleguen
    // al servidor después de detener el viaje y hagan parecer que sigue activo.
    if (!getBool(MMKV_KEYS.TRACKING_ACTIVE)) return;
    if (isSyncing.current) return;
    isSyncing.current = true;

    try {
      const pingsCollection = database.get<GpsPing>('gps_pings');

      // Procesar en bucle hasta vaciar la cola completamente
      while (true) {
        const pendingPings = await pingsCollection
          .query(Q.where('synced', false), Q.sortBy('recorded_at', Q.asc), Q.take(BATCH_SIZE))
          .fetch();

        if (!pendingPings.length) break;

        console.log(`[PingSync] Drenando ${pendingPings.length} pings de la cola...`);

        let batchFailed = false;

        for (const ping of pendingPings) {
          const payload = {
            vehicleId:  ping.vehicleId,
            tenantId:   ping.tenantId,
            routeId:    ping.routeId ?? undefined,
            tripId:     ping.tripId ?? undefined,
            coordinate: { lat: ping.lat, lng: ping.lng },
            speedKmh:   ping.speedKmh ?? undefined,
            headingDeg: ping.headingDeg ?? undefined,
            accuracyM:  ping.accuracyM ?? undefined,
            recordedAt: new Date(ping.recordedAt).toISOString(),
          };

          let sent = false;

          // Intentar 1: socket (más eficiente)
          if (isSocketConnected()) {
            sent = emitLocationPing(payload);
          }

          // Intentar 2: REST HTTP si socket no disponible
          if (!sent) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const res = await fetch(`${API_URL}/tracking/ping`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session?.access_token ?? ''}`,
                },
                body: JSON.stringify(payload),
              });
              sent = res.ok;
            } catch {
              console.warn('[PingSync] HTTP también falló, manteniendo en cola');
            }
          }

          if (sent) {
            await markPingSynced(ping);
          } else {
            // Sin red disponible: detener el lote y reintentar en la próxima reconexión
            batchFailed = true;
            break;
          }
        }

        if (batchFailed) break;
      }

      console.log('[PingSync] Sync completado');
    } finally {
      isSyncing.current = false;
    }
  }, []);

  // Escuchar cambios de red y disparar sync al reconectarse
  useEffect(() => {
    const unsubscribeNet = NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = state.isConnected && state.isInternetReachable;
      if (isOnline) {
        void drainQueue();
      }
    });

    // Disparar sync también cuando el socket se reconecta
    const unsubscribeSocket = onSocketReconnect(() => {
      void drainQueue();
    });

    // También intentar al montar (por si la app abrió con red disponible)
    void drainQueue();

    return () => {
      unsubscribeNet();
      unsubscribeSocket();
    };
  }, [drainQueue]);

  return { drainQueue };
}
