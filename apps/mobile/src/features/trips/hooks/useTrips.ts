// ─── features/trips/hooks/useTrips.ts ────────────────────────────────────────
// Consulta los viajes asignados al conductor autenticado desde Supabase.
// Drivers solo ven sus propios viajes (RLS policy "trips: driver select own").

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@lib/supabase';

export type TripStatus =
  | 'draft'
  | 'scheduled'
  | 'confirmed'
  | 'in_transit'
  | 'at_destination'
  | 'paused'
  | 'completed'
  | 'closed'
  | 'cancelled';

export interface DriverTrip {
  id: string;
  code: string;
  status: TripStatus;

  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_name: string;
  dest_lat: number;
  dest_lng: number;

  cargo_type: string | null;
  container_numbers: string | null;
  weight_tons: number | null;

  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  route_started_at: string | null;
  route_completed_at: string | null;

  estimated_distance_km: number | null;
  estimated_duration_min: number | null;

  route_id: string | null;
  vehicle_id: string | null;

  // Progreso al pausar
  progress_pct:      number | null;
  last_waypoint_idx: number | null;
  paused_at:         string | null;
}

const TRIP_SELECT = `
  id, code, status,
  origin_name, origin_lat, origin_lng,
  dest_name, dest_lat, dest_lng,
  cargo_type, container_numbers, weight_tons,
  scheduled_at, started_at, completed_at,
  route_started_at, route_completed_at,
  estimated_distance_km, estimated_duration_min,
  route_id, vehicle_id,
  progress_pct, last_waypoint_idx, paused_at
`.trim();

/** Actualiza el estado de un viaje directamente desde el cliente móvil */
export async function updateTripStatus(
  tripId: string,
  status: TripStatus,
  extra?: {
    started_at?: string;
    completed_at?: string;
    route_started_at?: string;
    route_completed_at?: string;
    progress_pct?: number;
    last_waypoint_idx?: number;
    paused_at?: string | null;
  },
): Promise<void> {
  const patch: Record<string, unknown> = { status, ...extra };
  const { error } = await supabase.from('trips').update(patch).eq('id', tripId);
  if (error) throw new Error(error.message);
}

export function useTrips() {
  // ID único por instancia del hook para evitar colisiones de canal Realtime.
  // El tab navigator mantiene TripsScreen e HistoryScreen montadas simultáneamente,
  // ambas llaman a useTrips() — sin este sufijo intentarían suscribirse al mismo canal.
  const instanceIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  const [activeTrip, setActiveTrip] = useState<DriverTrip | null>(null);
  const [pastTrips,  setPastTrips]  = useState<DriverTrip[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión');

      const { data, error: err } = await supabase
        .from('trips')
        .select(TRIP_SELECT)
        .eq('driver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (err) throw err;

      const trips = (data ?? []) as DriverTrip[];

      // Separar viaje activo (el más reciente en estado activo) de historial
      // 'paused' también es activo (reanudable) para el conductor
      const active = trips.find((t) =>
        ['confirmed', 'in_transit', 'at_destination', 'paused'].includes(t.status)
      ) ?? null;

      const past = trips.filter((t) =>
        ['completed', 'closed', 'cancelled'].includes(t.status)
      );

      setActiveTrip(active);
      setPastTrips(past);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar viajes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  // Suscripción realtime — re-carga cuando cambia el estado de cualquier viaje del driver
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      // Si el componente se desmontó antes de que getUser() completara, no suscribir
      if (!user || cancelled) return;

      channel = supabase
        .channel(`driver-trips-${user.id}-${instanceIdRef.current}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'trips', filter: `driver_id=eq.${user.id}` },
          () => { void fetch(); },
        )
        .subscribe();
    };

    void setup();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetch]);

  return { activeTrip, pastTrips, loading, error, refetch: fetch };
}
