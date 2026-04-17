'use client';
// ─── features/vehicles/use-vehicle-detail.ts ─────────────────────────────────
// Hooks de datos para la pantalla de detalle de un vehículo individual.
// Queries directas a Supabase (browser client) — RLS asegura que solo se ven
// datos del tenant del usuario autenticado.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const db = () => createSupabaseBrowserClient();

// ─── Tipos ────────────────────────────────────────────────────────────────────

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

export interface AssignedUserProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
}

export interface AssignedUserRecord {
  id: string;
  user_id: string;
  assigned_at: string;
  unassigned_at: string | null;
  is_active: boolean;
  notes: string | null;
  assigned_by: string | null;
  profile: AssignedUserProfile | null;
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

      return (data ?? []).map((row) => {
        const pt = row.point as unknown as { coordinates?: [number, number] } | string | null;
        let lat = 0, lng = 0;
        if (pt && typeof pt === 'object' && 'coordinates' in pt && pt.coordinates) {
          [lng, lat] = pt.coordinates;
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
    refetchInterval: 15_000,
  });
}

// ─── 4. Usuarios asignados al vehículo (activos + historial) ─────────────────
export function useVehicleAssignedUsers(vehicleId: string) {
  return useQuery<AssignedUserRecord[]>({
    queryKey: ['vehicle-users', vehicleId],
    queryFn: async () => {
      const client = db();

      const { data: assignments, error: aErr } = await client
        .from('vehicle_user_assignments')
        .select('id, user_id, assigned_at, unassigned_at, is_active, notes, assigned_by')
        .eq('vehicle_id', vehicleId)
        .order('assigned_at', { ascending: false });
      if (aErr) throw new Error(aErr.message);
      if (!assignments || assignments.length === 0) return [];

      const userIds = [...new Set(assignments.map((a) => a.user_id))];
      const { data: profiles, error: pErr } = await client
        .from('profiles')
        .select('id, full_name, phone, role, avatar_url, is_active')
        .in('id', userIds);
      if (pErr) throw new Error(pErr.message);

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as AssignedUserProfile]));

      return assignments.map((a) => ({
        ...a,
        profile: profileMap.get(a.user_id) ?? null,
      }));
    },
    enabled: !!vehicleId,
    staleTime: 30_000,
  });
}

// ─── 5. Solo los IDs activos (para inicializar el form de edición) ────────────
export function useVehicleAssignedUserIds(vehicleId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ['vehicle-user-ids', vehicleId],
    queryFn: async () => {
      const { data, error } = await db()
        .from('vehicle_user_assignments')
        .select('user_id')
        .eq('vehicle_id', vehicleId!)
        .eq('is_active', true);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.user_id);
    },
    enabled: !!vehicleId,
    staleTime: 30_000,
  });
}

// ─── 6. Sincronizar asignaciones (diff + apply) ───────────────────────────────
// Usado al guardar el form: compara selección actual con BD y aplica el diff.
// Si se proporciona primaryDriverId, también actualiza vehicles.assigned_driver_id
// para mantener consistencia con el routing controller y el driver-assignment controller.
export function useSyncVehicleUsers() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation({
    mutationFn: async ({
      vehicleId,
      userIds,
      tenantId,
      assignedBy,
      primaryDriverId,
    }: {
      vehicleId: string;
      userIds: string[];
      tenantId: string;
      assignedBy: string;
      /** ID del conductor principal (acceso móvil). Si es '' limpia el campo. */
      primaryDriverId?: string;
    }) => {
      const { data: current, error: fetchErr } = await supabase
        .from('vehicle_user_assignments')
        .select('id, user_id')
        .eq('vehicle_id', vehicleId)
        .eq('is_active', true);
      if (fetchErr) throw new Error(fetchErr.message);

      const currentAssignments = current ?? [];
      const currentIds = currentAssignments.map((a) => a.user_id);

      const toAdd = userIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentAssignments.filter((a) => !userIds.includes(a.user_id));

      if (toAdd.length > 0) {
        const { error } = await supabase.from('vehicle_user_assignments').insert(
          toAdd.map((userId) => ({
            vehicle_id: vehicleId,
            user_id: userId,
            tenant_id: tenantId,
            assigned_by: assignedBy,
          })),
        );
        if (error) throw new Error(error.message);
      }

      for (const a of toRemove) {
        const { error } = await supabase
          .from('vehicle_user_assignments')
          .update({ is_active: false, unassigned_at: new Date().toISOString() })
          .eq('id', a.id);
        if (error) throw new Error(error.message);
      }

      // Sincronizar vehicles.assigned_driver_id con el conductor primario seleccionado.
      // Este campo es el que usan el routing controller y el driver-assignment controller
      // para encontrar el vehículo del conductor — si no se actualiza aquí, la asignación
      // de rutas falla con "El conductor no tiene vehículo asignado".
      if (primaryDriverId !== undefined) {
        const { error } = await supabase
          .from('vehicles')
          .update({ assigned_driver_id: primaryDriverId || null })
          .eq('id', vehicleId);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: (_, { vehicleId }) => {
      void qc.invalidateQueries({ queryKey: ['vehicle-users', vehicleId] });
      void qc.invalidateQueries({ queryKey: ['vehicle-user-ids', vehicleId] });
      void qc.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

// ─── 7. Añadir usuario individual (desde el detalle del vehículo) ─────────────
export function useAddVehicleUser() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation({
    mutationFn: async ({ vehicleId, userId }: { vehicleId: string; userId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.user_metadata?.tenant_id as string;

      const { error } = await supabase.from('vehicle_user_assignments').insert({
        vehicle_id: vehicleId,
        user_id: userId,
        tenant_id: tenantId,
        assigned_by: user?.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { vehicleId }) => {
      void qc.invalidateQueries({ queryKey: ['vehicle-users', vehicleId] });
    },
  });
}

// ─── 8. Desasignar usuario (soft-delete, queda en historial) ──────────────────
export function useRemoveVehicleUser() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation({
    mutationFn: async (vars: { assignmentId: string; vehicleId: string }) => {
      const { error } = await supabase
        .from('vehicle_user_assignments')
        .update({ is_active: false, unassigned_at: new Date().toISOString() })
        .eq('id', vars.assignmentId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { vehicleId }) => {
      void qc.invalidateQueries({ queryKey: ['vehicle-users', vehicleId] });
    },
  });
}
