'use client';
// ─── features/vehicles/use-vehicle-detail.ts ─────────────────────────────────
// Hooks de datos para la pantalla de detalle de un vehículo individual.
// Queries directas a Supabase (browser client) — RLS asegura que solo se ven
// datos del tenant del usuario autenticado.

import { useQuery } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const db = () => createSupabaseBrowserClient();

// ─── Tipo de alerta ───────────────────────────────────────────────────────────
export interface VehicleAlert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  payload: Record<string, unknown>;
  is_resolved: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  route_id: string | null;
}

// ─── Tipo de ruta completada/historial ───────────────────────────────────────
export interface VehicleRouteRecord {
  id: string;
  name: string;
  status: string;
  origin_name: string;
  dest_name: string;
  total_distance_m: number | null;
  estimated_duration_s: number | null;
  created_at: string;
  updated_at: string;
  deviation_threshold_m: number | null;
}

// ─── Punto de tracking reciente ───────────────────────────────────────────────
export interface TrackingPoint {
  id: number;
  recorded_at: string;
  speed_kmh: number | null;
  heading_deg: number | null;
  is_off_route: boolean;
  deviation_m: number | null;
  lat: number;
  lng: number;
}

// ─── 1. Rutas históricas del vehículo ────────────────────────────────────────
export function useVehicleRoutes(vehicleId: string) {
  return useQuery<VehicleRouteRecord[]>({
    queryKey: ['vehicle-routes', vehicleId],
    queryFn: async () => {
      const { data, error } = await db()
        .from('routes')
        .select('id, name, status, origin_name, dest_name, total_distance_m, estimated_duration_s, created_at, updated_at, deviation_threshold_m')
        .eq('vehicle_id', vehicleId)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!vehicleId,
    staleTime: 60_000,
  });
}

// ─── 2. Alertas del vehículo (desvíos, emergencias, etc.) ────────────────────
export function useVehicleAlerts(vehicleId: string) {
  return useQuery<VehicleAlert[]>({
    queryKey: ['vehicle-alerts', vehicleId],
    queryFn: async () => {
      const { data, error } = await db()
        .from('alerts')
        .select('id, alert_type, severity, payload, is_resolved, resolved_at, resolution_note, created_at, route_id')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data ?? []) as VehicleAlert[];
    },
    enabled: !!vehicleId,
    staleTime: 30_000,
  });
}

// ─── 3. Track reciente del vehículo (últimas 200 posiciones) ─────────────────
// Usado para la línea de tiempo actual y el mini-mapa de ruta en progreso.
export function useVehicleTrack(vehicleId: string) {
  return useQuery<TrackingPoint[]>({
    queryKey: ['vehicle-track', vehicleId],
    queryFn: async () => {
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(); // últimas 6h
      const { data, error } = await db()
        .from('locations')
        .select('id, recorded_at, speed_kmh, heading_deg, is_off_route, deviation_m, point')
        .eq('vehicle_id', vehicleId)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);

      // point es un GeoJSON geography point — extraer lat/lng
      return (data ?? []).map((row) => {
        // Supabase devuelve geography como GeoJSON string o objeto
        const pt = row.point as unknown as { coordinates?: [number, number] } | string | null;
        let lat = 0, lng = 0;
        if (pt && typeof pt === 'object' && 'coordinates' in pt && pt.coordinates) {
          [lng, lat] = pt.coordinates; // GeoJSON es [lng, lat]
        }
        return {
          id: row.id as number,
          recorded_at: row.recorded_at as string,
          speed_kmh: row.speed_kmh as number | null,
          heading_deg: row.heading_deg as number | null,
          is_off_route: row.is_off_route as boolean,
          deviation_m: row.deviation_m as number | null,
          lat,
          lng,
        };
      });
    },
    enabled: !!vehicleId,
    staleTime: 10_000,
    refetchInterval: 15_000, // refrescar cada 15s para ver posición actual
  });
}
