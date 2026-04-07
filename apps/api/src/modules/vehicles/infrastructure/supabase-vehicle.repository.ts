// Implementación del IVehicleRepository usando Supabase (PostGIS)
// Esta clase vive en la capa de infraestructura del módulo vehicles.
import { Injectable, NotFoundException } from '@nestjs/common';
import { getServerSupabaseClient } from '@zona-zero/infrastructure';
import type {
  IVehicleRepository,
  VehicleFilters,
  Vehicle,
  CreateVehicleInput,
  UpdateVehicleInput,
  VehicleStatus,
} from '@zona-zero/domain';

// Mapea la fila cruda de Supabase al tipo Vehicle del dominio
function mapRow(row: Record<string, unknown>): Vehicle {
  return {
    id: row['id'] as string,
    tenantId: row['tenant_id'] as string,
    plate: row['plate'] as string,
    alias: row['alias'] as string | undefined,
    brand: row['brand'] as string | undefined,
    model: row['model'] as string | undefined,
    year: row['year'] as number | undefined,
    vehicleType: row['vehicle_type'] as Vehicle['vehicleType'],
    status: row['status'] as VehicleStatus,
    color: row['color'] as string | undefined,
    assignedDriverId: row['assigned_driver_id'] as string | undefined,
    metadata: (row['metadata'] as Record<string, unknown>) ?? {},
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
  };
}

@Injectable()
export class SupabaseVehicleRepository implements IVehicleRepository {
  private get db() {
    return getServerSupabaseClient();
  }

  async findById(id: string, tenantId: string): Promise<Vehicle | null> {
    const { data, error } = await this.db
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code === 'PGRST116') return null; // Not found
    if (error) throw new Error(error.message);
    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async findMany(filters: VehicleFilters): Promise<Vehicle[]> {
    let query = this.db
      .from('vehicles')
      .select('*')
      .eq('tenant_id', filters.tenantId)
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.assignedDriverId) query = query.eq('assigned_driver_id', filters.assignedDriverId);
    if (filters.search) {
      query = query.or(`plate.ilike.%${filters.search}%,alias.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(input: CreateVehicleInput): Promise<Vehicle> {
    const { data, error } = await this.db
      .from('vehicles')
      .insert({
        tenant_id: input.tenantId,
        plate: input.plate,
        alias: input.alias,
        brand: input.brand,
        model: input.model,
        year: input.year,
        vehicle_type: input.vehicleType ?? 'truck',
        color: input.color,
        assigned_driver_id: input.assignedDriverId ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  async update(id: string, tenantId: string, input: UpdateVehicleInput): Promise<Vehicle> {
    const updatePayload: Record<string, unknown> = {};
    if (input.alias !== undefined) updatePayload['alias'] = input.alias;
    if (input.brand !== undefined) updatePayload['brand'] = input.brand;
    if (input.model !== undefined) updatePayload['model'] = input.model;
    if (input.year !== undefined) updatePayload['year'] = input.year;
    if (input.vehicleType !== undefined) updatePayload['vehicle_type'] = input.vehicleType;
    if (input.status !== undefined) updatePayload['status'] = input.status;
    if (input.color !== undefined) updatePayload['color'] = input.color;
    if (input.assignedDriverId !== undefined) updatePayload['assigned_driver_id'] = input.assignedDriverId;

    const { data, error } = await this.db
      .from('vehicles')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException(`Vehículo ${id} no encontrado.`);
    return mapRow(data as Record<string, unknown>);
  }

  async updateStatus(id: string, tenantId: string, status: VehicleStatus): Promise<void> {
    const { error } = await this.db
      .from('vehicles')
      .update({ status })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(error.message);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await this.db
      .from('vehicles')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(error.message);
  }
}
