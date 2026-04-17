'use client';
// ─── features/routes/use-route-enrichment.ts ─────────────────────────────────
// Hooks para checkpoints, casetas y rutas alternativas.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const db = () => createSupabaseBrowserClient();

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RouteCheckpoint {
  id: string;
  route_id: string;
  name: string;
  description: string | null;
  order_index: number;
  is_mandatory: boolean;
  lat: number;
  lng: number;
  radius_m: number;
  estimated_arrival_offset_s: number | null;
  created_at: string;
}

export interface CheckpointRecord {
  id: string;
  trip_id: string;
  checkpoint_id: string;
  driver_id: string;
  arrived_at: string;
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

export interface TollBooth {
  id: string;
  route_id: string;
  name: string;
  order_index: number;
  lat: number;
  lng: number;
  cost_mxn: number | null;
  created_at: string;
}

export interface RouteAlternative {
  id: string;
  primary_route_id: string;
  name: string;
  reason: string | null;
  total_distance_m: number | null;
  estimated_duration_s: number | null;
  is_active: boolean;
  created_at: string;
}

export interface RouteSettings {
  risk_level: 'low' | 'medium' | 'high';
  max_deviation_m: number | null;
  gps_timeout_s: number | null;
  max_speed_kmh: number | null;
}

// ─── Checkpoints ──────────────────────────────────────────────────────────────

export function useRouteCheckpoints(routeId: string | undefined) {
  return useQuery({
    queryKey: ['route_checkpoints', routeId],
    enabled: !!routeId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('route_checkpoints')
        .select('id, route_id, name, description, order_index, is_mandatory, lat, lng, radius_m, estimated_arrival_offset_s, created_at')
        .eq('route_id', routeId!)
        .order('order_index');
      if (error) throw new Error(error.message);
      return data as RouteCheckpoint[];
    },
  });
}

export function useCreateCheckpoint() {
  const qc = useQueryClient();
  const supabase = db();
  return useMutation({
    mutationFn: async (input: {
      routeId: string;
      name: string;
      order_index: number;
      lat: number;
      lng: number;
      is_mandatory?: boolean;
      radius_m?: number;
      description?: string;
      estimated_arrival_offset_s?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string;
      const { error } = await supabase.from('route_checkpoints').insert({
        tenant_id: tenantId,
        route_id: input.routeId,
        name: input.name,
        order_index: input.order_index,
        lat: input.lat,
        lng: input.lng,
        is_mandatory: input.is_mandatory ?? true,
        radius_m: input.radius_m ?? 200,
        description: input.description ?? null,
        estimated_arrival_offset_s: input.estimated_arrival_offset_s ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['route_checkpoints', vars.routeId] }),
  });
}

export function useUpdateCheckpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      routeId: string;
      name?: string;
      order_index?: number;
      is_mandatory?: boolean;
      radius_m?: number;
      description?: string;
      estimated_arrival_offset_s?: number | null;
    }) => {
      const { id, routeId: _r, ...patch } = input;
      const { error } = await db().from('route_checkpoints').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['route_checkpoints', vars.routeId] }),
  });
}

export function useDeleteCheckpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, routeId }: { id: string; routeId: string }) => {
      const { error } = await db().from('route_checkpoints').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['route_checkpoints', vars.routeId] }),
  });
}

// ─── Checkpoint records (para trip-detail) ────────────────────────────────────

export function useCheckpointRecords(tripId: string | undefined) {
  return useQuery({
    queryKey: ['checkpoint_records', tripId],
    enabled: !!tripId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('checkpoint_records')
        .select('id, trip_id, checkpoint_id, driver_id, arrived_at, lat, lng, notes')
        .eq('trip_id', tripId!)
        .order('arrived_at');
      if (error) throw new Error(error.message);
      return data as CheckpointRecord[];
    },
  });
}

// ─── Toll booths ──────────────────────────────────────────────────────────────

export function useTollBooths(routeId: string | undefined) {
  return useQuery({
    queryKey: ['toll_booths', routeId],
    enabled: !!routeId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('toll_booths')
        .select('id, route_id, name, order_index, lat, lng, cost_mxn, created_at')
        .eq('route_id', routeId!)
        .order('order_index');
      if (error) throw new Error(error.message);
      return data as TollBooth[];
    },
  });
}

export function useCreateTollBooth() {
  const qc = useQueryClient();
  const supabase = db();
  return useMutation({
    mutationFn: async (input: {
      routeId: string;
      name: string;
      order_index: number;
      lat: number;
      lng: number;
      cost_mxn?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string;
      const { error } = await supabase.from('toll_booths').insert({
        tenant_id: tenantId,
        route_id: input.routeId,
        name: input.name,
        order_index: input.order_index,
        lat: input.lat,
        lng: input.lng,
        cost_mxn: input.cost_mxn ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['toll_booths', vars.routeId] }),
  });
}

export function useDeleteTollBooth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, routeId }: { id: string; routeId: string }) => {
      const { error } = await db().from('toll_booths').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['toll_booths', vars.routeId] }),
  });
}

// ─── Route alternatives ───────────────────────────────────────────────────────

export function useRouteAlternatives(routeId: string | undefined) {
  return useQuery({
    queryKey: ['route_alternatives', routeId],
    enabled: !!routeId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('route_alternatives')
        .select('id, primary_route_id, name, reason, total_distance_m, estimated_duration_s, is_active, created_at')
        .eq('primary_route_id', routeId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data as RouteAlternative[];
    },
  });
}

export function useCreateRouteAlternative() {
  const qc = useQueryClient();
  const supabase = db();
  return useMutation({
    mutationFn: async (input: {
      routeId: string;
      name: string;
      reason?: string;
      total_distance_m?: number;
      estimated_duration_s?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string;
      const { error } = await supabase.from('route_alternatives').insert({
        tenant_id: tenantId,
        primary_route_id: input.routeId,
        name: input.name,
        reason: input.reason ?? null,
        total_distance_m: input.total_distance_m ?? null,
        estimated_duration_s: input.estimated_duration_s ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['route_alternatives', vars.routeId] }),
  });
}

export function useToggleRouteAlternative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, routeId, is_active }: { id: string; routeId: string; is_active: boolean }) => {
      const { error } = await db().from('route_alternatives').update({ is_active }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['route_alternatives', vars.routeId] }),
  });
}

export function useDeleteRouteAlternative() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, routeId }: { id: string; routeId: string }) => {
      const { error } = await db().from('route_alternatives').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['route_alternatives', vars.routeId] }),
  });
}

// ─── Route settings (risk_level, max_deviation_m, etc.) ──────────────────────

export function useUpdateRouteSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, settings }: { id: string; settings: Partial<RouteSettings> }) => {
      const { error } = await db().from('routes').update(settings).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}
