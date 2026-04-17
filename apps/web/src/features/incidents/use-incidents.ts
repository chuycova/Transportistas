'use client';
// ─── features/incidents/use-incidents.ts ─────────────────────────────────────
// TanStack Query hooks para incidentes y evidencias.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { incidentRepository } from './adapters/supabase-incident.adapter';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  CreateIncidentInput,
  UpdateIncidentInput,
} from './ports/IIncidentRepository';

export type { IncidentRow, EvidenceRow, IncidentType, IncidentSeverity, IncidentStatus } from './ports/IIncidentRepository';

const QUERY_KEY = ['incidents'] as const;

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useIncidents(filters?: {
  type?: IncidentType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
}) {
  return useQuery({
    queryKey: [...QUERY_KEY, filters],
    queryFn:  () => incidentRepository.findAll(filters),
  });
}

export function useIncident(id: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, id],
    enabled:  !!id,
    queryFn:  () => incidentRepository.findById(id!),
  });
}

export function useTripIncidents(tripId: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'trip', tripId],
    enabled:  !!tripId,
    queryFn:  () => incidentRepository.findByTrip(tripId!),
  });
}

export function useIncidentEvidence(incidentId: string | undefined) {
  return useQuery({
    queryKey: ['evidence', incidentId],
    enabled:  !!incidentId,
    queryFn:  () => incidentRepository.findEvidence(incidentId!),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateIncident() {
  const qc      = useQueryClient();
  const supabase = createSupabaseBrowserClient();
  return useMutation({
    mutationFn: async (input: CreateIncidentInput) => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string;
      return incidentRepository.create(input, session?.user?.id ?? '', tenantId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateIncidentInput }) =>
      incidentRepository.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
