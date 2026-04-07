// Puerto: ILocationRepository

import type { Location, CreateLocationInput } from '../entities/location.entity.js';

export interface LocationHistoryFilters {
  vehicleId: string;
  tenantId: string;
  from: Date;
  to: Date;
}

export interface LatestLocationResult {
  vehicleId: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  headingDeg?: number;
  isOffRoute: boolean;
  recordedAt: Date;
}

export interface ILocationRepository {
  /** Insertar un solo ping GPS */
  create(input: CreateLocationInput): Promise<Location>;

  /** Insertar múltiples pings GPS de golpe (bulk sync offline) */
  createMany(inputs: CreateLocationInput[]): Promise<void>;

  /** Obtener la última posición conocida de todos los vehículos activos de un tenant */
  findLatestByTenant(tenantId: string): Promise<LatestLocationResult[]>;

  /** Obtener historial de posiciones para replay de una ruta */
  findHistory(filters: LocationHistoryFilters): Promise<Location[]>;
}
