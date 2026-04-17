// ─── features/trips/ports/ITripRepository.ts ─────────────────────────────────
// Hexagonal Port — defines trip data operations.

export type TripStatus =
  | 'draft'
  | 'scheduled'
  | 'confirmed'
  | 'in_transit'
  | 'at_destination'
  | 'completed'
  | 'closed'
  | 'cancelled';

export interface TripRow {
  id: string;
  tenant_id: string;
  code: string;

  driver_id: string | null;
  vehicle_id: string | null;
  route_id: string | null;

  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_name: string;
  dest_lat: number;
  dest_lng: number;

  cargo_type: string | null;
  container_numbers: string | null;
  weight_tons: number | null;

  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;

  estimated_distance_km: number | null;
  estimated_duration_min: number | null;
  actual_distance_km: number | null;

  status: TripStatus;
  cancellation_reason: string | null;
  tracking_token: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields (via select with FK relations)
  driver?: { id: string; full_name: string } | null;
  vehicle?: { id: string; plate: string; alias: string | null } | null;
  route?: { id: string; name: string } | null;
}

export interface CreateTripInput {
  driver_id?: string;
  vehicle_id?: string;
  route_id?: string;

  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  dest_name: string;
  dest_lat: number;
  dest_lng: number;

  cargo_type?: string;
  container_numbers?: string;
  weight_tons?: number;

  scheduled_at?: string;
  estimated_distance_km?: number;
  estimated_duration_min?: number;
  status?: TripStatus;
}

export interface ITripRepository {
  findAll(): Promise<TripRow[]>;
  findById(id: string): Promise<TripRow | null>;
  create(input: CreateTripInput, userId: string, tenantId: string): Promise<string>;
  updateStatus(id: string, status: TripStatus, extra?: { cancellation_reason?: string }): Promise<void>;
  update(id: string, input: Partial<CreateTripInput>): Promise<void>;
  delete(id: string): Promise<void>;
}
