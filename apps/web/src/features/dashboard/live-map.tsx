'use client';
// ─── features/dashboard/live-map.tsx ─────────────────────────────────────────
// Mapa principal en tiempo real. Incluye:
//   - TrafficLayer: semáforo de tráfico en tiempo real (gratis con Maps JS API)
//   - Route consumption: ruta se divide en "recorrida" (verde) y "pendiente" (azul)
//   - Alerta de desvío: banner animado cuando un vehículo sale de ruta
//   - Notificación browser al detectar primer desvío
//   - Markers SVG con heading, color y ring pulsante si off-route

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
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

// ─── Controlador de mapa ──────────────────────────────────────────────────────
// Maneja mapTypeId (roadmap/hybrid).
// Heading + tilt quedan en manos del rotateControl nativo de Google Maps,
// que provee compás + arrastre para rotar/inclinar sin conflictos.
function MapViewController({ isSatellite }: { isSatellite: boolean }) {
  const map = useMap();

  // ─ Tipo de mapa: double-rAF para evitar race con vis.gl ─
  // 'hybrid' = satélite + overlay de calles (único modo satélite en vector maps)
  useEffect(() => {
    if (!map) return;
    let raf1: number, raf2: number;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        map.setMapTypeId(isSatellite ? 'hybrid' : 'roadmap');
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [map, isSatellite]);

  return null;
}

// ─── Botones de rotación (estilo Google Maps) ─────────────────────────────────
// Se montan dentro de <GMap> para poder usar useMap().
// Se ubican a la izquierda de los controles nativos de Google (zoom/compás).
// El <style> inyectado también redondea los botones +/- de zoom de Google.
function MapRotationControls({ isDark }: { isDark: boolean }) {
  const map = useMap();

  const rotate = useCallback((delta: number) => {
    if (!map) return;
    map.setHeading(((map.getHeading() ?? 0) + delta + 360) % 360);
  }, [map]);

  // Paleta idéntica a la que usa Google Maps internamente
  const bg    = isDark ? '#3c4043' : '#ffffff';
  const bgHov = isDark ? '#515558' : '#ebebeb';
  const fg    = isDark ? '#e8eaed' : '#666666';
  const shdw  = isDark
    ? '0 1px 4px -1px rgba(0,0,0,0.65)'
    : '0 1px 4px -1px rgba(0,0,0,0.30)';

  return (
    <>
      <style>{`
        .zz-rot-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          background: ${bg};
          color: ${fg};
          box-shadow: ${shdw};
          font-size: 16px;
          line-height: 1;
          font-family: Roboto, Arial, sans-serif;
          transition: background 0.15s ease, color 0.15s ease;
          -webkit-font-smoothing: antialiased;
          user-select: none;
        }
        .zz-rot-btn:hover  { background: ${bgHov}; }
        .zz-rot-btn:active { background: ${isDark ? '#60646a' : '#d5d5d5'}; }

        /* ── Redondear botones +/− de zoom nativos de Google Maps ── */
        /* Selector estable: aria-label en inglés y español              */
        button[aria-label="Zoom in"],
        button[aria-label="Acercar"],
        button[aria-label="Zoom out"],
        button[aria-label="Alejar"] {
          border-radius: 8px !important;
          overflow: hidden !important;
        }
        /* Contenedor del stack zoom (wrapper visual) */
        .gm-bundled-control-on-bottom > div:last-child > div {
          border-radius: 8px !important;
          overflow: hidden !important;
        }
      `}</style>

      {/* Panel: 2 botones apilados, alineados con los controles nativos */}
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          right: 50,       // justo a la izquierda del stack zoom de Google (~40px ancho)
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          zIndex: 2,
        }}
      >
        <button
          type="button"
          className="zz-rot-btn"
          onClick={() => rotate(-45)}
          title="Rotar izquierda (−45°)"
          aria-label="Rotar izquierda"
        >
          ↺
        </button>
        <button
          type="button"
          className="zz-rot-btn"
          onClick={() => rotate(45)}
          title="Rotar derecha (+45°)"
          aria-label="Rotar derecha"
        >
          ↻
        </button>
      </div>
    </>
  );
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
  // El color base del marcador siempre es el del vehículo.
  // off → ring rojo + cuerpo rojo. flash → ring ámbar pulsante PERO cuerpo mantiene color propio.
  const bodyColor = off ? '#ef4444' : color;
  return (
    <div style={{ transform: `rotate(${heading}deg)`, transition: 'transform 0.6s ease', transformOrigin: '20px 28px' }}>
      <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <title>vehicle marker</title>
        {/* Ring de foco ámbar — identifica el vehículo seleccionado sin cambiarle el color */}
        {flash && (
          <circle cx="20" cy="28" r="18" fill="none" stroke="#f59e0b" strokeWidth="3" strokeOpacity="0.95">
            <animate attributeName="r" values="14;20;14" dur="0.6s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="1;0.2;1" dur="0.6s" repeatCount="indefinite" />
          </circle>
        )}
        {/* Ring de desvío rojo — solo cuando off=true y no hay flash */}
        {off && !flash && (
          <circle cx="20" cy="28" r="17" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeOpacity="0.6">
            <animate attributeName="r" values="13;19;13" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}
        {/* Cuerpo — siempre en el color original del vehículo (o rojo si off-route) */}
        <circle cx="20" cy="28" r="12" fill={bodyColor} stroke="white" strokeWidth="2.5" />
        {/* Flecha de dirección — mismo color que el cuerpo */}
        <path d="M20 6 L15 20 L20 16 L25 20 Z" fill={bodyColor} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
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
  // Un Map ID real (creado en Cloud Console con rendering=Vector) es requerido
  // para que setHeading() funcione. "DEMO_MAP_ID" solo sirve en dev con clave
  // de prueba — con clave de producción Google fuerza raster y bloquea rotación.
  const mapId  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? '';
  // useMemo garantiza una única instancia estable por montaje.
  // Sin esto, cada re-render (disparado por Socket.IO) crea un nuevo objeto
  // → hydrate() se invalida → el effect re-corre → DB snapshot (N-1 pasos)
  // sobreescribe la posición actual → marker retrocede cada tick.
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const liveVehicles   = useTrackingStore((s) => s.vehicles);
  const trails         = useTrackingStore((s) => s.trails);
  const activeRoutes   = useTrackingStore((s) => s.activeRoutes);
  const navRoutes      = useTrackingStore((s) => s.navRoutes);
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
    const { data: { session } } = await supabase.auth.getSession();
    const tenantId = session?.user?.user_metadata?.tenant_id as string | undefined;
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
  // Asocia cada ruta con su vehículo y divide en segmento recorrido/pendiente
  // SOLO para la ruta que el vehículo está activamente trackeando
  const activeRouteIds = new Set(Object.values(activeRoutes));
  const routeSegments = routes
    .filter((r) => r.status === 'active' && r.polyline_coords)
    .flatMap((r) => {
      const polyline = (r.polyline_coords as [number, number][]).map(
        ([lng, lat]) => ({ lat, lng }),
      );

      if (!polyline[0]) return [];

      // Usar el vehículo REALMENTE asignado y que esté activamente trackeando ESTA ruta
      const assignedVehicle = r.vehicle_id ? liveVehicles[r.vehicle_id] : undefined;
      const isActivelyTracked = activeRouteIds.has(r.id);

      if (!assignedVehicle || !isActivelyTracked) {
        // Sin vehículo activo en ESTA ruta → ruta completa como pendiente
        return [{ id: r.id, consumed: [] as LatLng[], remaining: polyline }];
      }

      const { consumed, remaining } = splitRoute(polyline, assignedVehicle);
      return [{ id: r.id, consumed, remaining }];
    });

  // ── Centro del mapa ────────────────────────────────────────────────
  const mapCenter = liveList.length > 0
    ? { lat: liveList[0].lat, lng: liveList[0].lng }
    : DEFAULT_CENTER;

  // ── Estado del mapa (isDark persiste en localStorage) ────────────
  const [isSatellite, setIsSatellite] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('zz-map-dark');
    return stored !== null ? stored === '1' : true;
  });
  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('zz-map-dark', next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <div className="absolute inset-0 bg-card">
      {/* ── Controles superiores derecha: tema + satélite + tráfico + conexión ── */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">

        {/* Toggle tema oscuro/claro */}
        <button
          type="button"
          onClick={toggleDark}
          className="flex items-center justify-center rounded-lg px-2.5 py-1.5 shadow-lg border bg-card/95 border-border/70 text-foreground hover:bg-card transition-all"
          title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {isDark ? (
            // Sol
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4"/>
              <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            // Luna
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        {/* Toggle satélite */}
        <button
          type="button"
          onClick={() => setIsSatellite((s) => !s)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-lg border bg-card/95 border-border/70 text-foreground hover:bg-card transition-all"
          title={isSatellite ? 'Vista mapa' : 'Vista satélite'}
          aria-pressed={isSatellite}
        >
          {isSatellite ? (
            // Icono mapa (volver a roadmap)
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
          ) : (
            // Icono satélite
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="2"/>
              <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>
            </svg>
          )}
          {isSatellite ? 'Mapa' : 'Satelite'}
        </button>

        {/* Toggle tráfico */}
        <button
          type="button"
          onClick={() => setShowTraffic((t) => !t)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-lg border transition-all ${
            showTraffic
              ? 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700'
              : 'bg-card/95 border-border/70 text-muted-foreground hover:text-foreground hover:bg-card'
          }`}
          title={showTraffic ? 'Ocultar tráfico' : 'Mostrar tráfico'}
          aria-pressed={showTraffic}
        >
          {/* Semaforo SVG */}
          <svg width="12" height="14" viewBox="0 0 12 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1" y="1" width="10" height="18" rx="3"/>
            <circle cx="6" cy="5" r="1.5" fill="currentColor" stroke="none" opacity={showTraffic ? 1 : 0.4}/>
            <circle cx="6" cy="10" r="1.5" fill="currentColor" stroke="none" opacity={showTraffic ? 1 : 0.4}/>
            <circle cx="6" cy="15" r="1.5" fill="currentColor" stroke="none" opacity={showTraffic ? 1 : 0.4}/>
          </svg>
          {showTraffic ? 'Trafico' : 'Sin trafico'}
        </button>

        {/* Badge: conexión en vivo */}
        <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/80 px-3 py-1.5 text-xs backdrop-blur-sm shadow-lg">
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
      </div>

      {/* ── Alerta de desvío ── */}
      <DeviationAlert vehicles={offRouteVehicles} />

      {/* ── Mapa ── */}
      <div className="w-full h-full">
        <APIProvider apiKey={apiKey}>
          <GMap
            mapId={mapId || 'DEMO_MAP_ID'}
            defaultZoom={13}
            defaultCenter={mapCenter}
            gestureHandling="greedy"
            colorScheme={isDark ? 'DARK' : 'LIGHT'}
            // Controles nativos de Google Maps
            disableDefaultUI={false}
            zoomControl={true}
            rotateControl={true}
            fullscreenControl={false}
            mapTypeControl={false}
            streetViewControl={false}
            scaleControl={false}
            style={{ width: '100%', height: '100%' }}
          >
            <MapFocusController />
            <MapViewController isSatellite={isSatellite} />
            <MapRotationControls isDark={isDark} />
            {showTraffic && <TrafficLayer />}

            {/* Segmento RECORRIDO de cada ruta — verde semitransparente */}
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

            {/* Segmento PENDIENTE de cada ruta — naranja sólido (ruta asignada) */}
            {routeSegments.map(({ id, remaining }) =>
              remaining.length > 1 ? (
                <Polyline
                  key={`remaining-${id}`}
                  path={remaining}
                  strokeColor="#f97316"
                  strokeWeight={5}
                  strokeOpacity={0.9}
                />
              ) : null,
            )}

            {/* Ruta de navegación: vehículo → primer punto de la ruta asignada */}
            {/* Azul eléctrico para distinguirse de la ruta asignada (naranja) y de los caminos */}
            {Object.entries(activeRoutes).map(([vehicleId, routeId]) => {
              const vehicleLive = liveVehicles[vehicleId];
              if (!vehicleLive) return null;
              const route = routes.find((r) => r.id === routeId);
              if (!route || !route.polyline_coords) return null;
              const coords = route.polyline_coords as [number, number][];
              if (!coords.length) return null;
              const firstWp = { lat: coords[0]![1], lng: coords[0]![0] };
              // Solo mostrar si el vehículo está lejos del primer punto
              const dist = haversineMeters(firstWp, vehicleLive);
              if (dist < 150) return null;

              // Preferir polyline real de Directions API si está disponible
              const navPath = navRoutes[vehicleId];
              const path = navPath && navPath.length >= 2
                ? navPath
                : [{ lat: vehicleLive.lat, lng: vehicleLive.lng }, firstWp];

              return (
                <Polyline
                  key={`nav-start-${vehicleId}`}
                  path={path}
                  strokeColor="#3b82f6"
                  strokeWeight={6}
                  strokeOpacity={1.0}
                  geodesic
                />
              );
            })}

            {/* Trails de posición (breadcrumb) por vehículo — segmentados por on/off route */}
            {liveList.map((v) => {
              const trail = trails[v.v];
              if (!trail || trail.length < 2) return null;
              const baseColor = vehicleMap[v.v]?.color ?? '#6366f1';
              // Segmentar trail en tramos contiguos por estado off-route
              const segments: { off: boolean; path: { lat: number; lng: number }[] }[] = [];
              let currentOff = trail[0]!.off ?? false;
              let currentPath: { lat: number; lng: number }[] = [{ lat: trail[0]!.lat, lng: trail[0]!.lng }];
              for (let i = 1; i < trail.length; i++) {
                const pt = trail[i]!;
                const ptOff = pt.off ?? false;
                if (ptOff !== currentOff) {
                  // Cerrar segmento anterior (incluir punto de transición para continuidad)
                  currentPath.push({ lat: pt.lat, lng: pt.lng });
                  segments.push({ off: currentOff, path: currentPath });
                  currentOff = ptOff;
                  currentPath = [{ lat: pt.lat, lng: pt.lng }];
                } else {
                  currentPath.push({ lat: pt.lat, lng: pt.lng });
                }
              }
              if (currentPath.length >= 2) segments.push({ off: currentOff, path: currentPath });
              return segments.map((seg, si) => (
                <Polyline
                  key={`trail-${v.v}-${si}`}
                  path={seg.path}
                  strokeColor={seg.off ? '#ef4444' : baseColor}
                  strokeWeight={seg.off ? 4 : 3}
                  strokeOpacity={seg.off ? 0.75 : 0.45}
                />
              ));
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

      {/* Badge: sin Map ID → raster, sin rotación */}
      {apiKey && !mapId && (
        <div className="absolute bottom-6 left-4 z-10 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400 backdrop-blur-sm shadow-lg max-w-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Mapa en modo raster — rotación deshabilitada. Configura <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID</code>.</span>
        </div>
      )}

    </div>
  );
}
