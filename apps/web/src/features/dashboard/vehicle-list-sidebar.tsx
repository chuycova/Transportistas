'use client';
// ─── features/dashboard/vehicle-list-sidebar.tsx ─────────────────────────────
// Sidebar con lista de vehículos. Cada card tiene un mini-desplegable que
// muestra la ruta asignada, % recorrido y estado de desvío.

import { useState } from 'react';
import { useTrackingStore } from '../../stores/use-tracking-store';
import { useVehicles } from '../vehicles/use-vehicles';
import { useRoutes } from '../routes/use-routes';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, ChevronDown, ChevronUp, MapPin, AlertTriangle, CheckCircle2, Navigation } from 'lucide-react';

// ─── Haversine para calcular % de ruta recorrida ─────────────────────────────
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
  // Si el vehículo está demasiado lejos de la ruta (desvío), igualmente
  // calculamos el progreso al punto más cercano como referencia
  return Math.round((closestIdx / Math.max(polyline.length - 1, 1)) * 100);
}

// ─── Mini-desplegable de ruta ─────────────────────────────────────────────────
interface RouteDropdownProps {
  vehicleId: string;
  isOffRoute: boolean;
  lat?: number;
  lng?: number;
}

function RouteDropdown({ vehicleId: _vehicleId, isOffRoute, lat, lng }: RouteDropdownProps) {
  const { data: routes = [] } = useRoutes();

  // Encontrar la ruta activa (simplificado: primera ruta activa)
  // En producción esto vendría del campo vehicle.assigned_route_id
  const activeRoute = routes.find((r) => r.status === 'active');

  if (!activeRoute) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 italic">
        <MapPin className="h-3 w-3" />
        Sin ruta asignada
      </div>
    );
  }

  const polyline: LatLng[] = activeRoute.polyline_coords
    ? (activeRoute.polyline_coords as [number, number][]).map(([lngV, latV]) => ({ lat: latV, lng: lngV }))
    : [];

  const progress = lat !== undefined && lng !== undefined && polyline.length > 0
    ? routeProgress(polyline, { lat, lng })
    : null;

  const distanceKm = activeRoute.total_distance_m
    ? (activeRoute.total_distance_m / 1000).toFixed(1)
    : null;

  return (
    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
      {/* Nombre de ruta */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Navigation className="h-3 w-3 flex-shrink-0 text-primary/70" />
          <span className="text-[11px] font-semibold text-foreground truncate">
            {activeRoute.name}
          </span>
        </div>
        {/* Badge estado */}
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
            <span className="text-[10px] font-bold text-foreground">{progress}%
              {distanceKm && <span className="text-muted-foreground font-normal"> · {distanceKm} km total</span>}
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

      {/* Mensaje de desvío */}
      {isOffRoute && (
        <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-2 py-1.5">
          <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
          <span className="text-[10px] text-destructive font-medium">
            Vehículo fuera del corredor de ruta
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar principal ────────────────────────────────────────────────────────
export function VehicleListSidebar() {
  const { data: dbVehicles = [], isLoading } = useVehicles();
  const liveVehicles = useTrackingStore((state) => state.vehicles);
  const router = useRouter();

  // Estado de expansión por vehículo — qué cards tienen el desplegable abierto
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
    <div className="w-[320px] bg-card/80 backdrop-blur-3xl border-r border-border h-full flex flex-col z-10 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]">
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
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded-xl border transition-all ${
                isOffRoute
                  ? 'border-destructive/50 bg-destructive/5 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                  : hasLive
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border/50 bg-background/40'
              }`}
            >
              {/* Card principal — clickable para expandir */}
              <button
                type="button"
                onClick={() => toggleExpanded(v.id)}
                className="w-full p-4 text-left"
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

                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      isOffRoute ? 'bg-destructive/20 text-destructive' :
                      hasLive ? 'bg-primary/20 text-primary' :
                      'bg-muted/40 text-muted-foreground'
                    }`}>
                      {isOffRoute ? '⚠ DESVÍO' : hasLive ? 'EN RUTA' : 'OFFLINE'}
                    </span>
                    {/* Chevron desplegable */}
                    {isExpanded
                      ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>
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

              {/* Mini-desplegable de ruta */}
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
