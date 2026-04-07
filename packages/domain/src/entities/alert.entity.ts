// Entidad: Alert (Evento significativo generado por el sistema)

export type AlertType =
  | 'off_route'
  | 'long_stop'
  | 'speeding'
  | 'arrived_stop'
  | 'route_completed'
  | 'signal_lost'
  | 'signal_recovered';

export type AlertSeverity = 'info' | 'warning' | 'critical';

// Payloads tipados por tipo de alerta
export interface OffRoutePayload {
  deviation_m: number;
  lat: number;
  lng: number;
}

export interface SpeedingPayload {
  speed_kmh: number;
  limit_kmh: number;
}

export interface LongStopPayload {
  stopped_since: string; // ISO date
  duration_min: number;
  lat: number;
  lng: number;
}

export interface ArrivedStopPayload {
  stop_order: number;
  stop_name: string;
}

export type AlertPayload =
  | OffRoutePayload
  | SpeedingPayload
  | LongStopPayload
  | ArrivedStopPayload
  | Record<string, unknown>;

export interface Alert {
  readonly id: string;
  readonly tenantId: string;
  readonly vehicleId: string;
  readonly routeId?: string;
  readonly locationId?: number;

  readonly alertType: AlertType;
  readonly severity: AlertSeverity;
  readonly payload: AlertPayload;

  readonly isResolved: boolean;
  readonly resolvedAt?: Date;
  readonly resolvedById?: string;
  readonly resolutionNote?: string;

  readonly notificationSent: boolean;
  readonly createdAt: Date;
}

export interface CreateAlertInput {
  tenantId: string;
  vehicleId: string;
  routeId?: string;
  locationId?: number;
  alertType: AlertType;
  severity: AlertSeverity;
  payload: AlertPayload;
}
