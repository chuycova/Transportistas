// ─── features/routes/ports/IRouteRepository.ts ───────────────────────────────
// Hexagonal Port — defines route data operations.

export interface RouteRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: string;
  origin_name: string;
  dest_name: string;
  total_distance_m: number | null;
  estimated_duration_s: number | null;
  deviation_threshold_m: number | null;
  vehicle_id: string | null;
  created_at: string;
  updated_at: string;
  polyline_coords: [number, number][] | null;
}

export interface Coordinate { lat: number; lng: number; }

export interface CreateRouteInput {
  name: string;
  description?: string;
  polylinePoints: Coordinate[];
  originName: string;
  destinationName: string;
  totalDistanceM?: number;
  estimatedDurationS?: number;
  deviationThresholdM?: number;
  vehicleId?: string;
}

export interface IRouteRepository {
  findAll(): Promise<RouteRow[]>;
  create(input: CreateRouteInput, userId: string, tenantId: string): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
  delete(id: string): Promise<void>;
}
