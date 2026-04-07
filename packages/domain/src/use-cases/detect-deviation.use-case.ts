// Use Case: detectDeviation
// Determina si un vehículo se ha desviado de su ruta asignada.
// Este es el corazón del sistema. Se llama en el backend al recibir cada ping GPS.
//
// Principio SOLID aplicado:
// - SRP: Solo hace una cosa (calcular desvío)
// - DIP: Depende de abstracciones (IRouteRepository, IAlertRepository, INotificationService)
// - OCP: Para cambiar la lógica de desvío, solo se modifica este use case

import type { Coordinate, crossTrackDistanceM as CrossTrackFn } from '../value-objects/coordinate.vo.js';
import { crossTrackDistanceM } from '../value-objects/coordinate.vo.js';
import type { IRouteRepository } from '../ports/route.repository.port.js';
import type { IAlertRepository } from '../ports/alert.repository.port.js';
import type { IVehicleRepository } from '../ports/vehicle.repository.port.js';
import type { INotificationService } from '../ports/notification.service.port.js';
import type { CreateLocationInput } from '../entities/location.entity.js';

export interface DeviationInput {
  vehicleId: string;
  tenantId: string;
  routeId: string;
  coordinate: Coordinate;
  /** Umbral del tenant en metros. El use case no lee la DB por esto (Single Responsibility). */
  thresholdM: number;
}

export interface DeviationResult {
  isOffRoute: boolean;
  deviationM: number;
  alertCreated: boolean;
}

export interface DetectDeviationDeps {
  routeRepository: IRouteRepository;
  alertRepository: IAlertRepository;
  vehicleRepository: IVehicleRepository;
  notificationService: INotificationService;
  /** FCM token del conductor asignado al vehículo (se resuelve externamente) */
  driverFcmToken?: string;
}

/**
 * Detecta si un vehículo se ha desviado de su ruta.
 *
 * Algoritmo:
 * 1. Obtiene los puntos de la polyline de la ruta desde el repositorio.
 * 2. Calcula la distancia Cross-Track (mínima distancia al segmento más cercano).
 * 3. Compara con el umbral del tenant.
 * 4. Si hay desvío, crea una alerta y envía push notification.
 * 5. Retorna el resultado para que el caller lo guarde en la tabla locations.
 *
 * Nota: La versión autoritativa usa ST_DWithin de PostGIS en la capa de infraestructura.
 * Este use case usa la implementación Haversine del dominio para ser testeable sin DB.
 */
export async function detectDeviation(
  input: DeviationInput,
  deps: DetectDeviationDeps,
): Promise<DeviationResult> {
  const route = await deps.routeRepository.findById(input.routeId, input.tenantId);

  if (!route) {
    // Si no hay ruta, no podemos calcular desvío. No es error del vehículo.
    return { isOffRoute: false, deviationM: 0, alertCreated: false };
  }

  const deviationM = crossTrackDistanceM(input.coordinate, route.polylinePoints);
  const isOffRoute = deviationM > input.thresholdM;

  if (!isOffRoute) {
    return { isOffRoute: false, deviationM, alertCreated: false };
  }

  // Crear alerta de desvío
  const alert = await deps.alertRepository.create({
    tenantId: input.tenantId,
    vehicleId: input.vehicleId,
    routeId: input.routeId,
    alertType: 'off_route',
    severity: deviationM > input.thresholdM * 3 ? 'critical' : 'warning',
    payload: {
      deviation_m: Math.round(deviationM),
      lat: input.coordinate.lat,
      lng: input.coordinate.lng,
    },
  });

  // Enviar notificación push al conductor (si tiene FCM token)
  let notificationSent = false;
  if (deps.driverFcmToken) {
    notificationSent = await deps.notificationService.sendToDevice(
      deps.driverFcmToken,
      {
        title: '⚠️ Desvío detectado',
        body: `Tu vehículo se desvió ${Math.round(deviationM)}m de la ruta asignada.`,
        data: {
          alertId: alert.id,
          vehicleId: input.vehicleId,
          routeId: input.routeId,
        },
      },
    );

    if (notificationSent) {
      await deps.alertRepository.markNotificationSent(alert.id);
    }
  }

  // También notificar al panel de operadores por topic del tenant
  await deps.notificationService.sendToTopic(input.tenantId, {
    title: '🚨 Alerta de desvío',
    body: `Vehículo ID ${input.vehicleId} se desvió ${Math.round(deviationM)}m de la ruta.`,
    data: { alertId: alert.id, type: 'off_route' },
  });

  return { isOffRoute: true, deviationM, alertCreated: true };
}
