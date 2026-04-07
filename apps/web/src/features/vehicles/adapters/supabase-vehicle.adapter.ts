// ─── features/vehicles/adapters/supabase-vehicle.adapter.ts ──────────────────
// Hexagonal Adapter — implements IVehicleRepository using the Supabase browser client.

'use client';

import type { IVehicleRepository, Vehicle, VehicleInsert, VehicleUpdate } from '../ports/IVehicleRepository';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

class SupabaseVehicleAdapter implements IVehicleRepository {
  private get db() {
    return createSupabaseBrowserClient();
  }

  async findAll(): Promise<Vehicle[]> {
    const { data, error } = await this.db
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as Vehicle[];
  }

  async create(input: VehicleInsert, tenantId: string): Promise<Vehicle> {
    const { data, error } = await this.db
      .from('vehicles')
      .insert({ ...input, tenant_id: tenantId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Vehicle;
  }

  async update({ id, ...patch }: VehicleUpdate): Promise<Vehicle> {
    const { data, error } = await this.db
      .from('vehicles')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Vehicle;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('vehicles').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

export const vehicleRepository: IVehicleRepository = new SupabaseVehicleAdapter();
