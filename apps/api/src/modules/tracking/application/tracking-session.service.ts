// ─── tracking-session.service.ts ─────────────────────────────────────────────
// Gestión del estado en memoria del módulo de tracking.
//
// Responsabilidades:
//   • Registro de sesiones de conducción activas (socketId → vehicleId, tenantId)
//   • Caché de última posición por vehículo  (re-hidratación al join:tenant)
//   • Caché de ruta activa por vehículo      (tracking:start)
//   • Caché de ruta de navegación al inicio  (navigation:route)
//
// El TrackingGateway inyecta este servicio y le delega toda la lógica de estado;
// el gateway solo se ocupa del transporte WebSocket.

import { Injectable, Logger } from '@nestjs/common';
import type { LocationWebSocketPayload } from '@zona-zero/domain';

export interface DriverSession {
  vehicleId: string;
  tenantId: string;
}

export interface HydrationSnapshot {
  positions:    LocationWebSocketPayload[];
  activeRoutes: { vehicleId: string; routeId: string }[];
  navRoutes:    { vehicleId: string; routeId: string; path: { lat: number; lng: number }[] }[];
}

@Injectable()
export class TrackingSessionService {
  private readonly logger = new Logger(TrackingSessionService.name);

  // socketId → sesión del conductor (vehicleId + tenantId)
  private readonly driverSessions = new Map<string, DriverSession>();

  // vehicleId → última posición emitida (para re-hidratar clientes web)
  private readonly lastPositions = new Map<
    string,
    { tenantId: string; payload: LocationWebSocketPayload }
  >();

  // vehicleId → ruta activa en tracking
  private readonly cachedActiveRoutes = new Map<
    string,
    { vehicleId: string; routeId: string }
  >();

  // vehicleId → polyline de navegación al primer punto
  private readonly cachedNavRoutes = new Map<
    string,
    { vehicleId: string; routeId: string; path: { lat: number; lng: number }[] }
  >();

  // ── Gestión de sesiones ───────────────────────────────────────────────────

  registerSession(socketId: string, session: DriverSession): void {
    this.driverSessions.set(socketId, session);
    this.logger.log(
      `Sesión registrada: socket=${socketId} vehicleId=${session.vehicleId} tenantId=${session.tenantId}`,
    );
  }

  getSession(socketId: string): DriverSession | undefined {
    return this.driverSessions.get(socketId);
  }

  hasSession(socketId: string): boolean {
    return this.driverSessions.has(socketId);
  }

  /**
   * Elimina la sesión del socket. Retorna la sesión eliminada si existía.
   * Comprueba además si el vehículo tiene otros sockets activos.
   */
  removeSession(socketId: string): { session: DriverSession; hasOtherSockets: boolean } | null {
    const session = this.driverSessions.get(socketId);
    if (!session) return null;

    this.driverSessions.delete(socketId);
    const hasOtherSockets = [...this.driverSessions.values()].some(
      (s) => s.vehicleId === session.vehicleId,
    );
    return { session, hasOtherSockets };
  }

  // ── Gestión de cachés ─────────────────────────────────────────────────────

  cachePosition(tenantId: string, payload: LocationWebSocketPayload): void {
    this.lastPositions.set(payload.v, { tenantId, payload });
  }

  cacheActiveRoute(vehicleId: string, routeId: string): void {
    this.cachedActiveRoutes.set(vehicleId, { vehicleId, routeId });
  }

  cacheNavRoute(
    vehicleId: string,
    routeId: string,
    path: { lat: number; lng: number }[],
  ): void {
    this.cachedNavRoutes.set(vehicleId, { vehicleId, routeId, path });
  }

  clearVehicleCache(vehicleId: string): void {
    this.lastPositions.delete(vehicleId);
    this.cachedActiveRoutes.delete(vehicleId);
    this.cachedNavRoutes.delete(vehicleId);
    this.logger.log(`Caché limpiado para vehicleId=${vehicleId}`);
  }

  /**
   * Devuelve un snapshot de todo el estado cacheado filtrado por tenantId.
   * El gateway lo usa para re-hidratar clientes web al recibir `join:tenant`.
   */
  getHydrationSnapshot(tenantId: string): HydrationSnapshot {
    const positions: LocationWebSocketPayload[] = [];
    for (const entry of this.lastPositions.values()) {
      if (entry.tenantId === tenantId) positions.push(entry.payload);
    }
    return {
      positions,
      activeRoutes: [...this.cachedActiveRoutes.values()],
      navRoutes:    [...this.cachedNavRoutes.values()],
    };
  }
}
