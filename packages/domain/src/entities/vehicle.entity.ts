// Entidad: Vehicle (Unidad de la flotilla)

export type VehicleType = 'car' | 'truck' | 'van' | 'motorcycle' | 'other';
export type VehicleStatus = 'active' | 'inactive' | 'maintenance' | 'off_route';

export interface Vehicle {
  readonly id: string;
  readonly tenantId: string;
  readonly plate: string;
  readonly alias?: string;
  readonly brand?: string;
  readonly model?: string;
  readonly year?: number;
  readonly vehicleType: VehicleType;
  readonly status: VehicleStatus;
  /** Color HEX del marcador en el mapa, ej: "#E84040" */
  readonly color?: string;
  readonly assignedDriverId?: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateVehicleInput {
  tenantId: string;
  plate: string;
  alias?: string;
  brand?: string;
  model?: string;
  year?: number;
  vehicleType?: VehicleType;
  color?: string;
  assignedDriverId?: string;
}

export interface UpdateVehicleInput {
  alias?: string;
  brand?: string;
  model?: string;
  year?: number;
  vehicleType?: VehicleType;
  status?: VehicleStatus;
  color?: string;
  assignedDriverId?: string | null;
}
