// Use Case: ProcessLocation  (refactorizado con batch buffer + road snap)
// Orquesta todo el flujo cuando llega un ping GPS del móvil:
//   1. El ping entra al PingBatchBufferService (no bloquea)
//   2. Cuando el buffer se vacía → road snap → detectDeviation → persist → broadcast

import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { detectDeviation } from '@zona-zero/domain';
import type {
  CreateLocationInput,
  LocationWebSocketPayload,
  Coordinate,
} from '@zona-zero/domain';
import {
  LOCATION_REPOSITORY,
  ROUTE_REPOSITORY,
  ALERT_REPOSITORY,
  VEHICLE_REPOSITORY,
  NOTIFICATION_SERVICE,
  GEOFENCE_REPOSITORY,
} from '../../../common/tokens';
import type {
  ILocationRepository,
  IRouteRepository,
  IAlertRepository,
  IVehicleRepository,
  INotificationService,
} from '@zona-zero/domain';
import type { IGeofenceRepository, Geofence } from '../../geofences/geofence.types';
import { TrackingGateway } from '../infrastructure/tracking.gateway';
import { getServerSupabaseClient } from '@zona-zero/infrastructure';
import { PingBatchBufferService, type FlushedPing } from './ping-batch-buffer.service';

export interface IncomingPingDto {
  vehicleId: string;
  tenantId: string;
  routeId?: string;
  coordinate: Coordinate;
  speedKmh?: number;
  headingDeg?: number;
  accuracyM?: number;
  /** Timestamp del dispositivo (ISO string) */
  recordedAt: string;
}

@Injectable()
export class ProcessLocationUseCase implements OnModuleInit {
  private readonly logger = new Logger(ProcessLocationUseCase.name);

  /** Cache de geocercas activas por tenant (TTL 60s) */
  private readonly geofenceCache = new Map<string, { list: Geofence[]; expiry: number }>();
  /** Estado de geocerca por vehículo: vehicleId → Set de geofenceIds actualmente dentro */
  private readonly vehicleGeofenceState = new Map<string, Set<string>>();

  constructor(
    @Inject(LOCATION_REPOSITORY) private readonly locationRepo: ILocationRepository,
    @Inject(ROUTE_REPOSITORY) private readonly routeRepo: IRouteRepository,
    @Inject(ALERT_REPOSITORY) private readonly alertRepo: IAlertRepository,
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: IVehicleRepository,
    @Inject(NOTIFICATION_SERVICE) private readonly notificationSvc: INotificationService,
    @Inject(GEOFENCE_REPOSITORY) private readonly geofenceRepo: IGeofenceRepository,
    private readonly gateway: TrackingGateway,
    private readonly batchBuffer: PingBatchBufferService,
  ) {}

  /** Registrar callbacks al iniciar el módulo */
  onModuleInit() {
    this.batchBuffer.setFlushCallback((pings) => this.processBatch(pings));
    // Conectar el handler de pings de socket con este use case
    this.gateway.setProcessPingCallback((ping) => this.execute(ping));
    // Conectar el handler de pánico vía socket
    this.gateway.setPanicCallback((p) => this.handlePanic(p));
  }

  /** Maneja una alerta de pánico (llamado desde socket o REST controller) */
  async handlePanic(payload: {
    vehicleId: string;
    tenantId: string;
    coordinate?: { lat: number; lng: number };
  }): Promise<void> {
    await this.alertRepo.create({
      tenantId: payload.tenantId,
      vehicleId: payload.vehicleId,
      alertType: 'emergency',
      severity: 'critical',
      payload: {
        source: 'panic_button',
        lat: payload.coordinate?.lat,
        lng: payload.coordinate?.lng,
        triggered_at: new Date().toISOString(),
      },
    });
    await this.vehicleRepo.updateStatus(payload.vehicleId, payload.tenantId, 'off_route');
    this.gateway.emitEmergencyAlert(payload.tenantId, payload.vehicleId, payload.coordinate);
    this.logger.warn(`PÁNICO procesado: vehicleId=${payload.vehicleId} tenant=${payload.tenantId}`);
  }

  /**
   * Acepta el ping del móvil y lo delega al buffer.
   * Retorna inmediatamente (<1ms) para no bloquear al dispositivo.
   */
  execute(ping: IncomingPingDto): void {
    if (!ping.vehicleId || !ping.tenantId) {
      this.logger.warn(`Ping ignorado: vehicleId="${ping.vehicleId}" tenantId="${ping.tenantId}" vacíos`);
      return;
    }
    this.batchBuffer.addPing({
      vehicleId: ping.vehicleId,
      tenantId: ping.tenantId,
      routeId: ping.routeId,
      lat: ping.coordinate.lat,
      lng: ping.coordinate.lng,
      speedKmh: ping.speedKmh,
      headingDeg: ping.headingDeg,
      accuracyM: ping.accuracyM,
      recordedAt: new Date(ping.recordedAt),
    });
  }

  /** Procesa un batch de pings ya snapeados a calles */
  private async processBatch(pings: FlushedPing[]): Promise<void> {
    for (const ping of pings) {
      await this.processSingle(ping);
    }
  }

  private async processSingle(ping: FlushedPing): Promise<void> {
    if (!ping.vehicleId || !ping.tenantId) {
      this.logger.warn('processSingle: vehicleId o tenantId vacío, ping descartado');
      return;
    }
    const t0 = Date.now();

    // Usar coordenadas snapeadas (calles reales) para todo el procesamiento
    const snappedCoord: Coordinate = {
      lat: ping.snappedLat,
      lng: ping.snappedLng,
    };

    // 1. Umbral de desvío del tenant
    const thresholdM = await this.getTenantThreshold(ping.tenantId);

    // 2. Detectar desvío usando la coordenada snapeada
    let isOffRoute = false;
    let deviationM = 0;

    if (ping.routeId) {
      const vehicle = await this.vehicleRepo.findById(ping.vehicleId, ping.tenantId);
      let driverFcmToken: string | undefined;
      if (vehicle?.assignedDriverId) {
        driverFcmToken = await this.getDriverFcmToken(vehicle.assignedDriverId);
      }

      const deviationResult = await detectDeviation(
        {
          vehicleId: ping.vehicleId,
          tenantId: ping.tenantId,
          routeId: ping.routeId,
          coordinate: snappedCoord,
          thresholdM,
        },
        {
          routeRepository: this.routeRepo,
          alertRepository: this.alertRepo,
          vehicleRepository: this.vehicleRepo,
          notificationService: this.notificationSvc,
          driverFcmToken,
        },
      );

      isOffRoute = deviationResult.isOffRoute;
      deviationM = deviationResult.deviationM;

      if (isOffRoute && vehicle?.status === 'active') {
        await this.vehicleRepo.updateStatus(ping.vehicleId, ping.tenantId, 'off_route');
      } else if (!isOffRoute && (vehicle?.status === 'off_route' || vehicle?.status === 'inactive')) {
        // Activa el vehículo tanto al retornar de un desvío como al iniciar tracking
        await this.vehicleRepo.updateStatus(ping.vehicleId, ping.tenantId, 'active');
      }
    }

    // 3. Persistir SOLO si corresponde según sampling (1 de cada PERSIST_EVERY_N)
    //    Reduce escrituras en Supabase ~83% manteniendo resolución de 60s
    if (ping.shouldPersist) {
      const locationInput: CreateLocationInput = {
        tenantId: ping.tenantId,
        vehicleId: ping.vehicleId,
        routeId: ping.routeId,
        coordinate: snappedCoord,     // Guardar coordenada snapeada, no la raw del GPS
        speedKmh: ping.speedKmh,
        headingDeg: ping.headingDeg,
        accuracyM: ping.accuracyM,
        isOffRoute,
        deviationM: isOffRoute ? deviationM : undefined,
        recordedAt: ping.recordedAt,
      };
      await this.locationRepo.create(locationInput);
    }

    // 4. Comprobar geocercas (entrada/salida)
    await this.checkGeofences(ping.tenantId, ping.vehicleId, snappedCoord);

    // 5. Emitir WebSocket al dashboard (SIEMPRE, independiente de si se persiste)
    //    El mapa en vivo necesita actualizaciones frecuentes aunque no guardemos todo
    const wsPayload: LocationWebSocketPayload = {
      v: ping.vehicleId,
      lat: snappedCoord.lat,         // Emitir coordenada snapeada
      lng: snappedCoord.lng,
      s: ping.speedKmh,
      h: ping.headingDeg,
      off: isOffRoute || undefined,
    };

    this.gateway.emitLocationUpdate(ping.tenantId, wsPayload);

    if (isOffRoute) {
      this.gateway.emitDeviationAlert(ping.tenantId, ping.vehicleId, deviationM);
    }

    this.logger.debug(
      `Ping OK: ${ping.vehicleId} | offRoute=${isOffRoute} | persisted=${ping.shouldPersist} | ${Date.now() - t0}ms`,
    );
  }

  // ─── Geocercas ───────────────────────────────────────────────────────────────

  private async getActiveGeofences(tenantId: string): Promise<Geofence[]> {
    const cached = this.geofenceCache.get(tenantId);
    if (cached && Date.now() < cached.expiry) return cached.list;
    const list = await this.geofenceRepo.findActiveByTenant(tenantId);
    this.geofenceCache.set(tenantId, { list, expiry: Date.now() + 60_000 });
    return list;
  }

  private async checkGeofences(
    tenantId: string,
    vehicleId: string,
    coord: Coordinate,
  ): Promise<void> {
    try {
      const geofences = await this.getActiveGeofences(tenantId);
      if (!geofences.length) return;

      const prevInside = this.vehicleGeofenceState.get(vehicleId) ?? new Set<string>();
      const nowInside = new Set<string>();

      for (const gf of geofences) {
        if (pointInPolygon(coord, gf.polygonCoords)) {
          nowInside.add(gf.id);
        }
      }

      for (const gf of geofences) {
        const wasIn = prevInside.has(gf.id);
        const isIn  = nowInside.has(gf.id);

        if (isIn && !wasIn && gf.alertOnEnter) {
          await this.alertRepo.create({
            tenantId,
            vehicleId,
            alertType: 'geofence_entry',
            severity: 'info',
            payload: { geofence_id: gf.id, geofence_name: gf.name, geofence_type: gf.type },
          });
          this.gateway.emitGeofenceAlert(tenantId, vehicleId, 'geofence_entry', gf.name);
          this.logger.log(`Vehículo ${vehicleId} ENTRÓ a geocerca "${gf.name}"`);
        } else if (!isIn && wasIn && gf.alertOnExit) {
          await this.alertRepo.create({
            tenantId,
            vehicleId,
            alertType: 'geofence_exit',
            severity: 'info',
            payload: { geofence_id: gf.id, geofence_name: gf.name, geofence_type: gf.type },
          });
          this.gateway.emitGeofenceAlert(tenantId, vehicleId, 'geofence_exit', gf.name);
          this.logger.log(`Vehículo ${vehicleId} SALIÓ de geocerca "${gf.name}"`);
        }
      }

      this.vehicleGeofenceState.set(vehicleId, nowInside);
    } catch (err) {
      this.logger.error(`Error al comprobar geocercas: ${(err as Error).message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  private async getTenantThreshold(tenantId: string): Promise<number> {
    const { data } = await getServerSupabaseClient()
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();
    const settings = (data ? data['settings'] : null) as { deviation_threshold_m?: number } | null;
    return settings?.deviation_threshold_m ?? Number(process.env['DEVIATION_THRESHOLD_METERS'] ?? 50);
  }

  private async getDriverFcmToken(driverId: string): Promise<string | undefined> {
    const { data } = await getServerSupabaseClient()
      .from('profiles')
      .select('fcm_token')
      .eq('id', driverId)
      .single();
    return (data ? data['fcm_token'] : null) as string | undefined;
  }
}

// ─── Ray-casting point-in-polygon (WGS-84, polígonos simples) ────────────────
function pointInPolygon(coord: Coordinate, polygon: [number, number][]): boolean {
  const x = coord.lng;
  const y = coord.lat;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
