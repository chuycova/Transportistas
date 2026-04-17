// ─── useAlertHistory.ts ───────────────────────────────────────────────────────
// Consulta la tabla `alerts` de Supabase filtrando por el vehículo del conductor.
// Solo trae alertas accionables (emergency, off_route, long_stop, speeding).

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@lib/supabase';

export interface AlertHistoryItem {
  id: string;
  alertType:
    | 'emergency'
    | 'off_route'
    | 'long_stop'
    | 'speeding'
    | 'geofence_entry'
    | 'geofence_exit'
    | string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
  routeId: string | null;
  routeName: string | null;
  isResolved: boolean;
  payload: Record<string, unknown>;
}

const ACTIONABLE_TYPES = [
  'emergency',
  'off_route',
  'long_stop',
  'speeding',
  'geofence_entry',
  'geofence_exit',
];

export function useAlertHistory() {
  const [data, setData]       = useState<AlertHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión');

      // 1. Obtener el vehicle_id asignado al conductor
      const { data: assignment, error: assignErr } = await supabase
        .from('vehicle_user_assignments')
        .select('vehicle_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (assignErr) throw assignErr;
      if (!assignment) { setData([]); return; }

      // 2. Consultar alertas del vehículo (con nombre de ruta si existe)
      const { data: rows, error: alertErr } = await supabase
        .from('alerts')
        .select(`
          id,
          alert_type,
          severity,
          created_at,
          route_id,
          is_resolved,
          payload,
          routes ( name )
        `)
        .eq('vehicle_id', assignment.vehicle_id)
        .in('alert_type', ACTIONABLE_TYPES)
        .order('created_at', { ascending: false })
        .limit(50);

      if (alertErr) throw alertErr;

      const items: AlertHistoryItem[] = (rows ?? []).map((r) => ({
        id:         r.id as string,
        alertType:  r.alert_type as AlertHistoryItem['alertType'],
        severity:   r.severity as AlertHistoryItem['severity'],
        createdAt:  r.created_at as string,
        routeId:    r.route_id as string | null,
        routeName:  (r.routes as { name: string } | null)?.name ?? null,
        isResolved: r.is_resolved as boolean,
        payload:    (r.payload ?? {}) as Record<string, unknown>,
      }));

      setData(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar alertas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
