// Repositorio de Rutas con PostGIS
// La parte más compleja: convierte entre Coordinate[] del dominio y LINESTRING de PostGIS
import { Injectable, NotFoundException } from '@nestjs/common';
import { getServerSupabaseClient } from '@zona-zero/infrastructure';
import type {
  IRouteRepository,
  RouteFilters,
  Route,
  RouteStop,
  CreateRouteInput,
  RouteStatus,
  Coordinate,
} from '@zona-zero/domain';

/** Convierte un array de Coordinates a formato WKT LINESTRING para PostGIS */
function toLineStringWKT(points: Coordinate[]): string {
  const coords = points.map((p) => `${p.lng} ${p.lat}`).join(', ');
  return `LINESTRING(${coords})`;
}

/** Mapea fila de Supabase al tipo Route del dominio */
function mapRow(row: Record<string, unknown>): Route {
  // routes_with_polyline view exposes polyline_coords as [lng, lat][] JSON array
  let polylinePoints: Coordinate[] = [];
  const coords = row.polyline_coords as [number, number][] | null;
  if (Array.isArray(coords)) {
    polylinePoints = coords.map(([lng, lat]) => ({ lat, lng }));
  }

  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    status: row.status as RouteStatus,
    polylinePoints,
    origin: {
      lat: (row.origin_lat as number) ?? 0,
      lng: (row.origin_lng as number) ?? 0,
    },
    originName: row.origin_name as string,
    destination: {
      lat: (row.dest_lat as number) ?? 0,
      lng: (row.dest_lng as number) ?? 0,
    },
    destinationName: row.dest_name as string,
    stops: (row.stops as RouteStop[]) ?? [],
    totalDistanceM: row.total_distance_m as number | undefined,
    estimatedDurationS: row.estimated_duration_s as number | undefined,
    deviationThresholdM: row.deviation_threshold_m as number | undefined,
    createdBy: row.created_by as string | undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

@Injectable()
export class SupabaseRouteRepository implements IRouteRepository {
  private get db() {
    return getServerSupabaseClient();
  }

  async findById(id: string, tenantId: string): Promise<Route | null> {
    const { data, error } = await this.db
      .from('routes_with_polyline')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(error.message);
    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async findMany(filters: RouteFilters): Promise<Route[]> {
    let query = this.db
      .from('routes_with_polyline')
      .select('*')
      .eq('tenant_id', filters.tenantId)
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(input: CreateRouteInput): Promise<Route> {
    // Usamos una función RPC de Supabase para insertar la geometría correctamente
    // ya que el cliente JS no puede construir tipos geography directamente
    const { data, error } = await this.db.rpc('create_route', {
      p_tenant_id: input.tenantId,
      p_name: input.name,
      p_description: input.description ?? null,
      p_polyline_wkt: toLineStringWKT(input.polylinePoints),
      p_origin_wkt: `POINT(${input.origin.lng} ${input.origin.lat})`,
      p_dest_wkt: `POINT(${input.destination.lng} ${input.destination.lat})`,
      p_origin_name: input.originName,
      p_dest_name: input.destinationName,
      p_stops: JSON.stringify(input.stops ?? []),
      p_total_distance_m: input.totalDistanceM ?? null,
      p_estimated_duration_s: input.estimatedDurationS ?? null,
      p_deviation_threshold_m: input.deviationThresholdM ?? null,
      p_created_by: input.createdBy ?? null,
    });

    if (error) throw new Error(error.message);
    // La RPC devuelve el ID; buscamos la ruta completa con geometría
    const created = await this.findById(data as string, input.tenantId);
    if (!created) throw new Error('Error creando la ruta.');
    return created;
  }

  async update(id: string, tenantId: string, input: Partial<CreateRouteInput>): Promise<Route> {
    const updatePayload: Record<string, unknown> = {};
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.stops !== undefined) updatePayload.stops = JSON.stringify(input.stops);
    if (input.totalDistanceM !== undefined) updatePayload.total_distance_m = input.totalDistanceM;
    if (input.estimatedDurationS !== undefined) updatePayload.estimated_duration_s = input.estimatedDurationS;
    if (input.deviationThresholdM !== undefined) updatePayload.deviation_threshold_m = input.deviationThresholdM;

    const { error } = await this.db
      .from('routes')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(error.message);

    const updated = await this.findById(id, tenantId);
    if (!updated) throw new NotFoundException(`Ruta ${id} no encontrada.`);
    return updated;
  }

  async updateStatus(id: string, tenantId: string, status: RouteStatus): Promise<void> {
    const { error } = await this.db
      .from('routes')
      .update({ status })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(error.message);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await this.db
      .from('routes')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(error.message);
  }
}
