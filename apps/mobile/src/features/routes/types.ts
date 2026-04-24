export interface RouteItem {
  id: string;
  name: string;
  origin_name: string;
  dest_name: string;
  status: 'draft' | 'active' | 'archived';
  total_distance_m: number | null;
  estimated_duration_s: number | null;
  deviation_threshold_m: number | null;
  waypoints: Array<{ lat: number; lng: number }>;
  stops: Array<{ name: string; address: string | null; lat: number; lng: number; order: number }>;
}

export interface DriverAssignment {
  driver: { id: string; full_name: string; role: string };
  vehicle: {
    id: string;
    plate: string;
    alias: string | null;
    color: string | null;
    vehicle_type: string;
  } | null;
  activeRoute: RouteItem | null;
  routes: RouteItem[];
}
