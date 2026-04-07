// Entidad: Route (Ruta predefinida con su trazado geoespacial)
import type { Coordinate } from '../value-objects/coordinate.vo.js';

export type RouteStatus = 'draft' | 'active' | 'archived';

export interface RouteStop {
  order: number;
  name: string;
  lat: number;
  lng: number;
  /** Radio de llegada en metros para detectar que el vehículo llegó a la parada */
  radius_m: number;
}

export interface Route {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description?: string;
  readonly status: RouteStatus;

  /** Puntos que forman la línea de la ruta (en orden). Representación en dominio de la LINESTRING. */
  readonly polylinePoints: readonly Coordinate[];

  readonly origin: Coordinate;
  readonly originName: string;
  readonly destination: Coordinate;
  readonly destinationName: string;
  readonly stops: readonly RouteStop[];

  /** Distancia total de la ruta en metros */
  readonly totalDistanceM?: number;
  /** Duración estimada en segundos */
  readonly estimatedDurationS?: number;
  /** Umbral de desvío en metros. Si undefined, hereda del tenant. */
  readonly deviationThresholdM?: number;

  readonly createdBy?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateRouteInput {
  tenantId: string;
  name: string;
  description?: string;
  polylinePoints: Coordinate[];
  origin: Coordinate;
  originName: string;
  destination: Coordinate;
  destinationName: string;
  stops?: RouteStop[];
  totalDistanceM?: number;
  estimatedDurationS?: number;
  deviationThresholdM?: number;
  createdBy?: string;
}
