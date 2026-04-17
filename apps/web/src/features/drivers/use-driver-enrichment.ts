'use client';
// ─── features/drivers/use-driver-enrichment.ts ───────────────────────────────
// Hooks para documentos, contactos de emergencia y campos enriquecidos del conductor.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const db = () => createSupabaseBrowserClient();

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DocStatus = 'pending' | 'valid' | 'expired' | 'rejected';
export type DocType   = 'ine' | 'license' | 'proof_of_address' | 'medical_cert' | 'other';

export interface DriverDocument {
  id: string;
  driver_id: string;
  doc_type: DocType;
  doc_number: string | null;
  title: string;
  status: DocStatus;
  rejection_reason: string | null;
  issued_at: string | null;
  expires_at: string | null;
  validated_at: string | null;
  file_url: string | null;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  driver_id: string;
  full_name: string;
  relationship: string | null;
  phone: string;
  phone_alt: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface DriverFields {
  curp: string | null;
  rfc: string | null;
  license_number: string | null;
  license_category: string | null;
  license_expiry: string | null;
  avg_rating: number | null;
  total_trips: number;
  on_time_pct: number | null;
  risk_level: 'low' | 'medium' | 'high';
}

// ─── Documents ────────────────────────────────────────────────────────────────

export function useDriverDocuments(driverId: string | undefined) {
  return useQuery({
    queryKey: ['driver_documents', driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('driver_documents')
        .select('id, driver_id, doc_type, doc_number, title, status, rejection_reason, issued_at, expires_at, validated_at, file_url, created_at')
        .eq('driver_id', driverId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data as DriverDocument[];
    },
  });
}

export function useCreateDriverDocument() {
  const qc = useQueryClient();
  const supabase = db();
  return useMutation({
    mutationFn: async (input: {
      driverId: string;
      doc_type: DocType;
      title: string;
      doc_number?: string;
      issued_at?: string;
      expires_at?: string;
      file_url?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string;
      const { error } = await supabase.from('driver_documents').insert({
        tenant_id: tenantId,
        driver_id: input.driverId,
        doc_type: input.doc_type,
        title: input.title,
        doc_number: input.doc_number ?? null,
        issued_at: input.issued_at ?? null,
        expires_at: input.expires_at ?? null,
        file_url: input.file_url ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['driver_documents', vars.driverId] }),
  });
}

export function useValidateDriverDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, driverId, rejection_reason }: {
      id: string;
      driverId: string;
      status: DocStatus;
      rejection_reason?: string;
    }) => {
      const { error } = await db().from('driver_documents').update({
        status,
        rejection_reason: rejection_reason ?? null,
        validated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['driver_documents', vars.driverId] }),
  });
}

export function useDeleteDriverDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, driverId }: { id: string; driverId: string }) => {
      const { error } = await db().from('driver_documents').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['driver_documents', vars.driverId] }),
  });
}

// ─── Emergency contacts ───────────────────────────────────────────────────────

export function useEmergencyContacts(driverId: string | undefined) {
  return useQuery({
    queryKey: ['emergency_contacts', driverId],
    enabled: !!driverId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('emergency_contacts')
        .select('id, driver_id, full_name, relationship, phone, phone_alt, is_primary, created_at')
        .eq('driver_id', driverId!)
        .order('is_primary', { ascending: false });
      if (error) throw new Error(error.message);
      return data as EmergencyContact[];
    },
  });
}

export function useCreateEmergencyContact() {
  const qc = useQueryClient();
  const supabase = db();
  return useMutation({
    mutationFn: async (input: {
      driverId: string;
      full_name: string;
      phone: string;
      relationship?: string;
      phone_alt?: string;
      is_primary?: boolean;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string;
      const { error } = await supabase.from('emergency_contacts').insert({
        tenant_id: tenantId,
        driver_id: input.driverId,
        full_name: input.full_name,
        phone: input.phone,
        relationship: input.relationship ?? null,
        phone_alt: input.phone_alt ?? null,
        is_primary: input.is_primary ?? false,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['emergency_contacts', vars.driverId] }),
  });
}

export function useDeleteEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, driverId }: { id: string; driverId: string }) => {
      const { error } = await db().from('emergency_contacts').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['emergency_contacts', vars.driverId] }),
  });
}

// ─── Driver enriched fields (curp, rfc, licencia, métricas) ──────────────────

export function useUpdateDriverFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<DriverFields> }) => {
      const { error } = await db().from('profiles').update(fields).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}
