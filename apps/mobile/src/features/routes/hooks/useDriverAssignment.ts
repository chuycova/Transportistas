// ─── useDriverAssignment.ts ────────────────────────────────────────────────────
// Encapsula fetch + realtime de la asignación de rutas del conductor.
// Re-fetches cuando la pantalla gana foco y cuando cambian las tablas de BD.

import { useState, useEffect, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '@lib/supabase';
import { setStr } from '@lib/mmkv';
import { MMKV_KEYS, API_URL } from '@lib/constants';
import type { DriverAssignment } from '../types';

export interface UseDriverAssignmentResult {
  data: DriverAssignment | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDriverAssignment(): UseDriverAssignmentResult {
  const isFocused = useIsFocused();
  const [data, setData] = useState<DriverAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchAssignment = useCallback(async () => {
    try {
      // Sesión cacheada; solo refrescar si el access_token expira en <60s.
      let { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const expiresAt = session.expires_at ?? 0;
        const nowSec    = Math.floor(Date.now() / 1000);
        if (expiresAt - nowSec < 60) {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.data.session) session = refreshed.data.session;
        }
      }
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(`${API_URL}/api/v1/driver/assignment`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);

      const assignment = (await res.json()) as DriverAssignment;
      if (!assignment.routes) {
        assignment.routes = assignment.activeRoute ? [assignment.activeRoute] : [];
      }
      setData(assignment);
      if (assignment.vehicle) {
        setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID, assignment.vehicle.id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar rutas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch cada vez que la pantalla gana foco
  useEffect(() => {
    if (!isFocused) return;
    void fetchAssignment();
  }, [isFocused, fetchAssignment]);

  // Resolver userId para realtime
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user.id ?? null);
    });
  }, []);

  // Realtime: re-fetch al cambiar asignaciones o rutas
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`driver-assignment-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles', filter: `assigned_driver_id=eq.${currentUserId}` },
        () => { void fetchAssignment(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_user_assignments', filter: `user_id=eq.${currentUserId}` },
        () => { void fetchAssignment(); })
      // Re-fetch when a new route_assignment is added or changed for this driver
      .on('postgres_changes', { event: '*', schema: 'public', table: 'route_assignments', filter: `driver_id=eq.${currentUserId}` },
        () => { void fetchAssignment(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' },
        () => { void fetchAssignment(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUserId, fetchAssignment]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    void fetchAssignment();
  }, [fetchAssignment]);

  return { data, loading, refreshing, error, refresh };
}
