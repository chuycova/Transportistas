'use client';
// ─── features/trips/use-trips.ts ─────────────────────────────────────────────
// TanStack Query hooks for trips — wraps ITripRepository (hexagonal port).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripRepository } from './adapters/supabase-trip.adapter';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { TripRow, CreateTripInput, TripStatus } from './ports/ITripRepository';

export type { TripRow, CreateTripInput, TripStatus };

const QUERY_KEY = ['trips'] as const;

export function useTrips() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => tripRepository.findAll(),
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    enabled: !!id,
    queryFn: () => tripRepository.findById(id!),
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');
      const tenantId = session.user.user_metadata?.tenant_id as string;
      return tripRepository.create(input, session.user.id, tenantId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateTripStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      cancellation_reason,
    }: {
      id: string;
      status: TripStatus;
      cancellation_reason?: string;
    }) => tripRepository.updateStatus(id, status, { cancellation_reason }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, vars.id] });
    },
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateTripInput> }) =>
      tripRepository.update(id, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: [...QUERY_KEY, vars.id] });
    },
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tripRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
