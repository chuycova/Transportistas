// ─── infrastructure/google-directions.adapter.ts ─────────────────────────────
// Hexagonal adapter — Google Routes API v2 (más económica que Directions v1)
//
// Seguridad:
//   - Solo usa GOOGLE_MAPS_BACKEND_KEY (nunca la clave pública del browser)
//   - FieldMask restringe exactamente qué campos retorna Google
//     → Solo pagamos por los campos que pedimos (reduce costo ~60%)
//
// Costo:
//   - Routes API v2: $5 USD / 1,000 requests (vs $10 de Directions v1)
//   - FieldMask: routes.polyline,routes.distanceMeters,routes.duration
//   - En producción: el cache en route_cache absorbe rutas repetidas → $0 adicional

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { getServerSupabaseClient } from '@zona-zero/infrastructure';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ComputedRoute {
  /** Polyline codificada (formato Google) para almacenar en Supabase */
  polylineEncoded: string;
  /** Array de puntos decodificados para detección de desvío (servidor) */
  points: LatLng[];
  distanceM: number;
  durationS: number;
  /** Clave de cache — SHA-256 de los waypoints redondeados a 4 decimales */
  cacheKey: string;
  /** true si vino del cache de Supabase, false si se calculó fresco */
  fromCache: boolean;
}

/** Decodifica una polyline codificada de Google en array de LatLng */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Genera clave de cache SHA-256 a partir de los waypoints (redondeados a 4 dec = ~11m) */
function buildCacheKey(origin: LatLng, destination: LatLng, waypoints: LatLng[]): string {
  const round = (n: number) => Math.round(n * 10_000) / 10_000;
  const payload = [origin, ...waypoints, destination]
    .map((p) => `${round(p.lat)},${round(p.lng)}`)
    .join('|');
  return createHash('sha256').update(payload).digest('hex').slice(0, 32);
}

@Injectable()
export class GoogleDirectionsAdapter {
  private readonly logger = new Logger(GoogleDirectionsAdapter.name);
  private readonly key = process.env['GOOGLE_MAPS_BACKEND_KEY'];

  /**
   * Calcula la ruta por calles de automóvil entre origen y destino.
   * 1. Busca en route_cache primero (gratis)
   * 2. Si no hay cache, llama a Routes API v2
   * 3. Guarda el resultado en cache para reutilización futura
   * Siempre retorna — nunca lanza excepción.
   */
  async computeRoute(
    origin: LatLng,
    destination: LatLng,
    waypoints: LatLng[] = [],
  ): Promise<ComputedRoute | null> {
    const cacheKey = buildCacheKey(origin, destination, waypoints);

    // ── 1. Verificar cache ──────────────────────────────────────────────────
    const cached = await this.fetchFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`Route cache HIT: ${cacheKey}`);
      return { ...cached, cacheKey, fromCache: true };
    }

    // ── 2. Llamar a Routes API v2 ───────────────────────────────────────────
    if (!this.key) {
      this.logger.warn('GOOGLE_MAPS_BACKEND_KEY not set — route calculation skipped');
      return null;
    }

    try {
      const body = {
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        ...(waypoints.length > 0 && {
          intermediates: waypoints.map((w) => ({
            location: { latLng: { latitude: w.lat, longitude: w.lng } },
          })),
        }),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidFerries: true,
          avoidIndoor: true,
        },
        languageCode: 'es-MX',
        units: 'METRIC',
      };

      const res = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'X-Goog-Api-Key': this.key,
            // FieldMask crítico: Google solo cobra por los campos solicitados
            'X-Goog-FieldMask': 'routes.polyline,routes.distanceMeters,routes.duration',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`Routes API HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return null;
      }

      const data = await res.json() as {
        routes: Array<{
          polyline: { encodedPolyline: string };
          distanceMeters: number;
          duration: string;
        }>;
      };


      const route = data.routes?.[0];
      if (!route) {
        this.logger.warn('Routes API returned no routes');
        return null;
      }

      const polylineEncoded = route.polyline.encodedPolyline;
      const points = decodePolyline(polylineEncoded);
      const distanceM = route.distanceMeters;
      const durationS = parseInt(route.duration.replace('s', ''), 10);

      const result: ComputedRoute = {
        polylineEncoded,
        points,
        distanceM,
        durationS,
        cacheKey,
        fromCache: false,
      };

      // ── 3. Guardar en cache ───────────────────────────────────────────────
      await this.saveToCache(cacheKey, result);
      this.logger.log(`Route computed fresh: ${distanceM}m, ${durationS}s — cached as ${cacheKey}`);

      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Routes API error: ${msg}`);
      return null;
    }
  }

  private async fetchFromCache(key: string): Promise<Omit<ComputedRoute, 'cacheKey' | 'fromCache'> | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (getServerSupabaseClient() as any)
      .from('route_cache')
      .select('polyline_encoded, distance_m, duration_s')
      .eq('cache_key', key)
      .single();

    if (!data) return null;

    return {
      polylineEncoded: data['polyline_encoded'] as string,
      points: decodePolyline(data['polyline_encoded'] as string),
      distanceM: data['distance_m'] as number,
      durationS: data['duration_s'] as number,
    };
  }

  private async saveToCache(key: string, route: ComputedRoute): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (getServerSupabaseClient() as any)
      .from('route_cache')
      .upsert({
        cache_key: key,
        polyline_encoded: route.polylineEncoded,
        distance_m: route.distanceM,
        duration_s: route.durationS,
        created_at: new Date().toISOString(),
      });

    if (error) {
      this.logger.error(`Failed to save route to cache: ${error.message}`);
    }
  }
}
