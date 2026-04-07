// Value Object: Coordinate
// Representa un punto GPS inmutable. Siempre en WGS84 (sistema GPS estándar).

export interface Coordinate {
  readonly lat: number;
  readonly lng: number;
}

// ─── Constructores y Validaciones ─────────────────────────────

/** Crea y valida una coordenada. Lanza error si está fuera de rango. */
export function createCoordinate(lat: number, lng: number): Coordinate {
  if (lat < -90 || lat > 90) {
    throw new Error(`Latitud inválida: ${lat}. Debe estar entre -90 y 90.`);
  }
  if (lng < -180 || lng > 180) {
    throw new Error(`Longitud inválida: ${lng}. Debe estar entre -180 y 180.`);
  }
  return Object.freeze({ lat, lng });
}

/** Convierte de formato [lng, lat] (GeoJSON) a Coordinate */
export function fromGeoJson(position: [number, number]): Coordinate {
  return createCoordinate(position[1], position[0]);
}

/** Convierte Coordinate a formato GeoJSON [lng, lat] */
export function toGeoJson(coord: Coordinate): [number, number] {
  return [coord.lng, coord.lat];
}

/** Compara dos coordenadas con tolerancia de decimales (evita comparación de floats directa) */
export function coordinatesEqual(
  a: Coordinate,
  b: Coordinate,
  toleranceDeg = 0.000001,
): boolean {
  return (
    Math.abs(a.lat - b.lat) <= toleranceDeg &&
    Math.abs(a.lng - b.lng) <= toleranceDeg
  );
}

/**
 * Calcula distancia aproximada entre dos puntos usando la fórmula de Haversine.
 * Retorna distancia en METROS.
 * Nota: Para detección de desvíos se usa ST_Distance de PostGIS en el servidor,
 * pero este método es útil en el cliente móvil para estimaciones sin red.
 */
export function haversineDistanceM(a: Coordinate, b: Coordinate): number {
  const R = 6_371_000; // Radio de la Tierra en metros
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;

  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Calcula la distancia perpendicular (Cross-Track Error) desde un punto
 * al segmento de línea más cercano de una ruta.
 * Útil para estimación de desvíos en el dispositivo móvil (offline).
 * Para la detección oficial se usa ST_DWithin en PostGIS.
 */
export function crossTrackDistanceM(
  point: Coordinate,
  polyline: readonly Coordinate[],
): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineDistanceM(point, polyline[0]!);

  let minDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segStart = polyline[i]!;
    const segEnd = polyline[i + 1]!;
    const d = pointToSegmentDistanceM(point, segStart, segEnd);
    if (d < minDistance) minDistance = d;
  }

  return minDistance;
}

/** Distancia de un punto a un segmento de línea (en metros, aproximación plana para segmentos cortos) */
function pointToSegmentDistanceM(
  p: Coordinate,
  a: Coordinate,
  b: Coordinate,
): number {
  const abLat = b.lat - a.lat;
  const abLng = b.lng - a.lng;
  const abLenSq = abLat ** 2 + abLng ** 2;

  if (abLenSq === 0) return haversineDistanceM(p, a);

  const t = Math.max(
    0,
    Math.min(1, ((p.lat - a.lat) * abLat + (p.lng - a.lng) * abLng) / abLenSq),
  );

  const closest: Coordinate = {
    lat: a.lat + t * abLat,
    lng: a.lng + t * abLng,
  };

  return haversineDistanceM(p, closest);
}
