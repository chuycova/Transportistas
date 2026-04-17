// ─── features/incidents/ports/IIncidentRepository.ts ─────────────────────────
// Puerto hexagonal — define el contrato del repositorio de incidentes.

export type IncidentType =
  | 'mechanical'
  | 'route_deviation'
  | 'accident'
  | 'weather'
  | 'cargo'
  | 'other';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus   = 'open' | 'in_review' | 'resolved' | 'closed';

export interface IncidentRow {
  id:          string;
  tenant_id:   string;
  trip_id:     string | null;
  vehicle_id:  string | null;
  driver_id:   string;
  code:        string;
  type:        IncidentType;
  severity:    IncidentSeverity;
  status:      IncidentStatus;
  description: string | null;
  lat:         number | null;
  lng:         number | null;
  resolution:  string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at:  string;
  updated_at:  string;
  // Joined
  vehicle_plate?:  string | null;
  driver_email?:   string | null;
  evidence_count?: number;
}

export interface EvidenceRow {
  id:          string;
  tenant_id:   string;
  incident_id: string | null;
  trip_id:     string | null;
  driver_id:   string;
  file_url:    string;
  file_path:   string;
  file_name:   string;
  media_type:  string;
  uploaded_at: string;
}

export interface CreateIncidentInput {
  trip_id?:    string;
  vehicle_id?: string;
  type:        IncidentType;
  severity:    IncidentSeverity;
  description?: string;
  lat?:        number;
  lng?:        number;
}

export interface UpdateIncidentInput {
  status?:     IncidentStatus;
  severity?:   IncidentSeverity;
  resolution?: string;
}

export interface IIncidentRepository {
  findAll(filters?: { type?: IncidentType; severity?: IncidentSeverity; status?: IncidentStatus }): Promise<IncidentRow[]>;
  findById(id: string): Promise<IncidentRow | null>;
  findByTrip(tripId: string): Promise<IncidentRow[]>;
  create(input: CreateIncidentInput, driverId: string, tenantId: string): Promise<IncidentRow>;
  update(id: string, input: UpdateIncidentInput): Promise<IncidentRow>;

  findEvidence(incidentId: string): Promise<EvidenceRow[]>;
}
