// Tokens de inyección de dependencias para los repositorios del dominio.
// Con estos strings, NestJS inyecta la implementación concreta (Supabase)
// donde el módulo declara que necesita la interfaz del puerto.
//
// Ejemplo:
//   @Inject(VEHICLE_REPOSITORY) private repo: IVehicleRepository

export const VEHICLE_REPOSITORY = Symbol('IVehicleRepository');
export const ROUTE_REPOSITORY = Symbol('IRouteRepository');
export const LOCATION_REPOSITORY = Symbol('ILocationRepository');
export const ALERT_REPOSITORY = Symbol('IAlertRepository');
export const NOTIFICATION_SERVICE = Symbol('INotificationService');
export const TENANT_REPOSITORY = Symbol('ITenantRepository');
export const GEOFENCE_REPOSITORY = Symbol('IGeofenceRepository');
