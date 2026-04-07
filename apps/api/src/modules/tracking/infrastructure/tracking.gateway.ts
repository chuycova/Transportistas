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

  /** socketId → sesión del conductor. Permite limpiar estado al desconectarse. */
  private readonly driverSessions = new Map<string, DriverSession>();

  /** Callback inyectado post-construcción para evitar dependencia circular */
  private processPingFn?: (ping: Parameters<TrackingGateway['onLocationPing']>[1]) => void;

  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepo: IVehicleRepository,
  ) {}

  /** El ProcessLocationUseCase registra su callback aquí al iniciar el módulo */
  setProcessPingCallback(fn: (ping: Parameters<TrackingGateway['onLocationPing']>[1]) => void): void {
    this.processPingFn = fn;
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);

    const session = this.driverSessions.get(client.id);
    if (session) {
      this.driverSessions.delete(client.id);
      try {
        // Solo marcar inactive si ningún otro socket del mismo vehículo sigue conectado
        const stillConnected = [...this.driverSessions.values()].some(
          (s) => s.vehicleId === session.vehicleId,
        );
        if (!stillConnected) {
          await this.vehicleRepo.updateStatus(session.vehicleId, session.tenantId, 'inactive');
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
    return { event: 'joined', data: { room } };
  }

  /**
   * El conductor registra su sesión de tracking.
   * Evento: `tracking:start`
   * Payload: { vehicleId: string, tenantId: string }
   */
  @SubscribeMessage('tracking:start')
  handleTrackingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { vehicleId: string; tenantId: string },
  ) {
    this.driverSessions.set(client.id, { vehicleId: data.vehicleId, tenantId: data.tenantId });
    this.logger.log(`Conductor registrado: socket=${client.id} vehicleId=${data.vehicleId}`);
    return { event: 'tracking:started' };
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
        this.logger.log(`Vehículo ${session.vehicleId} marcado inactive (tracking detenido)`);
      }
    }
    return { event: 'tracking:stopped' };
  }

  /**
   * Recibe un ping GPS del móvil y lo delega al ProcessLocationUseCase.
   * Evento: `location:ping`
   */
  @SubscribeMessage('location:ping')
  onLocationPing(
    @ConnectedSocket() _client: Socket,
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
    this.processPingFn?.(payload);
  }

  /**
   * Emite la posición de un vehículo a todos los clientes web del tenant.
   * Llamado internamente por el ProcessLocationUseCase.
   */
  emitLocationUpdate(tenantId: string, payload: LocationWebSocketPayload): void {
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
}
