'use client';
// ─── features/geofences/use-geofences.ts ─────────────────────────────────────
// TanStack Query hooks para gestión de geocercas.
// Usa Supabase browser client directamente (RLS filtra por tenant).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const db = () => createSupabaseBrowserClient();

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type GeofenceType = 'base' | 'client' | 'risk_zone' | 'restricted' | 'generic';

export interface Geofence {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  type: GeofenceType;
  color: string;
  polygon_coords: [number, number][]; // [lng, lat] pairs (GeoJSON order)
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGeofenceInput {
  name: string;
  description?: string;
  type: GeofenceType;
  color?: string;
  polygon_coords: [number, number][];
  alert_on_enter?: boolean;
  alert_on_exit?: boolean;
}

export interface UpdateGeofenceInput extends Partial<CreateGeofenceInput> {
  is_active?: boolean;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useGeofences() {
  return useQuery({
    queryKey: ['geofences'],
    queryFn: async () => {
      const { data, error } = await db()
        .from('geofences')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Geofence[];
    },
  });
}

export function useGeofence(id: string | undefined) {
  return useQuery({
    queryKey: ['geofences', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db()
        .from('geofences')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Geofence;
    },
  });
}

export function useCreateGeofence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGeofenceInput) => {
      const supabase = db();

      // RLS exige tenant_id = auth_tenant_id() en el WITH CHECK
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string | undefined;
      if (!tenantId) throw new Error('No se pudo obtener el tenant de la sesión');

      const { data, error } = await supabase
        .from('geofences')
        .insert({
          tenant_id: tenantId,
          name: input.name,
          description: input.description ?? null,
          type: input.type,
          color: input.color ?? '#6C63FF',
          polygon_coords: input.polygon_coords,
          alert_on_enter: input.alert_on_enter ?? true,
          alert_on_exit: input.alert_on_exit ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Geofence;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences'] }),
  });
}

export function useUpdateGeofence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateGeofenceInput & { id: string }) => {
      const { data, error } = await db()
        .from('geofences')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Geofence;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['geofences'] });
      qc.invalidateQueries({ queryKey: ['geofences', vars.id] });
    },
  });
}

export function useDeleteGeofence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('geofences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geofences'] }),
  });
}

export function useToggleGeofence() {
  const update = useUpdateGeofence();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      update.mutateAsync({ id, is_active }),
  });
}
