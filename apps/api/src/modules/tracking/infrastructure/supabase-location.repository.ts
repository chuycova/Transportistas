// Repositorio de ubicaciones con bulk insert optimizado
import { Injectable } from '@nestjs/common';
import { getServerSupabaseClient } from '@zona-zero/infrastructure';
import type {
  ILocationRepository,
  Location,
  CreateLocationInput,
  LocationHistoryFilters,
  LatestLocationResult,
} from '@zona-zero/domain';
import { mapBaseFields } from '../../../infrastructure/supabase.helpers';

function mapRow(row: Record<string, unknown>): Location {
  return {
    id: row['id'] as number,      // number, no string — no va en mapBaseFields
    ...mapBaseFields(row),
    vehicleId: row['vehicle_id'] as string,
    routeId: row['route_id'] as string | undefined,
    coordinate: {
      lat: row['lat'] as number,
      lng: row['lng'] as number,
    },
    speedKmh: row['speed_kmh'] as number | undefined,
    headingDeg: row['heading_deg'] as number | undefined,
    accuracyM: row['accuracy_m'] as number | undefined,
    isOffRoute: (row['is_off_route'] as boolean) ?? false,
    deviationM: row['deviation_m'] as number | undefined,
    recordedAt: new Date(row['recorded_at'] as string),
    receivedAt: new Date(row['received_at'] as string),
  };
}

@Injectable()
export class SupabaseLocationRepository implements ILocationRepository {
  private get db() {
    return getServerSupabaseClient();
  }

  async create(input: CreateLocationInput): Promise<Location> {
    const { data, error } = await this.db.rpc('insert_location', {
      p_tenant_id: input.tenantId,
      p_vehicle_id: input.vehicleId,
      p_route_id: input.routeId ?? null,
      p_lat: input.coordinate.lat,
      p_lng: input.coordinate.lng,
      p_speed_kmh: input.speedKmh ?? null,
      p_heading_deg: input.headingDeg ?? null,
      p_accuracy_m: input.accuracyM ?? null,
      p_is_off_route: input.isOffRoute ?? false,
      p_deviation_m: input.deviationM ?? null,
      p_recorded_at: input.recordedAt.toISOString(),
    });

    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  /** Bulk insert para sincronización offline. Inserta todo en una transacción. */
  async createMany(inputs: CreateLocationInput[]): Promise<void> {
    if (inputs.length === 0) return;

    const rows = inputs.map((input) => ({
      tenant_id: input.tenantId,
      vehicle_id: input.vehicleId,
      route_id: input.routeId ?? null,
      // Supabase no acepta geography directamente; usamos la función de inserción
      // para locations individuales, pero para bulk usamos insert directo con RPC
      point: `POINT(${input.coordinate.lng} ${input.coordinate.lat})`,
      speed_kmh: input.speedKmh ?? null,
      heading_deg: input.headingDeg ?? null,
      accuracy_m: input.accuracyM ?? null,
      is_off_route: input.isOffRoute ?? false,
      deviation_m: input.deviationM ?? null,
      recorded_at: input.recordedAt.toISOString(),
    }));

    const { error } = await this.db.rpc('bulk_insert_locations', {
      p_locations: JSON.stringify(rows),
    });

    if (error) throw new Error(`Bulk insert error: ${error.message}`);
  }

  async findLatestByTenant(tenantId: string): Promise<LatestLocationResult[]> {
    const { data, error } = await this.db.rpc('get_latest_locations', {
      p_tenant_id: tenantId,
    });

    if (error) throw new Error(error.message);
    return (data as Array<Record<string, unknown>>).map((row) => ({
      vehicleId: row['vehicle_id'] as string,
      lat: row['lat'] as number,
      lng: row['lng'] as number,
      speedKmh: row['speed_kmh'] as number | undefined,
      headingDeg: row['heading_deg'] as number | undefined,
      isOffRoute: (row['is_off_route'] as boolean) ?? false,
      recordedAt: new Date(row['recorded_at'] as string),
    }));
  }

  async findHistory(filters: LocationHistoryFilters): Promise<Location[]> {
    const { data, error } = await this.db.rpc('get_vehicle_track', {
      p_vehicle_id: filters.vehicleId,
      p_from: filters.from.toISOString(),
      p_to: filters.to.toISOString(),
    });

    if (error) throw new Error(error.message);
    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: 0,
      tenantId: filters.tenantId,
      vehicleId: filters.vehicleId,
      coordinate: { lat: row['lat'] as number, lng: row['lng'] as number },
      speedKmh: row['speed_kmh'] as number | undefined,
      headingDeg: row['heading_deg'] as number | undefined,
      isOffRoute: (row['is_off_route'] as boolean) ?? false,
      recordedAt: new Date(row['recorded_at'] as string),
      receivedAt: new Date(row['recorded_at'] as string),
    }));
  }
}
