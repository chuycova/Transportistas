'use client';
// ─── features/dashboard/live-map.tsx ─────────────────────────────────────────
// Mapa principal en tiempo real. Incluye:
//   - TrafficLayer: semáforo de tráfico en tiempo real (gratis con Maps JS API)
//   - Route consumption: ruta se divide en "recorrida" (verde) y "pendiente" (azul)
//   - Alerta de desvío: banner animado cuando un vehículo sale de ruta
//   - Notificación browser al detectar primer desvío
//   - Markers SVG con heading, color y ring pulsante si off-route

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  APIProvider,
  Map as GMap,
  AdvancedMarker,
  Polyline,
  useMap,
} from '@vis.gl/react-google-maps';

import { DevPingPanel } from './dev-ping-panel';
import { TrafficLayer } from './traffic-layer';
import { useTrackingStore } from '../../stores/use-tracking-store';
import { useVehicles } from '../vehicles/use-vehicles';
import { useRoutes } from '../routes/use-routes';
import type { LocationWebSocketPayload } from '@zona-zero/domain';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ─── Controlador de foco/pan (debe ser hijo de <GMap>) ────────────────────────
// Lee focusModeVehicleId del store y hace panTo cuando cambia.
function MapFocusController() {
  const map = useMap();
  const focusModeVehicleId = useTrackingStore((s) => s.focusModeVehicleId);
  const clearFocus         = useTrackingStore((s) => s.clearFocus);
  const vehicles           = useTrackingStore((s) => s.vehicles);

  useEffect(() => {
    if (!map || !focusModeVehicleId) return;
    const v = vehicles[focusModeVehicleId];
    if (!v) return;
    map.panTo({ lat: v.lat, lng: v.lng });
    map.setZoom(16);
    clearFocus();
  }, [map, focusModeVehicleId, vehicles, clearFocus]);

  return null;
}

// ─── Controladores de mapa (heading + tipo) ───────────────────────────
// Ambos son imperativos (via useMap) para no crear loops de re-render con vis.gl.
//
// Por qué double-rAF en el heading:
//   vis.gl/react-google-maps aplica sus props internas al mapa TAMBIÉN con un
//   effect. El orden de effects en React es: hijos primero, padres después.
//   Pero vis.gl usa su propia cola interna que puede ejecutarse en el mismo frame.
//   Con double-rAF, nuestro setHeading corre en el 2º frame tras el render,
//   DESPUÉS de que vis.gl termine, sin que él lo pueda sobrescribir.
function MapHeadingController({ heading, isSatellite }: { heading: number; isSatellite: boolean }) {
  const map = useMap();

  // ─ Tipo de mapa ─ (independiente del heading)
  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(isSatellite ? 'hybrid' : 'roadmap');
  }, [map, isSatellite]);

  // ─ Heading ─ (double-rAF para ejecutar DESPUÉS de vis.gl)
  useEffect(() => {
    if (!map) return;
    let raf1: number, raf2: number;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        map.setHeading(heading);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [map, heading]);

  return null;
}

const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 };

// ─── Utilidades geométricas ───────────────────────────────────────────────────

interface LatLng { lat: number; lng: number }

/** Distancia Haversine en metros entre dos puntos */
function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Divide la polyline de una ruta en dos segmentos:
 *  - consumed: puntos hasta la posición más cercana del vehículo (verde)
 *  - remaining: desde ese punto al destino (azul)
 * Si el vehículo está a más de TOLERANCE_M de la ruta, no consume nada.
 */
const TOLERANCE_M = 80;

function splitRoute(
  polyline: LatLng[],
  vehicle: LatLng,
): { consumed: LatLng[]; remaining: LatLng[] } {
  if (polyline.length === 0) return { consumed: [], remaining: polyline };

  let closestIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const d = haversineMeters(vehicle, polyline[i]);
    if (d < minDist) { minDist = d; closestIdx = i; }
  }

  if (minDist > TOLERANCE_M) {
    // Vehículo fuera de ruta — no consumir visualmente
    return { consumed: [], remaining: polyline };
  }

  return {
    consumed: polyline.slice(0, closestIdx + 1),
    remaining: polyline.slice(closestIdx),
  };
}

// ─── Solicitar permiso de notificaciones del browser ─────────────────────────
function requestNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

function sendDeviationNotification(plate: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(`⚠️ Vehículo fuera de ruta`, {
      body: `${plate} se ha desviado de la ruta asignada`,
      icon: '/favicon.ico',
    });
  }
}

// ─── Marker SVG ───────────────────────────────────────────────────────────────
function VehicleMarkerSvg({
  color, heading, off, flash,
}: {
  color: string; heading: number; off: boolean; flash: boolean;
}) {
  return (
    <div style={{ transform: `rotate(${heading}deg)`, transition: 'transform 0.6s ease', transformOrigin: '20px 28px' }}>
      <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <title>vehicle marker</title>
        {/* Ring de foco — solo cuando se selecciona desde el sidebar (flash) */}
        {flash && (
          <circle cx="20" cy="28" r="18" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.9">
            <animate attributeName="r" values="14;20;14" dur="0.6s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="1;0.2;1" dur="0.6s" repeatCount="indefinite" />
          </circle>
        )}
        {/* Ring de desvío — rojo, solo cuando off=true */}
        {off && !flash && (
          <circle cx="20" cy="28" r="17" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeOpacity="0.6">
            <animate attributeName="r" values="13;19;13" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}
        {/* Cuerpo */}
        <circle cx="20" cy="28" r="12" fill={off ? '#ef4444' : flash ? '#f59e0b' : color} stroke="white" strokeWidth="2.5" />
        {/* Flecha de dirección */}
        <path d="M20 6 L15 20 L20 16 L25 20 Z" fill={off ? '#ef4444' : flash ? '#f59e0b' : color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── Alerta de desvío ─────────────────────────────────────────────────────────
function DeviationAlert({ vehicles }: { vehicles: Array<{ label: string }> }) {
  if (vehicles.length === 0) return null;
  return (
    <div className="absolute top-14 left-1/2 z-20 -translate-x-1/2 pointer-events-none">
      <div
        className="flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-white text-sm font-bold shadow-2xl shadow-destructive/40"
        style={{ animation: 'deviation-pulse 2s ease-in-out infinite' }}
      >
        {/* SVG triángulo de advertencia inline para no añadir deps de icons */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        {vehicles.length === 1
          ? `${vehicles[0].label} fuera de ruta`
          : `${vehicles.length} vehículos fuera de ruta`}
      </div>
      <style>{`
        @keyframes deviation-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.92; }
        }
      `}</style>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function LiveMap() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const supabase = createSupabaseBrowserClient();

  const liveVehicles   = useTrackingStore((s) => s.vehicles);
  const trails         = useTrackingStore((s) => s.trails);
  const updateVehicle  = useTrackingStore((s) => s.updateVehicleLocation);
  const appendTrail    = useTrackingStore((s) => s.appendTrail);
  const isConnected    = useTrackingStore((s) => s.isConnected);
  const flashVehicleId = useTrackingStore((s) => s.flashVehicleId);

  const { data: dbVehicles = [] } = useVehicles();
  const { data: routes    = [] } = useRoutes();

  // Tracking de vehículos ya notificados para no spamear notificaciones
  const notifiedRef = useRef<Set<string>>(new Set());

  // Solicitar permiso de notificaciones una vez al montar
  useEffect(() => { requestNotificationPermission(); }, []);

  // Hydrate latest positions al montar
  const hydrate = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const tenantId = user?.user_metadata?.tenant_id as string | undefined;
    if (!tenantId) return;

    const { data } = await supabase.rpc('get_latest_locations', { p_tenant_id: tenantId });
    if (!data) return;

    for (const row of data as {
      vehicle_id: string; lat: number; lng: number;
      speed_kmh: number; heading_deg: number; is_off_route: boolean;
    }[]) {
      const payload: LocationWebSocketPayload = {
        v: row.vehicle_id, lat: row.lat, lng: row.lng,
        s: row.speed_kmh, h: row.heading_deg,
        off: row.is_off_route || undefined,
      };
      updateVehicle(payload);
      appendTrail(row.vehicle_id, row.lat, row.lng);
    }
  }, [supabase, updateVehicle, appendTrail]);

  useEffect(() => { void hydrate(); }, [hydrate]);

  // ── Lookup vehicleId → DB record ──────────────────────────────────────────
  const vehicleMap = Object.fromEntries(dbVehicles.map((v) => [v.id, v]));
  const liveList = Object.values(liveVehicles);

  // ── Vehículos fuera de ruta → alerta + notificación ───────────────────────
  const offRouteVehicles = liveList
    .filter((v) => v.off)
    .map((v) => {
      const db = vehicleMap[v.v];
      const label = db?.alias ?? db?.plate ?? v.v.slice(0, 6);
      // Primera vez que se detecta: enviar notificación browser
      if (!notifiedRef.current.has(v.v)) {
        notifiedRef.current.add(v.v);
        sendDeviationNotification(label);
      }
      return { id: v.v, label };
    });

  // Limpiar notificados cuando vuelven a ruta
  liveList.filter((v) => !v.off).forEach((v) => notifiedRef.current.delete(v.v));

  // ── Route consumption: una ruta activa por vehículo ───────────────────────
  // Asocia cada vehículo con la ruta activa más cercana y la divide en
  // segmento recorrido (verde) y pendiente (azul)
  const routeSegments = routes
    .filter((r) => r.status === 'active' && r.polyline_coords)
    .flatMap((r) => {
      const polyline = (r.polyline_coords as [number, number][]).map(
        ([lng, lat]) => ({ lat, lng }),
      );

      // Buscar vehículo asignado a esta ruta (coincide con routeId en su estado)
      // Por ahora usamos el vehículo más cercano al primer punto de la ruta
      const firstPt = polyline[0];
      if (!firstPt) return [];

      const assignedVehicle = liveList
        .filter((v) => !v.off)   // solo los que están en ruta
        .sort((a, b) =>
          haversineMeters(firstPt, a) - haversineMeters(firstPt, b),
        )[0];

      if (!assignedVehicle) {
        // Sin vehículo asignado → mostrar ruta completa como pendiente
        return [{ id: r.id, consumed: [] as LatLng[], remaining: polyline }];
      }

      const { consumed, remaining } = splitRoute(polyline, assignedVehicle);
      return [{ id: r.id, consumed, remaining }];
    });

  // ── Centro del mapa ────────────────────────────────────────────────
  const mapCenter = liveList.length > 0
    ? { lat: liveList[0].lat, lng: liveList[0].lng }
    : DEFAULT_CENTER;

  // ── Estado del mapa ───────────────────────────────────────────────
  const [mapHeading,  setMapHeading]  = useState(0);
  const [isSatellite, setIsSatellite] = useState(false);
  const rotateLeft  = () => setMapHeading((h) => (h - 15 + 360) % 360);
  const rotateRight = () => setMapHeading((h) => (h + 15) % 360);
  const resetNorth  = () => setMapHeading(0);

  return (
    <div className="absolute inset-0 bg-card">
      {/* ── Badge: conexión en vivo ── */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full border border-border/50 bg-card/80 px-3 py-1.5 text-xs backdrop-blur-sm shadow-lg">
        <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`} />
        <span className={isConnected ? 'text-emerald-400' : 'text-muted-foreground'}>
          {isConnected ? 'En vivo' : 'Sin conexión'}
        </span>
        {liveList.length > 0 && (
          <span className="ml-1 text-muted-foreground">
            · {liveList.length} activo{liveList.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Alerta de desvío ── */}
      <DeviationAlert vehicles={offRouteVehicles} />

      {/* ── Mapa ── */}
      <div className="w-full h-full">
        <APIProvider apiKey={apiKey}>
          <GMap
            mapId="DEMO_MAP_ID"
            defaultZoom={13}
            defaultCenter={mapCenter}
            gestureHandling="greedy"
            disableDefaultUI={true}
            style={{ width: '100%', height: '100%' }}
          >
            {/* Controlador de pan/zoom al hacer doble click en sidebar */}
            <MapFocusController />
            {/* Controlador de rotación 2D + tipo de mapa — imperativo */}
            <MapHeadingController heading={mapHeading} isSatellite={isSatellite} />
            <TrafficLayer />

            {/* Segmento RECORRIDO de cada ruta (verde semitransparente) */}
            {routeSegments.map(({ id, consumed }) =>
              consumed.length > 1 ? (
                <Polyline
                  key={`consumed-${id}`}
                  path={consumed}
                  strokeColor="#22c55e"
                  strokeWeight={5}
                  strokeOpacity={0.55}
                />
              ) : null,
            )}

            {/* Segmento PENDIENTE de cada ruta (índigo sólido) */}
            {routeSegments.map(({ id, remaining }) =>
              remaining.length > 1 ? (
                <Polyline
                  key={`remaining-${id}`}
                  path={remaining}
                  strokeColor="#6366f1"
                  strokeWeight={4}
                  strokeOpacity={0.85}
                />
              ) : null,
            )}

            {/* Trails de posición (breadcrumb) por vehículo */}
            {liveList.map((v) => {
              const trail = trails[v.v];
              if (!trail || trail.length < 2) return null;
              const color = vehicleMap[v.v]?.color ?? '#6366f1';
              return (
                <Polyline
                  key={`trail-${v.v}`}
                  path={trail}
                  strokeColor={color}
                  strokeWeight={3}
                  strokeOpacity={0.45}
                />
              );
            })}

            {/* Markers de vehículos en vivo */}
            {liveList.map((v) => {
              const db    = vehicleMap[v.v];
              const color = db?.color ?? '#6366f1';
              const label = db?.alias ?? db?.plate ?? v.v.slice(0, 6);
              return (
                <AdvancedMarker
                  key={v.v}
                  position={{ lat: v.lat, lng: v.lng }}
                  title={`${label} · ${Math.round(v.s ?? 0)} km/h`}
                >
                  {/*
                    ANCHOR FIX (definitivo v3):
                    AdvancedMarkerElement ancla en el BOTTOM-CENTER del elemento.

                    El SVG tiene cx=20, cy=28. Usamos un contenedor de exactamente
                    40×28px con overflow:visible:
                      - bottom-center del contenedor = (20px, 28px) = cy del círculo
                      - ese punto queda un ancla en la coordenada geográfica
                      - el SVG completo (flecha, círculo, anillos) y el label desbordant
                        visualmente por overflow:visible sin afectar el bounding box

                    Esto funciona a cualquier nivel de zoom porque el tamaño del
                    contenedor está en píxeles fijos de pantalla.
                  */}
                  <div
                    className="vehicle-marker-group"
                    style={{
                      width: '40px',
                      height: '28px',   // ← exactamente cy del círculo
                      overflow: 'visible',
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0 }}>
                      <VehicleMarkerSvg
                        color={color}
                        heading={v.h ?? 0}
                        off={v.off ?? false}
                        flash={flashVehicleId === v.v}
                      />
                      {/* Label: oculto por defecto, visible en hover del grupo */}
                      <span
                        className="vehicle-marker-label rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white shadow-md"
                        style={{
                          backgroundColor: flashVehicleId === v.v ? '#f59e0b'
                            : v.off ? '#ef4444'
                            : color,
                          display: 'block',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          marginTop: '2px',
                          opacity: 0,
                          transform: 'translateY(4px) scale(0.9)',
                          transition: 'opacity 0.18s ease, transform 0.18s ease',
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  </div>
                </AdvancedMarker>
              );
            })}
          </GMap>
        </APIProvider>
      </div>

      {/* ── Controles del mapa (abajo-derecha) ───────────────── */}
      <div
        className="absolute bottom-6 right-4 z-10 flex flex-col items-center gap-2"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
      >

        {/* ─ Toggle satélite/mapa ─ */}
        <button
          type="button"
          onClick={() => setIsSatellite((s) => !s)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur-sm transition-all text-xs font-bold ${
            isSatellite
              ? 'bg-primary border-primary text-white'
              : 'bg-card/90 border-border/60 text-foreground hover:bg-primary/10'
          }`}
          title={isSatellite ? 'Ver mapa normal' : 'Ver satélite'}
        >
          {isSatellite ? '🗺' : '🛰'}
        </button>

        {/* ─ Separador ─ */}
        <div className="w-5 border-t border-border/40" />

        {/* ─ Brujula visual (muestra heading actual) ─ */}
        <div
          className="flex items-center justify-center rounded-full bg-card/90 border border-border/60 backdrop-blur-sm"
          style={{ width: 36, height: 36 }}
          title={`Rumbo: ${Math.round(mapHeading)}°`}
        >
          <svg
            width="20" height="20" viewBox="0 0 20 20"
            style={{ transform: `rotate(${mapHeading}deg)`, transition: 'transform 0.2s ease' }}
          >
            <polygon points="10,1 12.5,10 10,8 7.5,10" fill="#ef4444" />
            <polygon points="10,19 12.5,10 10,12 7.5,10" fill="#94a3b8" />
          </svg>
        </div>

        {/* ─ Rotar izquierda ─ */}
        <button
          type="button"
          onClick={rotateLeft}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-card/90 border border-border/60 text-foreground hover:bg-primary hover:text-white hover:border-primary backdrop-blur-sm transition-all text-sm font-bold"
          title="Rotar izquierda (−15°)"
        >
          ↺
        </button>

        {/* ─ Reset norte ─ */}
        <button
          type="button"
          onClick={resetNorth}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-card/90 border border-border/60 text-[10px] font-black text-foreground hover:bg-primary hover:text-white hover:border-primary backdrop-blur-sm transition-all"
          title="Orientar al norte"
          style={{ opacity: mapHeading === 0 ? 0.4 : 1, transition: 'opacity 0.2s' }}
        >
          N
        </button>

        {/* ─ Rotar derecha ─ */}
        <button
          type="button"
          onClick={rotateRight}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-card/90 border border-border/60 text-foreground hover:bg-primary hover:text-white hover:border-primary backdrop-blur-sm transition-all text-sm font-bold"
          title="Rotar derecha (+15°)"
        >
          ↻
        </button>

      </div>

      {/* Panel de dev (solo en desarrollo) */}
      {process.env.NODE_ENV === 'development' && <DevPingPanel />}

      {/* Overlay si falta la API key */}
      {!apiKey && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-destructive/20 text-destructive border border-destructive/50 p-6 rounded-xl shadow-2xl flex flex-col items-center gap-2 max-w-md text-center">
            <span className="text-2xl font-bold">!</span>
            <h3 className="font-bold text-lg text-foreground">Google Maps API Key Requerida</h3>
            <p className="text-sm">Configura <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> en tu archivo <code>.env</code> web.</p>
          </div>
        </div>
      )}
    </div>
  );
}
