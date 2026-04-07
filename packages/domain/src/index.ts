// Barrel export principal del paquete @zona-zero/domain
// Todo lo que necesiten apps/web, apps/api y apps/mobile
// se importa desde aquí: import { Vehicle, detectDeviation } from '@zona-zero/domain'

// ─── Entities ────────────────────────────────────────────────
export type { Tenant, TenantSettings, TenantPlan, CreateTenantInput } from './entities/tenant.entity.js';
export type { Vehicle, VehicleType, VehicleStatus, CreateVehicleInput, UpdateVehicleInput } from './entities/vehicle.entity.js';
export type { Route, RouteStatus, RouteStop, CreateRouteInput } from './entities/route.entity.js';
export type { Location, CreateLocationInput, LocationWebSocketPayload } from './entities/location.entity.js';
export type {
  Alert, AlertType, AlertSeverity, AlertPayload,
  OffRoutePayload, SpeedingPayload, LongStopPayload, ArrivedStopPayload,
  CreateAlertInput,
} from './entities/alert.entity.js';

// ─── Value Objects ────────────────────────────────────────────
export type { Coordinate } from './value-objects/coordinate.vo.js';
export {
  createCoordinate,
  fromGeoJson,
  toGeoJson,
  coordinatesEqual,
  haversineDistanceM,
  crossTrackDistanceM,
} from './value-objects/coordinate.vo.js';

// ─── Ports ───────────────────────────────────────────────────
export type { IVehicleRepository, VehicleFilters } from './ports/vehicle.repository.port.js';
export type { IRouteRepository, RouteFilters } from './ports/route.repository.port.js';
export type { ILocationRepository, LocationHistoryFilters, LatestLocationResult } from './ports/location.repository.port.js';
export type { IAlertRepository, AlertFilters } from './ports/alert.repository.port.js';
export type { INotificationService, PushNotificationPayload } from './ports/notification.service.port.js';

// ─── Use Cases ───────────────────────────────────────────────
export { detectDeviation } from './use-cases/detect-deviation.use-case.js';
export type { DeviationInput, DeviationResult, DetectDeviationDeps } from './use-cases/detect-deviation.use-case.js';
