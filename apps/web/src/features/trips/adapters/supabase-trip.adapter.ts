'use client';
// ─── features/trips/adapters/supabase-trip.adapter.ts ────────────────────────
// Hexagonal Adapter — implements ITripRepository using the Supabase browser client.

import type {
  ITripRepository,
  TripRow,
  TripStatus,
  CreateTripInput,
} from '../ports/ITripRepository';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const LIST_SELECT = `
  id, tenant_id, code,
  driver_id, vehicle_id, route_id,
  origin_name, origin_lat, origin_lng,
  dest_name, dest_lat, dest_lng,
  cargo_type, container_numbers, weight_tons,
  scheduled_at, started_at, completed_at,
  estimated_distance_km, estimated_duration_min, actual_distance_km,
  status, cancellation_reason, tracking_token,
  created_by, created_at, updated_at,
  driver:profiles!trips_driver_id_fkey(id, full_name),
  vehicle:vehicles!trips_vehicle_id_fkey(id, plate, alias),
  route:routes!trips_route_id_fkey(id, name)
`.trim();

class SupabaseTripAdapter implements ITripRepository {
  private get db() {
    return createSupabaseBrowserClient();
  }

  async findAll(): Promise<TripRow[]> {
    const { data, error } = await this.db
      .from('trips')
      .select(LIST_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as unknown) as TripRow[];
  }

  async findById(id: string): Promise<TripRow | null> {
    const { data, error } = await this.db
      .from('trips')
      .select(LIST_SELECT)
      .eq('id', id)
      .single();
    if (error) return null;
    return (data as unknown) as TripRow;
  }

  async create(input: CreateTripInput, userId: string, tenantId: string): Promise<string> {
    const { data, error } = await this.db
      .from('trips')
      .insert({
        tenant_id: tenantId,
        created_by: userId,
        driver_id: input.driver_id ?? null,
        vehicle_id: input.vehicle_id ?? null,
        route_id: input.route_id ?? null,
        origin_name: input.origin_name,
        origin_lat: input.origin_lat,
        origin_lng: input.origin_lng,
        dest_name: input.dest_name,
        dest_lat: input.dest_lat,
        dest_lng: input.dest_lng,
        cargo_type: input.cargo_type ?? null,
        container_numbers: input.container_numbers ?? null,
        weight_tons: input.weight_tons ?? null,
        scheduled_at: input.scheduled_at ?? null,
        estimated_distance_km: input.estimated_distance_km ?? null,
        estimated_duration_min: input.estimated_duration_min ?? null,
        status: input.status ?? 'scheduled',
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);
    return (data as { id: string }).id;
  }

  async updateStatus(
    id: string,
    status: TripStatus,
    extra?: { cancellation_reason?: string },
  ): Promise<void> {
    const patch: Record<string, unknown> = { status };

    if (status === 'in_transit') patch.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'at_destination') {
      patch.completed_at = new Date().toISOString();
    }
    if (extra?.cancellation_reason) {
      patch.cancellation_reason = extra.cancellation_reason;
    }

    const { error } = await this.db.from('trips').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async update(id: string, input: Partial<CreateTripInput>): Promise<void> {
    const { error } = await this.db.from('trips').update(input).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('trips').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

export const tripRepository: ITripRepository = new SupabaseTripAdapter();
