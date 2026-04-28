// ─── tracking.gateway.ts ──────────────────────────────────────────────────────
// WebSocket Gateway: transporte WS puro.
//
// Responsabilidades de ESTE archivo:
//   • Gestión del ciclo de vida de conexiones (connect / disconnect)
//   • Routing de eventos entrantes del móvil → use-cases / servicios
//   • Emisión de eventos salientes al dashboard web (room por tenant)
//   • Re-hidratación de clientes web al unirse al room
//
// Estado de sesiones y cachés en memoria → TrackingSessionService (inyectado).
//
// Flujo de conexión del móvil:
//   1. connectSocket(jwt) → socket se conecta con auth.token
//   2. El móvil emite `tracking:start` con { vehicleId, tenantId }
//   3. TrackingSessionService registra socketId → { vehicleId, tenantId }
//   4. El móvil emite `location:ping` con la posición
//   5. El gateway delega al ProcessLocationUseCase
//   6. Al desconectarse, se marca el vehículo inactive si no quedan otros sockets

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject } from '@nestjs/common';
import type { LocationWebSocketPayload } from '@zona-zero/domain';
import type { IVehicleRepository } from '@zona-zero/domain';
import { VEHICLE_REPOSITORY } from '../../../common/tokens';
import { TrackingSessionService } from '../application/tracking-session.service';

/** Nombre del evento que la Web escucha para actualizar marcadores en el mapa */
export const LOCATION_UPDATE_EVENT    = 'location:update';
export const DEVIATION_ALERT_EVENT    = 'alert:deviation';
export const EMERGENCY_ALERT_EVENT    = 'alert:emergency';
export const GEOFENCE_ALERT_EVENT     = 'alert:geofence';
export const TRACKING_STARTED_EVENT   = 'tracking:started';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', process.env['ALLOWED_ORIGIN'] ?? ''],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  /** Callback inyectado post-construcción para evitar dependencia circular */
  private processPingFn?: (ping: Parameters<TrackingGateway['onLocationPing']>[1]) => void;
  /** Callback para manejar alertas de pánico vía socket */
  private processPanicFn?: (payload: { vehicleId: string; tenantId: string; coordinate?: { lat: number; lng: number } }) => Promise<void>;
  /** Callback para limpiar estado en memoria del ProcessLocationUseCase */
  private clearVehicleStateFn?: (vehicleId: string) => void;

  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: IVehicleRepository,
    private readonly sessions: TrackingSessionService,
  ) {}

  // ── Callbacks externos (evitan dependencia circular) ─────────────────────

  setProcessPingCallback(fn: (ping: Parameters<TrackingGateway['onLocationPing']>[1]) => void): void {
    this.processPingFn = fn;
  }

  setPanicCallback(fn: (payload: { vehicleId: string; tenantId: string; coordinate?: { lat: number; lng: number } }) => Promise<void>): void {
    this.processPanicFn = fn;
  }

  setClearVehicleStateCallback(fn: (vehicleId: string) => void): void {
    this.clearVehicleStateFn = fn;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);

    const removed = this.sessions.removeSession(client.id);
    if (!removed) return;

    const { session, hasOtherSockets } = removed;
    if (!session.vehicleId) return;

    if (!hasOtherSockets) {
      try {
        await this.vehicleRepo.updateStatus(session.vehicleId, session.tenantId, 'inactive');
        this.clearVehicleStateFn?.(session.vehicleId);
        this.sessions.clearVehicleCache(session.vehicleId);
        this.logger.log(`Vehículo ${session.vehicleId} marcado inactive (conductor desconectado)`);
      } catch (err) {
        this.logger.error(`Error al marcar vehículo inactive: ${(err as Error).message}`);
      }
    }
  }

  // ── Eventos entrantes ─────────────────────────────────────────────────────

  /**
   * El cliente web se une al room de su tenant.
   * Evento: `join:tenant` | Payload: { tenantId: string }
   * Re-hidrata al cliente con el estado cacheado del tenant.
   */
  @SubscribeMessage('join:tenant')
  handleJoinTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    const room = `tenant:${data.tenantId}`;
    void client.join(room);
    this.logger.log(`Cliente ${client.id} se unió al room ${room}`);

    // Re-hidratar con el snapshot en memoria del tenant
    const snapshot = this.sessions.getHydrationSnapshot(data.tenantId);
    for (const payload of snapshot.positions) {
      client.emit(LOCATION_UPDATE_EVENT, payload);
    }
    for (const ar of snapshot.activeRoutes) {
      client.emit(TRACKING_STARTED_EVENT, {
        vehicleId: ar.vehicleId,
        routeId:   ar.routeId,
        timestamp: new Date().toISOString(),
      });
    }
    for (const nr of snapshot.navRoutes) {
      client.emit('navigation:route', nr);
    }

    return { event: 'joined', data: { room } };
  }

  /**
   * El conductor registra su sesión de tracking.
   * Evento: `tracking:start` | Payload: { vehicleId, tenantId, routeId? }
   */
  @SubscribeMessage('tracking:start')
  handleTrackingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vehicleId: string; tenantId: string; routeId?: string },
  ) {
    if (!data.vehicleId || !data.tenantId) {
      this.logger.warn(`tracking:start ignorado: vehicleId o tenantId vacío (socket=${client.id})`);
      return { event: 'tracking:error', data: { reason: 'vehicleId_required' } };
    }

    this.sessions.registerSession(client.id, { vehicleId: data.vehicleId, tenantId: data.tenantId });

    if (data.routeId) {
      this.sessions.cacheActiveRoute(data.vehicleId, data.routeId);
    }

    this.server.to(`tenant:${data.tenantId}`).emit(TRACKING_STARTED_EVENT, {
      vehicleId: data.vehicleId,
      routeId:   data.routeId,
      timestamp: new Date().toISOString(),
    });

    return { event: 'tracking:started' };
  }

  /**
   * El conductor detiene el tracking explícitamente.
   * Evento: `tracking:stop`
   */
  @SubscribeMessage('tracking:stop')
  async handleTrackingStop(@ConnectedSocket() client: Socket) {
    const removed = this.sessions.removeSession(client.id);
    if (removed && !removed.hasOtherSockets) {
      const { session } = removed;
      await this.vehicleRepo.updateStatus(session.vehicleId, session.tenantId, 'inactive');
      this.clearVehicleStateFn?.(session.vehicleId);
      this.sessions.clearVehicleCache(session.vehicleId);
      this.logger.log(`Vehículo ${session.vehicleId} marcado inactive (tracking detenido)`);
    }
    return { event: 'tracking:stopped' };
  }

  /**
   * El conductor comparte la ruta de navegación (Directions API) para el dashboard web.
   * Evento: `navigation:route` | Payload: { vehicleId, routeId, tenantId?, path }
   *
   * Nota: este evento se emite ANTES de `tracking:start` (el conductor está en camino
   * al primer punto pero aún no ha pulsado "Iniciar"). Por eso se acepta tenantId
   * en el payload como fallback cuando no hay sesión registrada aún.
   */
  @SubscribeMessage('navigation:route')
  handleNavigationRoute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vehicleId: string; routeId: string; tenantId?: string; path: { lat: number; lng: number }[] },
  ) {
    const session  = this.sessions.getSession(client.id);
    const tenantId = session?.tenantId ?? data.tenantId;
    if (!tenantId) {
      this.logger.warn(`navigation:route ignorado: sin sesión ni tenantId en payload (socket=${client.id})`);
      return;
    }

    this.sessions.cacheNavRoute(data.vehicleId, data.routeId, data.path);

    this.server.to(`tenant:${tenantId}`).emit('navigation:route', {
      vehicleId: data.vehicleId,
      routeId:   data.routeId,
      path:      data.path,
    });
    this.logger.log(`navigation:route relayed: vehicleId=${data.vehicleId} points=${data.path?.length ?? 0}`);
  }

  /**
   * Recibe pings GPS del móvil y los delega al ProcessLocationUseCase.
   * Evento: `location:ping`
   * Si no hay sesión aún (reconexión antes de tracking:start), la auto-registra.
   */
  @SubscribeMessage('location:ping')
  onLocationPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: {
      vehicleId: string;
      tenantId: string;
      routeId?: string;
      coordinate: { lat: number; lng: number };
      speedKmh?: number;
      headingDeg?: number;
      accuracyM?: number;
      recordedAt: string;
    },
  ) {
    if (!this.sessions.hasSession(client.id) && payload.vehicleId && payload.tenantId) {
      this.sessions.registerSession(client.id, {
        vehicleId: payload.vehicleId,
        tenantId:  payload.tenantId,
      });
      this.logger.warn(`location:ping: sesión auto-registrada para socket ${client.id} (vehicleId=${payload.vehicleId})`);
    }
    this.processPingFn?.(payload);
  }

  /**
   * Recibe alerta de pánico del móvil vía socket.
   * Evento: `panic:alert` | Payload: { vehicleId, tenantId, coordinate? }
   */
  @SubscribeMessage('panic:alert')
  async onPanicAlert(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { vehicleId: string; tenantId: string; coordinate?: { lat: number; lng: number } },
  ) {
    this.logger.warn(`PÁNICO recibido vía socket: vehicleId=${payload.vehicleId}`);
    if (this.processPanicFn) {
      await this.processPanicFn(payload);
    }
    return { event: 'panic:received' };
  }

  // ── Emisión de eventos al dashboard ──────────────────────────────────────

  /** Emite la posición de un vehículo a todos los clientes web del tenant. */
  emitLocationUpdate(tenantId: string, payload: LocationWebSocketPayload): void {
    this.sessions.cachePosition(tenantId, payload);
    this.server.to(`tenant:${tenantId}`).emit(LOCATION_UPDATE_EVENT, payload);
  }

  /** Emite una alerta de desvío al room del tenant. */
  emitDeviationAlert(tenantId: string, vehicleId: string, deviationM: number): void {
    this.server.to(`tenant:${tenantId}`).emit(DEVIATION_ALERT_EVENT, {
      vehicleId,
      deviationM: Math.round(deviationM),
      timestamp:  new Date().toISOString(),
    });
  }

  /** Emite alerta de botón de pánico al dashboard. */
  emitEmergencyAlert(
    tenantId: string,
    vehicleId: string,
    coordinate?: { lat: number; lng: number },
  ): void {
    this.server.to(`tenant:${tenantId}`).emit(EMERGENCY_ALERT_EVENT, {
      vehicleId,
      coordinate,
      timestamp: new Date().toISOString(),
    });
  }

  /** Emite alerta de geocerca (entrada o salida) al dashboard. */
  emitGeofenceAlert(
    tenantId: string,
    vehicleId: string,
    eventType: 'geofence_entry' | 'geofence_exit',
    geofenceName: string,
  ): void {
    this.server.to(`tenant:${tenantId}`).emit(GEOFENCE_ALERT_EVENT, {
      vehicleId,
      eventType,
      geofenceName,
      timestamp: new Date().toISOString(),
    });
  }
}
