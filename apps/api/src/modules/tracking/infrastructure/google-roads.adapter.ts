// ─── infrastructure/google-roads.adapter.ts ──────────────────────────────────
// Hexagonal adapter — Roads API port.
// Snaps raw GPS coordinates to their nearest road segment.
//
// Security:
//   - API key tomada de GOOGLE_MAPS_BACKEND_KEY (NUNCA expuesta en frontend)
//   - Fallback graceful: si la key no está configurada, retorna coords originales
//   - Errores de red/timeout no rompen el flujo de tracking
//
// Costo:
//   - Roads API cobra por request (no por punto)
//   - Hasta 100 puntos por request — usar siempre con PingBatchBuffer

import { Injectable, Logger } from '@nestjs/common';

interface LatLng {
  lat: number;
  lng: number;
}

interface SnappedPoint extends LatLng {
  /** ID único de la calle según Google Roads (útil para analytics de tramo) */
  placeId?: string;
}

@Injectable()
export class GoogleRoadsAdapter {
  private readonly logger = new Logger(GoogleRoadsAdapter.name);
  private readonly key = process.env['GOOGLE_MAPS_BACKEND_KEY'];

  /**
   * Snappea hasta 100 puntos GPS a sus calles más cercanas.
   * Siempre resuelve — nunca lanza excepción. Si falla, retorna los puntos originales.
   */
  async snapToRoads(points: LatLng[]): Promise<SnappedPoint[]> {
    if (!this.key) {
      // Modo sin key: útil en desarrollo hasta que se configure la clave backend
      if (process.env['NODE_ENV'] !== 'production') {
        this.logger.debug('GOOGLE_MAPS_BACKEND_KEY not set — snapping skipped (dev mode)');
      } else {
        this.logger.warn('GOOGLE_MAPS_BACKEND_KEY not set — GPS coordinates NOT snapped to roads');
      }
      return points;
    }

    if (points.length === 0) return [];
    if (points.length > 100) {
      // La API acepta máximo 100 puntos. El batch buffer garantiza esto,
      // pero lo validamos como defensa en profundidad.
      this.logger.warn(`snapToRoads called with ${points.length} points — truncating to 100`);
      points = points.slice(0, 100);
    }

    const path = points.map((p) => `${p.lat},${p.lng}`).join('|');

    const params = new URLSearchParams({
      path,
      interpolate: 'true',
      key: this.key,
    });

    try {
      const res = await fetch(
        `https://roads.googleapis.com/v1/snapToRoads?${params.toString()}`,
        { signal: AbortSignal.timeout(5_000) },
      );

      if (!res.ok) {
        this.logger.error(`Roads API HTTP ${res.status} — falling back to raw GPS`);
        return points;
      }

      const data = await res.json() as {
        snappedPoints?: Array<{
          location: { latitude: number; longitude: number };
          placeId: string;
        }>;
      };

      if (!data.snappedPoints?.length) {
        this.logger.warn('Roads API returned 0 snapped points — using originals');
        return points;
      }

      return data.snappedPoints.map((p) => ({
        lat: p.location.latitude,
        lng: p.location.longitude,
        placeId: p.placeId,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Roads API error — falling back to raw GPS: ${msg}`);
      return points;
    }
  }
}
