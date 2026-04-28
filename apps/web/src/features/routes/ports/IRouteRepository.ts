// ─── features/routes/ports/IRouteRepository.ts ───────────────────────────────
// Hexagonal Port — defines route data operations.

export interface RouteStop {
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  /** Campo en la BD: `order` (entero) */
  order: number;
  /** Radio de la geocerca de la parada en metros */
  radius_m?: number;
}

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
  risk_level: 'low' | 'medium' | 'high';
  max_deviation_m: number | null;
  gps_timeout_s: number | null;
  max_speed_kmh: number | null;
  version: number;
  vehicle_id: string | null;
  created_at: string;
  updated_at: string;
  polyline_coords: [number, number][] | null;
  stops: RouteStop[] | null;
  created_by: string | null;
}

export interface Coordinate { lat: number; lng: number; }

export interface CreateRouteInput {
  name: string;
  description?: string;
  polylinePoints: Coordinate[];
  originName: string;
  destinationName: string;
  stops?: RouteStop[];
  totalDistanceM?: number;
  estimatedDurationS?: number;
  deviationThresholdM?: number;
  vehicleId?: string;
}

export interface IRouteRepository {
  findAll(): Promise<RouteRow[]>;
  findById(id: string): Promise<RouteRow | null>;
  create(input: CreateRouteInput, userId: string, tenantId: string): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
  delete(id: string): Promise<void>;
}
