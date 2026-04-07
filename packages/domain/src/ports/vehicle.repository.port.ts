// Puerto: IVehicleRepository
// Define el contrato que debe cumplir cualquier implementación
// (Supabase, en memoria para tests, Mock, etc.)
// El dominio NUNCA importa Supabase directamente.

import type { Vehicle, CreateVehicleInput, UpdateVehicleInput, VehicleStatus } from '../entities/vehicle.entity.js';

export interface VehicleFilters {
  tenantId: string;
  status?: VehicleStatus;
  assignedDriverId?: string;
  search?: string; // Búsqueda por placa o alias
}

export interface IVehicleRepository {
  /** Obtener vehículo por ID (dentro del tenant) */
  findById(id: string, tenantId: string): Promise<Vehicle | null>;

  /** Listar vehículos con filtros opcionales */
  findMany(filters: VehicleFilters): Promise<Vehicle[]>;

  /** Crear un nuevo vehículo */
  create(input: CreateVehicleInput): Promise<Vehicle>;

  /** Actualizar datos de un vehículo */
  update(id: string, tenantId: string, input: UpdateVehicleInput): Promise<Vehicle>;

  /** Cambiar el estado de un vehículo (active, off_route, etc.) */
  updateStatus(id: string, tenantId: string, status: VehicleStatus): Promise<void>;

  /** Eliminar vehículo (soft delete o real según implementación) */
  delete(id: string, tenantId: string): Promise<void>;
}
