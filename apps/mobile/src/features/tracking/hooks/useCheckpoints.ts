// ─── features/tracking/hooks/useCheckpoints.ts ───────────────────────────────
// Carga los checkpoints de la ruta activa, mantiene qué checkpoints ya fueron
// visitados en el viaje actual, y registra automáticamente la llegada cuando
// el conductor entra al radio de geocerca de un checkpoint.

import { useEffect, useRef, useCallback, useState } from 'react';
import { Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '@lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Checkpoint {
  id: string;
  name: string;
  order_index: number;
  is_mandatory: boolean;
  lat: number;
  lng: number;
  radius_m: number;
  estimated_arrival_offset_s: number | null;
}

export interface CheckpointStatus {
  checkpoint: Checkpoint;
  visited: boolean;
  arrivedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckpoints({
  routeId,
  tripId,
  currentCoord,
  enabled,
}: {
  routeId: string | undefined;
  tripId: string | undefined;
  currentCoord: { lat: number; lng: number } | null;
  enabled: boolean;
}) {
  const [checkpoints, setCheckpoints]   = useState<Checkpoint[]>([]);
  const [visitedIds, setVisitedIds]     = useState<Set<string>>(new Set());
  const [arrivedAt, setArrivedAt]       = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError]       = useState<string | null>(null);

  // Guardamos los ids ya procesados en este ciclo para no re-registrar
  const processingRef = useRef<Set<string>>(new Set());

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!routeId) return;
    void (async () => {
      const { data, error } = await supabase
        .from('route_checkpoints')
        .select('id, name, order_index, is_mandatory, lat, lng, radius_m, estimated_arrival_offset_s')
        .eq('route_id', routeId)
        .order('order_index');
      if (error) { setLoadError(error.message); return; }
      setCheckpoints((data ?? []) as Checkpoint[]);
    })();
  }, [routeId]);

  useEffect(() => {
    if (!tripId) return;
    void (async () => {
      const { data, error } = await supabase
        .from('checkpoint_records')
        .select('checkpoint_id, arrived_at')
        .eq('trip_id', tripId);
      if (error) return;
      const ids   = new Set((data ?? []).map((r: { checkpoint_id: string }) => r.checkpoint_id));
      const times = new Map((data ?? []).map((r: { checkpoint_id: string; arrived_at: string }) => [r.checkpoint_id, r.arrived_at]));
      setVisitedIds(ids);
      setArrivedAt(times);
      processingRef.current = new Set(ids);
    })();
  }, [tripId]);

  // ── Registrar llegada manualmente (para tests o forzar desde UI) ──────────
  const recordArrival = useCallback(async (
    checkpointId: string,
    lat: number,
    lng: number,
  ) => {
    if (!tripId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: { session } } = await supabase.auth.getSession();
    const tenantId = session?.user?.user_metadata?.tenant_id as string | undefined;
    if (!tenantId) return;

    const { error } = await supabase.from('checkpoint_records').insert({
      tenant_id:     tenantId,
      trip_id:       tripId,
      checkpoint_id: checkpointId,
      driver_id:     user.id,
      lat,
      lng,
    });
    // La constraint UNIQUE (trip_id, checkpoint_id) evita duplicados — ignoramos 23505
    if (error && !error.message.includes('duplicate')) return;

    const now = new Date().toISOString();
    setVisitedIds((prev) => new Set([...prev, checkpointId]));
    setArrivedAt((prev) => new Map([...prev, [checkpointId, now]]));
  }, [tripId]);

  // ── Auto-detección de llegada cuando cambia la coordenada ─────────────────
  useEffect(() => {
    if (!enabled || !currentCoord || !tripId || checkpoints.length === 0) return;

    for (const cp of checkpoints) {
      if (processingRef.current.has(cp.id)) continue;

      const dist = haversineMeters(currentCoord, { lat: cp.lat, lng: cp.lng });
      if (dist > cp.radius_m) continue;

      // Dentro del radio — marcar como procesando para no re-disparar
      processingRef.current.add(cp.id);

      void (async () => {
        await recordArrival(cp.id, currentCoord.lat, currentCoord.lng);

        // Notificación y vibración
        Vibration.vibrate([0, 200, 100, 200]);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: cp.is_mandatory ? '📍 Checkpoint alcanzado' : '📍 Punto opcional',
            body:  `${cp.order_index}. ${cp.name}`,
            data:  { type: 'checkpoint', checkpointId: cp.id },
          },
          trigger: null,
        });
      })();
    }
  }, [currentCoord, checkpoints, tripId, enabled, recordArrival]);

  // ── Reset al cambiar de viaje ─────────────────────────────────────────────
  useEffect(() => {
    processingRef.current = new Set();
    setVisitedIds(new Set());
    setArrivedAt(new Map());
  }, [tripId]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const statuses: CheckpointStatus[] = checkpoints.map((cp) => ({
    checkpoint: cp,
    visited:    visitedIds.has(cp.id),
    arrivedAt:  arrivedAt.get(cp.id) ?? null,
  }));

  const nextCheckpoint = checkpoints.find(
    (cp) => cp.is_mandatory && !visitedIds.has(cp.id),
  ) ?? null;

  const mandatoryTotal   = checkpoints.filter((cp) => cp.is_mandatory).length;
  const mandatoryVisited = checkpoints.filter((cp) => cp.is_mandatory && visitedIds.has(cp.id)).length;

  return {
    statuses,
    nextCheckpoint,
    mandatoryTotal,
    mandatoryVisited,
    loadError,
    recordArrival,
  };
}
