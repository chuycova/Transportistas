'use client';
// ─── features/vehicles/use-vehicle-enrichment.ts ─────────────────────────────
// Hooks para documentos y registros de mantenimiento de vehículos.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const db = () => createSupabaseBrowserClient();

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type VehicleDocType =
  | 'tarjeta_circulacion'
  | 'seguro'
  | 'verificacion'
  | 'revision_fisica'
  | 'other';

export type DocStatus = 'pending' | 'valid' | 'expired' | 'rejected';

export interface VehicleDocument {
  id: string;
  vehicle_id: string;
  doc_type: VehicleDocType;
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

export type MaintenanceType = 'preventive' | 'corrective' | 'inspection' | 'other';

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_type: MaintenanceType;
  description: string;
  workshop_name: string | null;
  cost_mxn: number | null;
  mileage_km_at_service: number | null;
  service_date: string;
  next_service_date: string | null;
  next_service_km: number | null;
  file_url: string | null;
  created_at: string;
}

export interface VehicleEnrichedFields {
  vin: string | null;
  cargo_capacity_tons: number | null;
  insurance_policy: string | null;
  insurance_expiry: string | null;
  mileage_km: number;
}

// ─── Vehicle Documents ────────────────────────────────────────────────────────

export function useVehicleDocuments(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ['vehicle_documents', vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('vehicle_documents')
        .select('id, vehicle_id, doc_type, doc_number, title, status, rejection_reason, issued_at, expires_at, validated_at, file_url, created_at')
        .eq('vehicle_id', vehicleId!)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data as VehicleDocument[];
    },
  });
}

export function useCreateVehicleDocument() {
  const qc = useQueryClient();
  const supabase = db();
  return useMutation({
    mutationFn: async (input: {
      vehicleId: string;
      doc_type: VehicleDocType;
      title: string;
      doc_number?: string;
      issued_at?: string;
      expires_at?: string;
      file_url?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string;
      const { error } = await supabase.from('vehicle_documents').insert({
        tenant_id: tenantId,
        vehicle_id: input.vehicleId,
        doc_type: input.doc_type,
        title: input.title,
        doc_number: input.doc_number ?? null,
        issued_at: input.issued_at ?? null,
        expires_at: input.expires_at ?? null,
        file_url: input.file_url ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['vehicle_documents', vars.vehicleId] }),
  });
}

export function useValidateVehicleDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vehicleId, status, rejection_reason }: {
      id: string;
      vehicleId: string;
      status: DocStatus;
      rejection_reason?: string;
    }) => {
      const { error } = await db().from('vehicle_documents').update({
        status,
        rejection_reason: rejection_reason ?? null,
        validated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['vehicle_documents', vars.vehicleId] }),
  });
}

export function useDeleteVehicleDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vehicleId }: { id: string; vehicleId: string }) => {
      const { error } = await db().from('vehicle_documents').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['vehicle_documents', vars.vehicleId] }),
  });
}

// ─── Maintenance Records ──────────────────────────────────────────────────────

export function useMaintenanceRecords(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance_records', vehicleId],
    enabled: !!vehicleId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('maintenance_records')
        .select('id, vehicle_id, maintenance_type, description, workshop_name, cost_mxn, mileage_km_at_service, service_date, next_service_date, next_service_km, file_url, created_at')
        .eq('vehicle_id', vehicleId!)
        .order('service_date', { ascending: false });
      if (error) throw new Error(error.message);
      return data as MaintenanceRecord[];
    },
  });
}

export function useCreateMaintenanceRecord() {
  const qc = useQueryClient();
  const supabase = db();
  return useMutation({
    mutationFn: async (input: {
      vehicleId: string;
      maintenance_type: MaintenanceType;
      description: string;
      service_date: string;
      workshop_name?: string;
      cost_mxn?: number;
      mileage_km_at_service?: number;
      next_service_date?: string;
      next_service_km?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string;
      const userId   = session?.user?.id;
      const { error } = await supabase.from('maintenance_records').insert({
        tenant_id: tenantId,
        vehicle_id: input.vehicleId,
        maintenance_type: input.maintenance_type,
        description: input.description,
        service_date: input.service_date,
        workshop_name: input.workshop_name ?? null,
        cost_mxn: input.cost_mxn ?? null,
        mileage_km_at_service: input.mileage_km_at_service ?? null,
        next_service_date: input.next_service_date ?? null,
        next_service_km: input.next_service_km ?? null,
        performed_by: userId ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['maintenance_records', vars.vehicleId] }),
  });
}

export function useDeleteMaintenanceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, vehicleId }: { id: string; vehicleId: string }) => {
      const { error } = await db().from('maintenance_records').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ['maintenance_records', vars.vehicleId] }),
  });
}

// ─── Vehicle enriched fields ──────────────────────────────────────────────────

export function useUpdateVehicleFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fields }: { id: string; fields: Partial<VehicleEnrichedFields> }) => {
      const { error } = await db().from('vehicles').update(fields).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });
}
