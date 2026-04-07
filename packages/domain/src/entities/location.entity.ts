// Entidad: Location (Ping GPS de un vehículo en un instante)
import type { Coordinate } from '../value-objects/coordinate.vo.js';

export interface Location {
  readonly id: number; // bigserial
  readonly tenantId: string;
  readonly vehicleId: string;
  readonly routeId?: string;

  readonly coordinate: Coordinate;

  readonly speedKmh?: number;
  readonly headingDeg?: number;
  /** Precisión del GPS reportada por el dispositivo en metros */
  readonly accuracyM?: number;

  readonly isOffRoute: boolean;
  /** Metros de desvío calculados al recibir este ping */
  readonly deviationM?: number;

  /** Timestamp del DISPOSITIVO móvil (puede llegar con delay en modo offline) */
  readonly recordedAt: Date;
  /** Timestamp de llegada al servidor */
  readonly receivedAt: Date;
}

export interface CreateLocationInput {
  tenantId: string;
  vehicleId: string;
  routeId?: string;
  coordinate: Coordinate;
  speedKmh?: number;
  headingDeg?: number;
  accuracyM?: number;
  isOffRoute?: boolean;
  deviationM?: number;
  recordedAt: Date;
}

/** Payload mínimo para WebSocket (optimizado para red) */
export interface LocationWebSocketPayload {
  /** ID corto del vehículo */
  v: string;
  lat: number;
  lng: number;
  /** Speed en km/h */
  s?: number;
  /** Heading 0-360° */
  h?: number;
  /** Off route flag */
  off?: boolean;
}
