'use client';
// ─── features/routes/use-routes.ts ───────────────────────────────────────────
// Data hooks for routes — use TanStack Query + IRouteRepository (hexagonal port).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routeRepository } from './adapters/supabase-route.adapter';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  RouteRow,
  CreateRouteInput,
  Coordinate,
} from './ports/IRouteRepository';

// Re-export types consumed by routes-page.tsx
export type { RouteRow, CreateRouteInput, Coordinate };

const QUERY_KEY = ['routes'] as const;

export function useRoutes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => routeRepository.findAll(),
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation({
    mutationFn: async (input: CreateRouteInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.user_metadata?.tenant_id as string;
      return routeRepository.create(input, user?.id ?? '', tenantId);
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
