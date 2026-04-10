// ─── socket.ts ────────────────────────────────────────────────────────────────
// Cliente Socket.io singleton para el conductor móvil.
//
// Este módulo es el espejo móvil del socket configurado en apps/web/src/lib.
// La diferencia: el móvil EMITE pings GPS; la web RECIBE actualizaciones.
//
// La autenticación se hace pasando el JWT de Supabase en el handshake
// (mismo mecanismo que valida el backend en TrackingGateway).

import { io, type Socket } from 'socket.io-client';
import { SOCKET_URL } from './constants';

// ─── Tipos de eventos del servidor (IncomingPingDto del backend) ──────────────
export interface LocationPingPayload {
  vehicleId: string;
  tenantId: string;
  routeId?: string;
  coordinate: { lat: number; lng: number };
  speedKmh?: number;
  headingDeg?: number;
  accuracyM?: number;
  recordedAt: string; // ISO string
}

export interface DeviationAlertPayload {
  vehicleId: string;
  deviationM: number;
  timestamp: string;
}

// ─── Singleton ────────────────────────────────────────────────────────────────
let _socket: Socket | null = null;

// Listeners de reconexión registrados antes de que _socket exista
const _reconnectListeners = new Set<() => void>();

/**
 * Inicializa y conecta el socket con el JWT del conductor.
 * Llama a esta función UNA VEZ en TrackingScreen cuando el usuario
 * inicia el tracking.
 */
export function connectSocket(jwtToken: string): Socket {
  if (_socket?.connected) return _socket;

  _socket = io(SOCKET_URL, {
    auth: { token: jwtToken },
    transports: ['websocket'], // Sin polling en mobile
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  _socket.on('connect', () => {
    console.log('[Socket] Conectado al servidor:', _socket?.id);
    _reconnectListeners.forEach((fn) => fn());
  });

  _socket.on('disconnect', (reason) => {
    console.warn('[Socket] Desconectado:', reason);
  });

  _socket.on('connect_error', (err) => {
    console.error('[Socket] Error de conexión:', err.message);
  });

  return _socket;
}

/**
 * Notifica al backend que el conductor inicia tracking.
 * Permite al backend registrar la sesión y marcar el vehículo active al desconectarse.
 */
export function emitTrackingStart(vehicleId: string, tenantId: string): void {
  _socket?.emit('tracking:start', { vehicleId, tenantId });
}

/**
 * Notifica al backend que el conductor detiene tracking explícitamente.
 * El backend marca el vehículo como inactive de inmediato.
 */
export function emitTrackingStop(): void {
  _socket?.emit('tracking:stop');
}

/**
 * Emite un ping GPS al backend.
 * Si el socket no está conectado, retorna false (el caller debe encolar en WatermelonDB).
 */
export function emitLocationPing(payload: LocationPingPayload): boolean {
  if (!_socket?.connected) return false;
  _socket.emit('location:ping', payload);
  return true;
}

/** Escucha alertas de desvío enviadas desde el backend al conductor */
export function onDeviationAlert(handler: (alert: DeviationAlertPayload) => void): () => void {
  if (!_socket) return () => {};
  _socket.on('deviation:alert', handler);
  return () => _socket?.off('deviation:alert', handler);
}

export interface PanicAlertPayload {
  vehicleId: string;
  coordinate?: { lat: number; lng: number };
}

/**
 * Emite una alerta de pánico al backend vía socket.
 * El backend la persiste como alerta crítica y la emite al dashboard.
 */
export function emitPanicAlert(payload: PanicAlertPayload): boolean {
  if (!_socket?.connected) return false;
  _socket.emit('panic:alert', payload);
  return true;
}

/** Desconecta el socket (cuando el conductor para el tracking) */
export function disconnectSocket(): void {
  _socket?.disconnect();
  _socket = null;
}

/** Retorna si el socket está actualmente conectado */
export function isSocketConnected(): boolean {
  return _socket?.connected ?? false;
}

/**
 * Suscribe un handler al evento de (re)conexión del socket.
 * Funciona aunque el socket no esté inicializado todavía.
 * Retorna una función de cleanup para cancelar la suscripción.
 */
export function onSocketReconnect(handler: () => void): () => void {
  _reconnectListeners.add(handler);
  return () => _reconnectListeners.delete(handler);
}
