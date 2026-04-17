'use client';
// ─── features/incidents/adapters/supabase-incident.adapter.ts ────────────────

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  IIncidentRepository,
  IncidentRow,
  EvidenceRow,
  CreateIncidentInput,
  UpdateIncidentInput,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
} from '../ports/IIncidentRepository';

const LIST_SELECT = `
  id, tenant_id, trip_id, vehicle_id, driver_id, code, type, severity, status,
  description, lat, lng, resolution, resolved_at, resolved_by, created_at, updated_at,
  vehicles(plate),
  evidence(id)
`.trim();

function mapRow(raw: Record<string, unknown>): IncidentRow {
  const vehicles = raw['vehicles'] as { plate: string } | null;
  const evidence = raw['evidence'] as unknown[] | null;
  return {
    ...(raw as unknown as IncidentRow),
    vehicle_plate:  vehicles?.plate ?? null,
    driver_email:   null,
    evidence_count: evidence?.length ?? 0,
  };
}

class SupabaseIncidentRepository implements IIncidentRepository {
  private get db() { return createSupabaseBrowserClient(); }

  async findAll(filters?: { type?: IncidentType; severity?: IncidentSeverity; status?: IncidentStatus }): Promise<IncidentRow[]> {
    let q = this.db.from('incidents').select(LIST_SELECT).order('created_at', { ascending: false });
    if (filters?.type)     q = q.eq('type', filters.type);
    if (filters?.severity) q = q.eq('severity', filters.severity);
    if (filters?.status)   q = q.eq('status', filters.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapRow);
  }

  async findById(id: string): Promise<IncidentRow | null> {
    const { data, error } = await this.db
      .from('incidents')
      .select(LIST_SELECT)
      .eq('id', id)
      .single();
    if (error) return null;
    return mapRow(data as unknown as Record<string, unknown>);
  }

  async findByTrip(tripId: string): Promise<IncidentRow[]> {
    const { data, error } = await this.db
      .from('incidents')
      .select(LIST_SELECT)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapRow);
  }

  async create(input: CreateIncidentInput, driverId: string, tenantId: string): Promise<IncidentRow> {
    // Generate code client-side: call DB function via rpc
    const { data: code, error: codeErr } = await this.db.rpc('generate_incident_code');
    if (codeErr) throw new Error(codeErr.message);

    const { data, error } = await this.db
      .from('incidents')
      .insert({
        tenant_id:   tenantId,
        driver_id:   driverId,
        code:        code as string,
        trip_id:     input.trip_id    ?? null,
        vehicle_id:  input.vehicle_id ?? null,
        type:        input.type,
        severity:    input.severity,
        description: input.description ?? null,
        lat:         input.lat ?? null,
        lng:         input.lng ?? null,
      })
      .select(LIST_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as unknown as Record<string, unknown>);
  }

  async update(id: string, input: UpdateIncidentInput): Promise<IncidentRow> {
    const patch: Record<string, unknown> = { ...input };
    if (input.status === 'resolved' || input.status === 'closed') {
      patch['resolved_at'] = new Date().toISOString();
    }
    const { data, error } = await this.db
      .from('incidents')
      .update(patch)
      .eq('id', id)
      .select(LIST_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as unknown as Record<string, unknown>);
  }

  async findEvidence(incidentId: string): Promise<EvidenceRow[]> {
    const { data, error } = await this.db
      .from('evidence')
      .select('*')
      .eq('incident_id', incidentId)
      .order('uploaded_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as EvidenceRow[];
  }
}

export const incidentRepository: IIncidentRepository = new SupabaseIncidentRepository();
