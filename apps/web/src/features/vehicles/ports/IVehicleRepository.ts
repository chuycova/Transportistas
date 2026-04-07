// ─── features/vehicles/ports/IVehicleRepository.ts ───────────────────────────
// Hexagonal Port — defines WHAT vehicle data operations are needed.

import type { Tables, TablesInsert, TablesUpdate } from '@zona-zero/infrastructure';

export type Vehicle = Tables<'vehicles'>;
export type VehicleInsert = Omit<TablesInsert<'vehicles'>, 'tenant_id'>;
export type VehicleUpdate = Partial<TablesUpdate<'vehicles'>> & { id: string };

export interface IVehicleRepository {
  findAll(): Promise<Vehicle[]>;
  create(input: VehicleInsert, tenantId: string): Promise<Vehicle>;
  update(input: VehicleUpdate): Promise<Vehicle>;
  delete(id: string): Promise<void>;
}
