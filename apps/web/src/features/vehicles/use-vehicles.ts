'use client';
// ─── features/vehicles/use-vehicles.ts ───────────────────────────────────────
// Data hooks for vehicles — use TanStack Query + IVehicleRepository (hexagonal port).
// Components depend on this hook, NOT on Supabase directly.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleRepository } from './adapters/supabase-vehicle.adapter';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Vehicle, VehicleInsert, VehicleUpdate } from './ports/IVehicleRepository';

export type { Vehicle, VehicleInsert };

const QUERY_KEY = ['vehicles'] as const;

export function useVehicles() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => vehicleRepository.findAll(),
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation({
    mutationFn: async (input: VehicleInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      const tenantId = user?.user_metadata?.tenant_id as string;
      return vehicleRepository.create(input, tenantId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: VehicleUpdate) => vehicleRepository.update(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vehicleRepository.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
