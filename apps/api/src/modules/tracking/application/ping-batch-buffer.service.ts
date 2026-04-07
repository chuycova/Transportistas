// ─── application/ping-batch-buffer.service.ts ────────────────────────────────
// Acumula pings GPS por vehículo y los envía en batch a Google Roads API.
//
// Por qué:
//   - Roads API cobra POR REQUEST, no por punto (máx 100 puntos/request)
//   - Sin buffer: 1 ping = 1 request → hasta $288/día con 10 vehículos
//   - Con buffer x10: 10 pings = 1 request → ~$29/día (-90% costo)
//
// Comportamiento:
//   - Acumula hasta BATCH_SIZE pings por vehicleId
//   - Si no se llena en FLUSH_MS, el timer fuerza el flush igualmente
//   - Si el vehículo no se movió MIN_DELTA_METERS, el ping se ignora (ahorra más)
//   - El sampling PERSIST_EVERY_N controla cuántos pings se guardan en Supabase
//     (los demás se emiten por WebSocket pero NO persisten para ahorrar DB)

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { GoogleRoadsAdapter } from '../infrastructure/google-roads.adapter';

const BATCH_SIZE = 10;          // Cuántos pings acumular antes de hacer el snap
const FLUSH_MS = 4_000;         // Tiempo máximo de espera antes de flush forzado (ms)
const MIN_DELTA_METERS = 15;    // Ignorar ping si el vehículo no se movió este mínimo
const PERSIST_EVERY_N = 6;      // Guardar en Supabase 1 de cada N pings (cada ~60s a 10s/ping)

export interface RawPing {
  vehicleId: string;
  tenantId: string;
  routeId?: string;
  lat: number;
  lng: number;
  speedKmh?: number;
  headingDeg?: number;
  accuracyM?: number;
  recordedAt: Date;
}

export type FlushedPing = RawPing & {
  /** Coordenadas snapeadas a la calle. Pueden ser distintas a lat/lng originales */
  snappedLat: number;
  snappedLng: number;
  /** ID de la calle (placeId de Google Roads) — útil para analytics */
  placeId?: string;
  /** Si true, este ping debe persistirse en Supabase */
  shouldPersist: boolean;
};

export type FlushCallback = (pings: FlushedPing[]) => Promise<void>;

interface VehicleBuffer {
  pings: RawPing[];
  timer: ReturnType<typeof setTimeout>;
  pingCount: number;         // Contador global por vehículo (para sampling)
  lastLat: number;
  lastLng: number;
}

/** Calcula distancia Haversine en metros entre dos coordenadas */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

@Injectable()
export class PingBatchBufferService implements OnModuleDestroy {
  private readonly logger = new Logger(PingBatchBufferService.name);
  private readonly buffers = new Map<string, VehicleBuffer>();
  private flushCallback: FlushCallback | null = null;

  constructor(private readonly roadsAdapter: GoogleRoadsAdapter) {}

  /** Registra el callback que se llama cuando el buffer se vacía */
  setFlushCallback(cb: FlushCallback) {
    this.flushCallback = cb;
  }

  /**
   * Recibe un ping y lo agrega al buffer del vehículo.
   * Retorna inmediatamente (async internamente).
   */
  addPing(ping: RawPing): void {
    const existing = this.buffers.get(ping.vehicleId);

    // ── Delta mínimo: ignorar si el vehículo no se movió ─────────────────────
    if (existing) {
      const delta = haversineMeters(
        existing.lastLat, existing.lastLng,
        ping.lat, ping.lng,
      );
      if (delta < MIN_DELTA_METERS) {
        this.logger.debug(`Ping ignored (delta ${delta.toFixed(1)}m < ${MIN_DELTA_METERS}m) for ${ping.vehicleId}`);
        return;
      }
    }

    if (existing) {
      existing.pings.push(ping);
      existing.lastLat = ping.lat;
      existing.lastLng = ping.lng;

      if (existing.pings.length >= BATCH_SIZE) {
        clearTimeout(existing.timer);
        this.buffers.delete(ping.vehicleId);
        void this.flush(ping.vehicleId, existing.pings, existing.pingCount);
      }
    } else {
      const timer = setTimeout(() => {
        const buf = this.buffers.get(ping.vehicleId);
        if (buf) {
          this.buffers.delete(ping.vehicleId);
          void this.flush(ping.vehicleId, buf.pings, buf.pingCount);
        }
      }, FLUSH_MS);

      this.buffers.set(ping.vehicleId, {
        pings: [ping],
        timer,
        pingCount: 1,
        lastLat: ping.lat,
        lastLng: ping.lng,
      });
    }
  }

  private async flush(vehicleId: string, pings: RawPing[], baseCount: number): Promise<void> {
    if (!this.flushCallback) return;

    this.logger.debug(`Flushing batch of ${pings.length} pings for vehicle ${vehicleId}`);

    // ── Road snap (un solo request para todo el batch) ────────────────────────
    const snapped = await this.roadsAdapter.snapToRoads(
      pings.map((p) => ({ lat: p.lat, lng: p.lng })),
    );

    // ── Construir pings enriquecidos con decisión de persistencia ─────────────
    const enriched: FlushedPing[] = pings.map((p, i) => {
      const s = snapped[i] ?? { lat: p.lat, lng: p.lng };
      const seq = baseCount + i;
      return {
        ...p,
        snappedLat: s.lat,
        snappedLng: s.lng,
        placeId: (s as { placeId?: string }).placeId,
        shouldPersist: seq % PERSIST_EVERY_N === 0,
      };
    });

    await this.flushCallback(enriched);
  }

  /** Flush todos los buffers pendientes al cerrar el módulo */
  async onModuleDestroy() {
    for (const [vehicleId, buf] of this.buffers.entries()) {
      clearTimeout(buf.timer);
      await this.flush(vehicleId, buf.pings, buf.pingCount);
    }
    this.buffers.clear();
  }
}
