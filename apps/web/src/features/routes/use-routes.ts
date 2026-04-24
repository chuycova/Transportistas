'use client';
// ─── features/routes/use-routes.ts ───────────────────────────────────────────
// Data hooks for routes — use TanStack Query + IRouteRepository (hexagonal port).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routeRepository } from './adapters/supabase-route.adapter';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  RouteRow,
  RouteStop,
  CreateRouteInput,
  Coordinate,
} from './ports/IRouteRepository';

// Re-export types consumed by routes-page.tsx and route-detail-page.tsx
export type { RouteRow, RouteStop, CreateRouteInput, Coordinate };

const QUERY_KEY = ['routes'] as const;

export function useRoutes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => routeRepository.findAll(),
  });
}

export function useRoute(id: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    enabled: !!id,
    queryFn: () => routeRepository.findById(id!),
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation({
    mutationFn: async (input: CreateRouteInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string;
      return routeRepository.create(input, session?.user?.id ?? '', tenantId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateRouteStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      routeRepository.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => routeRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

/**
 * Asigna un conductor (driverId) a una ruta (routeId).
 * La lógica del backend crea un registro en route_assignments y mantiene
 * routes.vehicle_id por backward-compat.
 * Solo monitores pueden llamar a este hook — el backend lanza 403 si no.
 */
export function useAssignDriverToRoute() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation<void, Error, { routeId: string; driverId: string; notes?: string }>({
    mutationFn: async ({ routeId, driverId, notes }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(
        `${BACKEND_URL}/api/v1/routes/${routeId}/assign-driver`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ driverId, notes }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ['drivers'] });
      qc.invalidateQueries({ queryKey: ['vehicles'] });
      qc.invalidateQueries({ queryKey: ['route-assignments'] });
    },
  });
}

// ── Route Assignments (history) ─────────────────────────────────────────────

export interface RouteAssignmentRow {
  id: string;
  route_id: string;
  vehicle_id: string;
  driver_id: string;
  assigned_at: string;
  assigned_by: string | null;
  is_active: boolean;
  notes: string | null;
}

/**
 * Fetches the assignment history for a specific route, newest first.
 */
export function useRouteAssignments(routeId: string | undefined) {
  const supabase = createSupabaseBrowserClient();
  return useQuery({
    queryKey: ['route-assignments', routeId],
    enabled: !!routeId,
    queryFn: async (): Promise<RouteAssignmentRow[]> => {
      const { data, error } = await supabase
        .from('route_assignments')
        .select('id, route_id, vehicle_id, driver_id, assigned_at, assigned_by, is_active, notes')
        .eq('route_id', routeId!)
        .order('assigned_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data as RouteAssignmentRow[];
    },
  });
}
