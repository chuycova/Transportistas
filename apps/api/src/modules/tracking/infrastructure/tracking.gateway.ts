// WebSocket Gateway: punto de entrada de pings GPS del móvil y emisor al dashboard web.
// Cada tenant tiene su propio "room" de Socket.io: `tenant:{tenantId}`
//
// Flujo de conexión del móvil:
//   1. connectSocket(jwt) → socket se conecta con auth.token
//   2. El móvil emite `tracking:start` con { vehicleId, tenantId }
//   3. El gateway registra socketId → { vehicleId, tenantId }
//   4. El móvil emite `location:ping` con la posición
//   5. El gateway delega al ProcessLocationUseCase
//   6. Al desconectarse (tracking detenido / pérdida de red), se marca el vehículo inactive

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

/** Nombre del evento que la Web escucha para actualizar marcadores en el mapa */
export const LOCATION_UPDATE_EVENT = 'location:update';

/** Nombre del evento de alerta de desvío */
export const DEVIATION_ALERT_EVENT = 'alert:deviation';

/** Alerta de emergencia (botón de pánico) */
export const EMERGENCY_ALERT_EVENT = 'alert:emergency';

/** Alerta de geocerca (entrada/salida) */
export const GEOFENCE_ALERT_EVENT = 'alert:geofence';

/** Conductor inició tracking (la web muestra toast "en camino") */
export const TRACKING_STARTED_EVENT = 'tracking:started';

/** Contexto de tracking registrado por socket */
interface DriverSession {
  vehicleId: string;
  tenantId: string;
}

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

  /** socketId -> sesión del conductor. Permite limpiar estado al desconectarse. */
  private readonly driverSessions = new Map<string, DriverSession>();

  // ── Cachés en memoria para re-hidratar clientes web al reconectarse ──
  /** vehicleId -> última posición emitida + tenantId */
  private readonly lastPositions = new Map<string, { tenantId: string; payload: LocationWebSocketPayload }>();
  /** vehicleId -> ruta de navegación (Directions API polyline) */
  private readonly cachedNavRoutes = new Map<string, { vehicleId: string; routeId: string; path: { lat: number; lng: number }[] }>();
  /** vehicleId -> routeId activa */
  private readonly cachedActiveRoutes = new Map<string, { vehicleId: string; routeId: string }>();

  /** Callback inyectado post-construcción para evitar dependencia circular */
  private processPingFn?: (ping: Parameters<TrackingGateway['onLocationPing']>[1]) => void;
  /** Callback para manejar alertas de pánico vía socket */
  private processPanicFn?: (payload: { vehicleId: string; tenantId: string; coordinate?: { lat: number; lng: number } }) => Promise<void>;
  /** Callback para limpiar estado en memoria del ProcessLocationUseCase */
  private clearVehicleStateFn?: (vehicleId: string) => void;

  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: IVehicleRepository,
  ) {}

  /** El ProcessLocationUseCase registra su callback aquí al iniciar el módulo */
  setProcessPingCallback(fn: (ping: Parameters<TrackingGateway['onLocationPing']>[1]) => void): void {
    this.processPingFn = fn;
  }

  /** Registra el handler de pánico (evita dependencia circular con TrackingController) */
  setPanicCallback(fn: (payload: { vehicleId: string; tenantId: string; coordinate?: { lat: number; lng: number } }) => Promise<void>): void {
    this.processPanicFn = fn;
  }

  /** Registra callback de limpieza de estado del ProcessLocationUseCase */
  setClearVehicleStateCallback(fn: (vehicleId: string) => void): void {
    this.clearVehicleStateFn = fn;
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);

    const session = this.driverSessions.get(client.id);
    if (session) {
      this.driverSessions.delete(client.id);
      // Ignorar sesiones sin vehicleId válido (p. ej. clientes web o desconexiones
      // antes de que el conductor llame tracking:start)
      if (!session.vehicleId) return;
      try {
        // Solo marcar inactive si ningún otro socket del mismo vehículo sigue conectado
        const stillConnected = [...this.driverSessions.values()].some(
          (s) => s.vehicleId === session.vehicleId,
        );
        if (!stillConnected) {
          await this.vehicleRepo.updateStatus(session.vehicleId, session.tenantId, 'inactive');
          this.clearVehicleStateFn?.(session.vehicleId);
          this.lastPositions.delete(session.vehicleId);
          this.cachedActiveRoutes.delete(session.vehicleId);
          this.cachedNavRoutes.delete(session.vehicleId);
          this.logger.log(`Vehículo ${session.vehicleId} marcado inactive (conductor desconectado)`);
        }
      } catch (err) {
        this.logger.error(`Error al marcar vehículo inactive: ${(err as Error).message}`);
      }
    }
  }

  /**
   * El cliente web se une al room de su tenant.
   * Evento: `join:tenant`
   * Payload: { tenantId: string }
   */
  @SubscribeMessage('join:tenant')
  handleJoinTenant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    const room = `tenant:${data.tenantId}`;
    void client.join(room);
    this.logger.log(`Cliente ${client.id} se unió al room ${room}`);

    // Re-hidratar: enviar últimas posiciones, rutas activas y rutas de navegación cacheadas
    for (const [, entry] of this.lastPositions) {
      if (entry.tenantId === data.tenantId) {
        client.emit(LOCATION_UPDATE_EVENT, entry.payload);
      }
    }
    for (const ar of this.cachedActiveRoutes.values()) {
      client.emit(TRACKING_STARTED_EVENT, { vehicleId: ar.vehicleId, routeId: ar.routeId, timestamp: new Date().toISOString() });
    }
    for (const nr of this.cachedNavRoutes.values()) {
      client.emit('navigation:route', nr);
    }

    return { event: 'joined', data: { room } };
  }

  /**
   * El conductor registra su sesión de tracking.
   * Evento: `tracking:start`
   * Payload: { vehicleId: string, tenantId: string, routeId?: string }
   */
  @SubscribeMessage('tracking:start')
  handleTrackingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vehicleId: string; tenantId: string; routeId?: string },
  ) {
    // No registrar sesiones con vehicleId vacío o inválido
    if (!data.vehicleId || !data.tenantId) {
      this.logger.warn(`tracking:start ignorado: vehicleId o tenantId vacío (socket=${client.id})`);
      return { event: 'tracking:error', data: { reason: 'vehicleId_required' } };
    }
    this.driverSessions.set(client.id, { vehicleId: data.vehicleId, tenantId: data.tenantId });
    this.logger.log(`Conductor registrado: socket=${client.id} vehicleId=${data.vehicleId} routeId=${data.routeId ?? 'none'}`);

    // Cachear ruta activa para re-hidratación de clientes web
    if (data.routeId) {
      this.cachedActiveRoutes.set(data.vehicleId, { vehicleId: data.vehicleId, routeId: data.routeId });
    }

    // Notificar al dashboard web que el conductor inició ruta (en camino al primer punto)
    const room = `tenant:${data.tenantId}`;
    this.server.to(room).emit(TRACKING_STARTED_EVENT, {
      vehicleId: data.vehicleId,
      routeId: data.routeId,
      timestamp: new Date().toISOString(),
    });

    return { event: 'tracking:started' };
  }

  /**
   * El conductor comparte la ruta de navegación (Directions API) para el dashboard web.
   * Evento: `navigation:route`
   * Payload: { vehicleId, routeId, path: {lat,lng}[] }
   */
  @SubscribeMessage('navigation:route')
  handleNavigationRoute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vehicleId: string; routeId: string; path: { lat: number; lng: number }[] },
  ) {
    const session = this.driverSessions.get(client.id);
    if (!session) return;

    // Cachear para re-hidratación
    this.cachedNavRoutes.set(data.vehicleId, {
      vehicleId: data.vehicleId,
      routeId: data.routeId,
      path: data.path,
    });

    const room = `tenant:${session.tenantId}`;
    this.server.to(room).emit('navigation:route', {
      vehicleId: data.vehicleId,
      routeId: data.routeId,
      path: data.path,
    });
    this.logger.log(`navigation:route relayed: vehicleId=${data.vehicleId} points=${data.path?.length ?? 0}`);
  }

  /**
   * El conductor detiene el tracking explícitamente.
   * Evento: `tracking:stop`
   * Permite limpiar el estado antes de desconectarse.
   */
  @SubscribeMessage('tracking:stop')
  async handleTrackingStop(@ConnectedSocket() client: Socket) {
    const session = this.driverSessions.get(client.id);
    if (session) {
      this.driverSessions.delete(client.id);
      const stillConnected = [...this.driverSessions.values()].some(
        (s) => s.vehicleId === session.vehicleId,
      );
      if (!stillConnected) {
        await this.vehicleRepo.updateStatus(session.vehicleId, session.tenantId, 'inactive');
        this.clearVehicleStateFn?.(session.vehicleId);
        // Limpiar cachés de este vehículo
        this.lastPositions.delete(session.vehicleId);
        this.cachedActiveRoutes.delete(session.vehicleId);
        this.cachedNavRoutes.delete(session.vehicleId);
        this.logger.log(`Vehículo ${session.vehicleId} marcado inactive (tracking detenido)`);
      }
    }
    return { event: 'tracking:stopped' };
  }

  /**
   * Recibe alerta de pánico del móvil vía socket.
   * Evento: `panic:alert`
   * Payload: { vehicleId, tenantId, coordinate? }
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

  /**
   * Recibe un ping GPS del móvil y lo delega al ProcessLocationUseCase.
   * Evento: `location:ping`
   * Si el socket no tiene sesión registrada (tracking:start no llegó aún,
   * p.ej. por reconexión), la registra automáticamente desde el payload para
   * no perder pings en la ventana de inicio.
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
    if (!this.driverSessions.has(client.id) && payload.vehicleId && payload.tenantId) {
      this.driverSessions.set(client.id, { vehicleId: payload.vehicleId, tenantId: payload.tenantId });
      this.logger.warn(`location:ping: sesión auto-registrada para socket ${client.id} (vehicleId=${payload.vehicleId})`);
    }
    this.processPingFn?.(payload);
  }

  /**
   * Emite la posición de un vehículo a todos los clientes web del tenant.
   * Llamado internamente por el ProcessLocationUseCase.
   */
  emitLocationUpdate(tenantId: string, payload: LocationWebSocketPayload): void {
    // Cachear última posición para re-hidratación al join:tenant
    this.lastPositions.set(payload.v, { tenantId, payload });
    const room = `tenant:${tenantId}`;
    this.server.to(room).emit(LOCATION_UPDATE_EVENT, payload);
  }

  /**
   * Emite una alerta de desvío al room del tenant.
   * El dashboard web la recibe y muestra un toast/notification.
   */
  emitDeviationAlert(tenantId: string, vehicleId: string, deviationM: number): void {
    const room = `tenant:${tenantId}`;
    this.server.to(room).emit(DEVIATION_ALERT_EVENT, {
      vehicleId,
      deviationM: Math.round(deviationM),
      timestamp: new Date().toISOString(),
    });
  }

  /** Emite alerta de botón de pánico al dashboard */
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

  /** Emite alerta de geocerca (entrada o salida) al dashboard */
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
