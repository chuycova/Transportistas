// ─── features/routes/adapters/supabase-route.adapter.ts ──────────────────────
// Hexagonal Adapter — implements IRouteRepository using the Supabase browser client.

'use client';

import type {
  IRouteRepository,
  RouteRow,
  CreateRouteInput,
  Coordinate,
} from '../ports/IRouteRepository';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const LIST_SELECT =
  'id, tenant_id, name, description, status, origin_name, dest_name, total_distance_m, estimated_duration_s, deviation_threshold_m, risk_level, max_deviation_m, gps_timeout_s, max_speed_kmh, version, vehicle_id, created_at, updated_at, polyline_coords, stops, created_by';

function toLineStringWKT(points: Coordinate[]): string {
  return `LINESTRING(${points.map((p) => `${p.lng} ${p.lat}`).join(', ')})`;
}

class SupabaseRouteAdapter implements IRouteRepository {
  private get db() {
    return createSupabaseBrowserClient();
  }

  async findAll(): Promise<RouteRow[]> {
    const { data, error } = await this.db
      .from('routes_with_polyline')
      .select(LIST_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as RouteRow[];
  }

  async findById(id: string): Promise<RouteRow | null> {
    const { data, error } = await this.db
      .from('routes_with_polyline')
      .select(LIST_SELECT)
      .eq('id', id)
      .single();
    if (error) return null;
    return data as RouteRow;
  }

  async create(input: CreateRouteInput, userId: string, tenantId: string): Promise<void> {
    const origin = input.polylinePoints[0];
    const destination = input.polylinePoints[input.polylinePoints.length - 1];

    const { data: routeId, error } = await this.db.rpc('create_route', {
      p_tenant_id: tenantId,
      p_name: input.name,
      p_description: input.description ?? '',
      p_polyline_wkt: toLineStringWKT(input.polylinePoints),
      p_origin_wkt: `POINT(${origin.lng} ${origin.lat})`,
      p_dest_wkt: `POINT(${destination.lng} ${destination.lat})`,
      p_origin_name: input.originName,
      p_dest_name: input.destinationName,
      p_stops: JSON.stringify([]),
      p_total_distance_m: input.totalDistanceM ?? 0,
      p_estimated_duration_s: input.estimatedDurationS ?? 0,
      p_deviation_threshold_m: input.deviationThresholdM ?? 50,
      p_created_by: userId,
    });
    if (error) throw new Error(error.message);

    if (input.vehicleId && routeId) {
      await this.db
        .from('routes')
        .update({ vehicle_id: input.vehicleId })
        .eq('id', routeId as string);
    }
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const { error } = await this.db.from('routes').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('routes').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

export const routeRepository: IRouteRepository = new SupabaseRouteAdapter();
