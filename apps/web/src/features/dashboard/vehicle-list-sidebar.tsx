'use client';
// ─── features/dashboard/vehicle-list-sidebar.tsx ─────────────────────────────
// Sidebar de vehículos con:
//   - Click simple: parpadea el marker del vehículo en el mapa (flash ámbar)
//   - Doble click: hace pan/zoom del mapa a la posición del vehículo
//   - Mini-desplegable: muestra ruta activa asignada, % recorrido y botón "Agregar ruta"

import { useState, useRef, useCallback } from 'react';
import { useTrackingStore } from '../../stores/use-tracking-store';
import { useVehicles } from '../vehicles/use-vehicles';
import { useRoutes } from '../routes/use-routes';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, ChevronDown, ChevronUp, MapPin, AlertTriangle,
  CheckCircle2, Navigation, Route as RouteIcon, PlusCircle,
} from 'lucide-react';

// ─── Haversine para % de ruta recorrida ──────────────────────────────────────
interface LatLng { lat: number; lng: number }

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

function routeProgress(polyline: LatLng[], vehicle: LatLng): number {
  if (polyline.length === 0) return 0;
  let closestIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < polyline.length; i++) {
    const d = haversineMeters(vehicle, polyline[i]);
    if (d < minDist) { minDist = d; closestIdx = i; }
  }
  return Math.round((closestIdx / Math.max(polyline.length - 1, 1)) * 100);
}

// ─── Mini-desplegable de ruta ─────────────────────────────────────────────────
interface RouteDropdownProps {
  vehicleId: string;
  isOffRoute: boolean;
  lat?: number;
  lng?: number;
}

function RouteDropdown({ vehicleId, isOffRoute, lat, lng }: RouteDropdownProps) {
  const router = useRouter();
  const { data: routes = [] } = useRoutes();

  // Rutas activas del tenant — filtrar por vehicle_id si está disponible,
  // si no, tomar la primera activa (asignación simple)
  const assignedRoutes = routes.filter(
    (r) => r.status === 'active' && (
      // Si la ruta tiene vehicle_id asignado, coincidir con este vehículo
      (r as typeof r & { vehicle_id?: string }).vehicle_id === vehicleId ||
      // Si no tiene vehicle_id, no asignar (ruta libre — no mostrar aquí)
      false
    ),
  );

  // Fallback: primera ruta activa si no hay vehicle_id en ninguna
  const hasVehicleAssignment = routes.some(
    (r) => (r as typeof r & { vehicle_id?: string }).vehicle_id,
  );
  const activeRoute = hasVehicleAssignment
    ? assignedRoutes[0]
    : routes.find((r) => r.status === 'active');

  const polyline: LatLng[] = activeRoute?.polyline_coords
    ? (activeRoute.polyline_coords as [number, number][]).map(([lngV, latV]) => ({ lat: latV, lng: lngV }))
    : [];

  const progress = lat !== undefined && lng !== undefined && polyline.length > 0
    ? routeProgress(polyline, { lat, lng })
    : null;

  const distanceKm = activeRoute?.total_distance_m
    ? (activeRoute.total_distance_m / 1000).toFixed(1)
    : null;

  return (
    <div className="mt-3 pt-3 border-t border-border/30 space-y-2.5">
      {activeRoute ? (
        <>
          {/* Nombre + estado */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Navigation className="h-3 w-3 flex-shrink-0 text-primary/70" />
              <span className="text-[11px] font-semibold text-foreground truncate">
                {activeRoute.name}
              </span>
            </div>
            {isOffRoute ? (
              <div className="flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5 flex-shrink-0">
                <AlertTriangle className="h-2.5 w-2.5" />
                DESVÍO
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full px-1.5 py-0.5 flex-shrink-0">
                <CheckCircle2 className="h-2.5 w-2.5" />
                EN RUTA
              </div>
            )}
          </div>

          {/* Origen → Destino */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="truncate">{activeRoute.origin_name ?? 'Origen'}</span>
            <span className="mx-0.5 opacity-40">→</span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive flex-shrink-0" />
            <span className="truncate">{activeRoute.dest_name ?? 'Destino'}</span>
          </div>

          {/* Barra de progreso */}
          {progress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">Recorrido</span>
                <span className="text-[10px] font-bold text-foreground">
                  {progress}%
                  {distanceKm && (
                    <span className="text-muted-foreground font-normal"> · {distanceKm} km</span>
                  )}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isOffRoute ? 'bg-destructive' : 'bg-emerald-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Alerta de desvío */}
          {isOffRoute && (
            <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-2 py-1.5">
              <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
              <span className="text-[10px] text-destructive font-medium">
                Fuera del corredor de ruta
              </span>
            </div>
          )}
        </>
      ) : (
        /* Sin ruta activa */
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <MapPin className="h-3 w-3" />
          <span>Sin ruta activa asignada</span>
        </div>
      )}

      {/* Botón: ir a crear/ver rutas */}
      <button
        type="button"
        onClick={() => router.push('/routes')}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
      >
        {activeRoute ? (
          <>
            <RouteIcon className="h-3 w-3" />
            Ver rutas
          </>
        ) : (
          <>
            <PlusCircle className="h-3 w-3" />
            Agregar ruta
          </>
        )}
      </button>
    </div>
  );
}

// ─── Sidebar principal ────────────────────────────────────────────────────────
export function VehicleListSidebar() {
  const { data: dbVehicles = [], isLoading } = useVehicles();
  const liveVehicles   = useTrackingStore((state) => state.vehicles);
  const flashVehicle   = useTrackingStore((state) => state.flashVehicle);
  const focusVehicle   = useTrackingStore((state) => state.focusVehicle);
  const router         = useRouter();

  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Refs para scroll al card
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Tracking de doble click por vehículo
  const lastClickRef = useRef<Record<string, number>>({});
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCardClick = useCallback((vehicleId: string) => {
    const now = Date.now();
    const last = lastClickRef.current[vehicleId] ?? 0;
    const isDoubleClick = now - last < 350;

    lastClickRef.current[vehicleId] = now;

    if (isDoubleClick) {
      focusVehicle(vehicleId);
    } else {
      // Flash en el mapa
      flashVehicle(vehicleId);

      // Scroll al card en el sidebar
      const el = cardRefs.current[vehicleId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // Highlight breve: quitar clase anterior antes de reasignar
      // (permite re-trigger si se hace click varias veces al mismo vehículo)
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      setHighlightedId(null);
      // Tick para que React elimine y re-agregue la clase correctamente
      requestAnimationFrame(() => {
        setHighlightedId(vehicleId);
        highlightTimerRef.current = setTimeout(() => setHighlightedId(null), 700);
      });
    }
  }, [flashVehicle, focusVehicle]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const activeCount = dbVehicles.filter((v) => liveVehicles[v.id] || v.status === 'active').length;
  const offRouteCount = Object.values(liveVehicles).filter((v) => v.off).length;

  return (
    <div className="w-[320px] bg-card/80 backdrop-blur-3xl border-r border-border h-full flex flex-col z-10 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)] flex-shrink-0">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Centro de Control
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading
            ? 'Cargando flota...'
            : `Flota: ${dbVehicles.length} · Activos: ${activeCount}`}
        </p>
        {offRouteCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-2.5 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive animate-pulse" />
            <span className="text-xs font-bold text-destructive">
              {offRouteCount} vehículo{offRouteCount > 1 ? 's' : ''} fuera de ruta
            </span>
          </div>
        )}
        {/* Hint de interacción */}
        <p className="mt-2 text-[10px] text-muted-foreground/50">
          Click → resaltar · Doble click → ir al mapa
        </p>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {isLoading && (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        )}

        {!isLoading && dbVehicles.length === 0 && (
          <div className="h-32 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground italic bg-background/30 rounded-lg">
            <Truck className="h-6 w-6 opacity-40" />
            Sin vehículos registrados
          </div>
        )}

        {!isLoading && dbVehicles.map((v) => {
          const live = liveVehicles[v.id];
          const isOffRoute = !!live?.off;
          const isExpanded = expandedIds.has(v.id);
          const hasLive = !!live;

          return (
            <motion.div
              key={v.id}
              layoutId={v.id}
              ref={(el) => { cardRefs.current[v.id] = el; }}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded-xl border transition-all select-none ${
                highlightedId === v.id ? 'sidebar-card-highlight' : ''
              } ${
                isOffRoute
                  ? 'border-destructive/50 bg-destructive/5 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                  : hasLive
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/50 bg-background/40'
              }`}
            >
              {/* Card principal — click para flash/focus + toggle desplegable */}
              <div className="flex">
                {/* Zona de click principal (flash/focus) */}
                <button
                  type="button"
                  onClick={() => handleCardClick(v.id)}
                  className="flex-1 p-4 text-left cursor-pointer"
                  title="Click: resaltar · Doble click: ir al mapa"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${isOffRoute ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: isOffRoute ? '#ef4444' : (v.color ?? '#6366f1') }}
                      />
                      <span className="font-semibold text-foreground text-sm font-mono tracking-wider">
                        {v.plate}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      isOffRoute ? 'bg-destructive/20 text-destructive' :
                      hasLive ? 'bg-primary/20 text-primary' :
                      'bg-muted/40 text-muted-foreground'
                    }`}>
                      {isOffRoute ? '⚠ DESVÍO' : hasLive ? 'EN RUTA' : 'OFFLINE'}
                    </span>
                  </div>

                  {v.alias && (
                    <p className="text-xs text-muted-foreground mb-2 truncate">{v.alias}</p>
                  )}

                  {hasLive ? (
                    <div className="flex items-end justify-between text-muted-foreground">
                      <span className="text-xs font-mono bg-background/50 px-2 py-1 rounded">
                        {live.lat.toFixed(4)}, {live.lng.toFixed(4)}
                      </span>
                      <div className="text-right">
                        <span className="text-xl font-bold text-foreground">{Math.round(live.s ?? 0)}</span>
                        <span className="text-[10px] ml-1 opacity-70">km/h</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/50">Sin señal GPS</p>
                  )}
                </button>

                {/* Botón de expansión del mini-menú */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(v.id)}
                  className="flex items-start pt-4 pr-3 text-muted-foreground hover:text-foreground transition-colors"
                  title={isExpanded ? 'Cerrar ruta' : 'Ver ruta'}
                >
                  {isExpanded
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />
                  }
                </button>
              </div>

              {/* Mini-desplegable */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    key="route-detail"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      <RouteDropdown
                        vehicleId={v.id}
                        isOffRoute={isOffRoute}
                        lat={live?.lat}
                        lng={live?.lng}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border/50 bg-background/20">
        <button
          type="button"
          onClick={() => router.push('/vehicles')}
          className="w-full py-2.5 rounded-lg border border-border/50 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors text-sm font-medium"
        >
          Gestionar Flotilla
        </button>
      </div>
    </div>
  );
}
