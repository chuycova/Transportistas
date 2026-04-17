'use client';
// ─── features/routes/route-detail-page.tsx ───────────────────────────────────
// Página de detalle de ruta.
// Layout compacto por defecto (minimap SVG + lista) → modo mapa expandido al
// presionar "Ver en mapa". Cuando está expandido, seleccionar un conductor
// muestra su trail GPS en tiempo real.

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Route, MapPin, Clock, Ruler, AlertTriangle,
  Car, User, CheckCircle2, Circle, Loader2, Pencil,
  Maximize2, Minimize2, Navigation,
} from 'lucide-react';
import {
  APIProvider, Map as GMap, AdvancedMarker, Polyline,
} from '@vis.gl/react-google-maps';
import {
  useRoute, useUpdateRouteStatus, useDeleteRoute,
} from './use-routes';
import {
  RouteSettingsSection, CheckpointsSection, TollBoothsSection, RouteAlternativesSection,
} from './route-sections';
import { useVehicles } from '../vehicles/use-vehicles';
import { useUsers } from '../users/use-users';
import { useTrackingStore } from '../../stores/use-tracking-store';
import { AssignDriverModal } from './assign-driver-modal';
import { useState, useMemo } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDistance(m: number | null): string {
  if (!m) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function fmtDuration(s: number | null): string {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

const STATUS_META: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  active:    { label: 'Activa',     className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 className="h-3 w-3" /> },
  inactive:  { label: 'Inactiva',   className: 'bg-muted/30 text-muted-foreground border-border',           icon: <Circle className="h-3 w-3" /> },
  pending:   { label: 'Pendiente',  className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',        icon: <AlertTriangle className="h-3 w-3" /> },
  completed: { label: 'Completada', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30',           icon: <CheckCircle2 className="h-3 w-3" /> },
};

// ─── Minimap SVG ──────────────────────────────────────────────────────────────
// Renderiza la polilínea de la ruta normalizada en un viewport SVG pequeño.
// No requiere API key ni peticiones externas.

function RouteMinimap({
  coords, width = 340, height = 160, routeColor = '#6366f1',
}: {
  coords: [number, number][]; // [lng, lat] orden GeoJSON
  width?: number;
  height?: number;
  routeColor?: string;
}) {
  const PAD = 16;

  const { points, originPt, destPt } = useMemo(() => {
    if (coords.length < 2) return { points: '', originPt: null, destPt: null };

    const lngs = coords.map(([lng]) => lng);
    const lats  = coords.map(([, lat]) => lat);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats),  maxLat = Math.max(...lats);

    const rangeX = maxLng - minLng || 0.001;
    const rangeY = maxLat - minLat || 0.001;
    const scaleX = (width  - PAD * 2) / rangeX;
    const scaleY = (height - PAD * 2) / rangeY;
    const scale  = Math.min(scaleX, scaleY);

    // Centrar en el viewport
    const offsetX = (width  - rangeX * scale) / 2;
    const offsetY = (height - rangeY * scale) / 2;

    const toSvg = ([lng, lat]: [number, number]): [number, number] => [
      offsetX + (lng - minLng) * scale,
      offsetY + (maxLat - lat) * scale, // flip Y
    ];

    const pts = coords.map(toSvg);
    return {
      points: pts.map(([x, y]) => `${x},${y}`).join(' '),
      originPt: pts[0]!,
      destPt:   pts[pts.length - 1]!,
    };
  }, [coords, width, height]);

  if (!points) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-muted/20 border border-border/40 text-xs text-muted-foreground"
        style={{ width, height }}>
        Sin polilínea
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="rounded-xl border border-border/40 bg-[#0c0c14]"
      aria-label="Miniatura de ruta"
    >
      {/* Glow de la línea */}
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>

      {/* Línea de ruta */}
      <polyline
        points={points}
        fill="none"
        stroke={routeColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
        opacity="0.9"
      />
      {/* Línea de ruta más tenue debajo */}
      <polyline
        points={points}
        fill="none"
        stroke={routeColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.15"
      />

      {/* Origen */}
      {originPt && (
        <>
          <circle cx={originPt[0]} cy={originPt[1]} r="6" fill="#22c55e" opacity="0.2" />
          <circle cx={originPt[0]} cy={originPt[1]} r="3.5" fill="#22c55e" />
        </>
      )}
      {/* Destino */}
      {destPt && (
        <>
          <circle cx={destPt[0]} cy={destPt[1]} r="6" fill="#ef4444" opacity="0.2" />
          <circle cx={destPt[0]} cy={destPt[1]} r="3.5" fill="#ef4444" />
        </>
      )}
    </svg>
  );
}

// ─── Trail SVG en minimap ─────────────────────────────────────────────────────
// Renderiza el trail del conductor sobre el mismo espacio normalizado.
// Solo se usa para referencia visual futura — en el MVP el trail aparece en el mapa grande.

// ─── Leyenda del mapa ─────────────────────────────────────────────────────────
function MapLegend({ routeColor }: { routeColor: string }) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 rounded-xl border border-border/40 bg-card/90 backdrop-blur-sm px-3 py-2 shadow-lg">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Leyenda</p>
      <div className="flex items-center gap-2">
        <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: routeColor }} />
        <span className="text-[10px] text-foreground">Ruta definida</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-0.5 w-6 rounded-full bg-emerald-400" />
        <span className="text-[10px] text-foreground">Recorrido conductor</span>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function RouteDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const apiKey  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  const { data: route, isLoading, error } = useRoute(id);
  const { data: vehicles = [] } = useVehicles();
  const { data: users    = [] } = useUsers();
  const updateStatus  = useUpdateRouteStatus();
  const deleteRoute   = useDeleteRoute();

  // Live tracking store para trails en tiempo real
  const liveVehicles = useTrackingStore((s) => s.vehicles);
  const trails       = useTrackingStore((s) => s.trails);

  const [assignOpen,    setAssignOpen]    = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [mapExpanded,   setMapExpanded]   = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // ── Loading / error ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Route className="h-10 w-10 opacity-20" />
        <p>Ruta no encontrada.</p>
        <Link href="/routes" className="text-sm text-primary hover:underline">Volver a rutas</Link>
      </div>
    );
  }

  // ── Lookups cliente-side ──────────────────────────────────────────────────
  const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
  const userMap    = Object.fromEntries(users.map((u) => [u.id, u]));

  // Normalizar stops
  const stops = Array.isArray(route.stops) ? route.stops : [];

  const assignedVehicle  = route.vehicle_id ? vehicleMap[route.vehicle_id] : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignedDriverId = assignedVehicle ? (assignedVehicle as any).assigned_driver_id as string | null : null;
  const assignedDriver   = assignedDriverId ? userMap[assignedDriverId] : null;

  const currentAssignment = (assignedDriver && assignedVehicle)
    ? { driverId: assignedDriverId!, driverName: assignedDriver.full_name, vehiclePlate: assignedVehicle.plate ?? '' }
    : null;

  // ── Polyline para el mapa expandido ──────────────────────────────────────
  const polyline = (route.polyline_coords ?? []).map(([lng, lat]) => ({ lat, lng }));
  const mapCenter = polyline.length > 0 ? polyline[Math.floor(polyline.length / 2)] : { lat: 19.4326, lng: -99.1332 };

  const routeColor = assignedVehicle?.color ?? '#6366f1';
  const meta = STATUS_META[route.status] ?? STATUS_META.inactive;

  // ── Lista de "recorridos" en vivo ─────────────────────────────────────────
  // Vehículos activos en el live store asociados a esta ruta (via vehicleMap en la misma ruta)
  const liveEntries = Object.values(liveVehicles).filter((lv) => {
    const dbVehicle = vehicleMap[lv.v];
    if (!dbVehicle) return false;
    // Mostrar si este vehículo está asignado a esta ruta
    return route.vehicle_id === lv.v;
  });

  // Trail del vehículo seleccionado para el mapa
  const selectedTrail = selectedVehicleId ? (trails[selectedVehicleId] ?? []) : [];

  // ── Acciones ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    await deleteRoute.mutateAsync(route.id);
    router.push('/routes');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-border/50 bg-card/60 px-5 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/routes"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold truncate">{route.name}</h1>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.className}`}>
                  {meta.icon}{meta.label}
                </span>
              </div>
              {route.description && (
                <p className="text-xs text-muted-foreground truncate max-w-lg">{route.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {route.status !== 'active' && (
              <button type="button" onClick={() => void updateStatus.mutateAsync({ id: route.id, status: 'active' })}
                disabled={updateStatus.isPending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                Activar
              </button>
            )}
            {route.status === 'active' && (
              <button type="button" onClick={() => void updateStatus.mutateAsync({ id: route.id, status: 'inactive' })}
                disabled={updateStatus.isPending}
                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                Desactivar
              </button>
            )}
            <button type="button" onClick={() => setAssignOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              <Pencil className="h-3.5 w-3.5" />
              {currentAssignment ? 'Reasignar' : 'Asignar conductor'}
            </button>
            <button type="button" onClick={() => setDeleteConfirm(true)}
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors">
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <AnimatePresence mode="wait">
        {!mapExpanded ? (
          /* ════════════════════════════════════════════════════════════════
             MODO COMPACTO — minimap + info + lista de recorridos
          ════════════════════════════════════════════════════════════════ */
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-y-auto"
          >
            <div className="p-5 space-y-4">

              {/* ── Minimap + stats lado a lado ── */}
              <div className="flex gap-4 flex-wrap">

                {/* Minimap SVG */}
                <div className="relative flex-shrink-0">
                  <RouteMinimap
                    coords={route.polyline_coords ?? []}
                    width={240}
                    height={150}
                    routeColor={routeColor}
                  />
                                  {/* Pin origen — punto verde sin texto */}
                  <div className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-lg ring-2 ring-white/20">
                    <MapPin className="h-3.5 w-3.5 text-white" fill="white" />
                  </div>
                  {/* Pin destino — punto rojo sin texto */}
                  <div className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 shadow-lg ring-2 ring-white/20">
                    <MapPin className="h-3.5 w-3.5 text-white" fill="white" />
                  </div>
                  {/* Botón expandir */}
                  <button
                    type="button"
                    onClick={() => setMapExpanded(true)}
                    className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-card/90 border border-border/50 px-2 py-1 text-[10px] font-semibold hover:bg-primary hover:text-white hover:border-primary transition-all shadow-lg"
                  >
                    <Maximize2 className="h-3 w-3" />
                    Ver mapa
                  </button>
                </div>

                {/* Stats y recorrido */}
                <div className="flex-1 min-w-0 space-y-3">
                  {/* Stat chips */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Distancia',  value: fmtDistance(route.total_distance_m),       icon: <Ruler className="h-3 w-3" /> },
                      { label: 'Duración',   value: fmtDuration(route.estimated_duration_s),    icon: <Clock className="h-3 w-3" /> },
                      { label: 'Tolerancia', value: route.deviation_threshold_m ? `${route.deviation_threshold_m}m` : '50m', icon: <AlertTriangle className="h-3 w-3" /> },
                    ].map(({ label, value, icon }) => (
                      <div key={label} className="rounded-xl border border-border/50 bg-card/60 p-2.5 text-center">
                        <div className="flex justify-center text-muted-foreground mb-1">{icon}</div>
                        <p className="text-sm font-bold leading-none">{value}</p>
                        <p className="text-[9px] text-muted-foreground mt-1">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recorrido: origen → paradas → destino */}
                  <div className="rounded-xl border border-border/50 bg-card/60 p-3 space-y-1.5">
                    {[
                      { dot: 'bg-emerald-500', label: route.origin_name, sub: 'Origen' },
                      ...stops.map((s, i) => ({ dot: 'bg-amber-400', label: s.name, sub: `Parada ${i + 1}` })),
                      { dot: 'bg-red-500',    label: route.dest_name,   sub: 'Destino' },
                    ].map(({ dot, label, sub }, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
                        <p className="text-xs font-medium truncate">{label}</p>
                        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Card de asignación actual ── */}
              <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-3">Asignación actual</p>
                {assignedVehicle ? (
                  <div className="flex items-center gap-3">
                    <div
                      className="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${routeColor}22` }}
                    >
                      <Car className="h-4 w-4" style={{ color: routeColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{assignedVehicle.alias ?? assignedVehicle.plate}</p>
                      <p className="text-[10px] text-muted-foreground">{assignedVehicle.plate}</p>
                    </div>
                    {assignedDriver && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {assignedDriver.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-xs font-semibold">{assignedDriver.full_name}</p>
                          <p className="text-[10px] text-muted-foreground">Conductor</p>
                        </div>
                      </div>
                    )}
                    {/* Indicador de actividad en vivo */}
                    {route.vehicle_id && liveVehicles[route.vehicle_id] && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400 flex-shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        En ruta
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Car className="h-4 w-4 opacity-40" />
                    <p className="text-xs">Sin vehículo asignado</p>
                    <button type="button" onClick={() => setAssignOpen(true)}
                      className="ml-auto text-[11px] text-primary hover:underline">
                      Asignar ahora
                    </button>
                  </div>
                )}
              </div>

              {/* ── Historial de recorridos ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Recorridos en vivo</p>
                  {liveEntries.length > 0 && (
                    <span className="text-[10px] text-emerald-400 font-semibold">{liveEntries.length} activo{liveEntries.length !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {liveEntries.length > 0 ? (
                  <div className="space-y-2">
                    {liveEntries.map((lv) => {
                      const db     = vehicleMap[lv.v];
                      const drvId  = (db as (typeof db & { assigned_driver_id?: string }) | undefined)?.assigned_driver_id;
                      const driver = drvId ? userMap[drvId] : null;
                      return (
                        <div key={lv.v} className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold">{db?.alias ?? db?.plate ?? lv.v.slice(0, 8)}</p>
                            {driver && <p className="text-[10px] text-muted-foreground">{driver.full_name}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-medium">{Math.round(lv.s ?? 0)} km/h</p>
                            <p className="text-[10px] text-muted-foreground">velocidad</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVehicleId(lv.v);
                              setMapExpanded(true);
                            }}
                            className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2 py-1 text-[10px] text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                          >
                            <Navigation className="h-3 w-3" />
                            Ver
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 py-8 gap-2 text-muted-foreground">
                    <Navigation className="h-6 w-6 opacity-25" />
                    <p className="text-xs">Sin recorridos activos en este momento</p>
                    <p className="text-[10px] opacity-60">Los conductores aparecerán aquí cuando estén en ruta</p>
                  </div>
                )}
              </div>

              {/* ── Metadata ── */}
              <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Información</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {[
                    { label: 'ID',          value: route.id.slice(0, 8) + '…' },
                    { label: 'Creada',      value: new Date(route.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) },
                    { label: 'Actualizada', value: new Date(route.updated_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) },
                    { label: 'Puntos GPS',  value: (route.polyline_coords?.length ?? 0).toString() },
                    { label: 'Versión',     value: `v${route.version ?? 1}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Seguridad ── */}
              <RouteSettingsSection
                routeId={route.id}
                current={{
                  risk_level:      route.risk_level,
                  max_deviation_m: route.max_deviation_m,
                  gps_timeout_s:   route.gps_timeout_s,
                  max_speed_kmh:   route.max_speed_kmh,
                }}
              />

              {/* ── Checkpoints ── */}
              <CheckpointsSection routeId={route.id} />

              {/* ── Casetas ── */}
              <TollBoothsSection routeId={route.id} />

              {/* ── Rutas alternativas ── */}
              <RouteAlternativesSection routeId={route.id} />

            </div>
          </motion.div>

        ) : (
          /* ════════════════════════════════════════════════════════════════
             MODO MAPA EXPANDIDO — mapa completo + lista lateral de conductores
          ════════════════════════════════════════════════════════════════ */
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_280px] overflow-hidden"
          >
            {/* Mapa full */}
            <div className="relative min-h-[320px]">
              {apiKey && polyline.length > 0 ? (
                <APIProvider apiKey={apiKey}>
                  <GMap
                    mapId="DEMO_MAP_ID"
                    defaultZoom={12}
                    defaultCenter={mapCenter}
                    gestureHandling="greedy"
                    disableDefaultUI={true}
                    style={{ width: '100%', height: '100%' }}
                  >
                    {/* Ruta definida (índigo) */}
                    <Polyline
                      path={polyline}
                      strokeColor={routeColor}
                      strokeWeight={5}
                      strokeOpacity={0.85}
                    />

                    {/* Trail del conductor seleccionado (verde) */}
                    {selectedTrail.length > 1 && (
                      <Polyline
                        path={selectedTrail}
                        strokeColor="#22c55e"
                        strokeWeight={4}
                        strokeOpacity={0.8}
                      />
                    )}

                    {/* Origen y destino */}
                    <AdvancedMarker position={polyline[0]} title={route.origin_name}>
                      <div className="flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
                        <MapPin className="h-2.5 w-2.5" />{route.origin_name}
                      </div>
                    </AdvancedMarker>
                    <AdvancedMarker position={polyline[polyline.length - 1]} title={route.dest_name}>
                      <div className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
                        <MapPin className="h-2.5 w-2.5" />{route.dest_name}
                      </div>
                    </AdvancedMarker>

                    {/* Posición actual del vehículo seleccionado */}
                    {selectedVehicleId && liveVehicles[selectedVehicleId] && (() => {
                      const lv = liveVehicles[selectedVehicleId];
                      const db = vehicleMap[selectedVehicleId];
                      return (
                        <AdvancedMarker position={{ lat: lv.lat, lng: lv.lng }} title={db?.plate}>
                          <div className="h-4 w-4 rounded-full border-2 border-white shadow-lg"
                            style={{ backgroundColor: routeColor }} />
                        </AdvancedMarker>
                      );
                    })()}
                  </GMap>
                </APIProvider>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  {!apiKey ? 'API Key de Maps requerida' : 'Sin polilínea registrada'}
                </div>
              )}

              {/* Leyenda */}
              <MapLegend routeColor={routeColor} />

              {/* Botón colapsar */}
              <button
                type="button"
                onClick={() => setMapExpanded(false)}
                className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-lg bg-card/95 border border-border/60 px-2.5 py-1.5 text-xs font-semibold shadow-lg hover:bg-muted transition-colors"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                Compacto
              </button>
            </div>

            {/* Panel lateral: lista de conductores en ruta */}
            <div className="border-l border-border/50 bg-card/40 flex flex-col overflow-hidden">
              <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-border/40">
                <p className="text-xs font-semibold">Conductores en ruta</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Selecciona para ver su recorrido</p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {liveEntries.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                    <Navigation className="h-5 w-5 opacity-25" />
                    <p className="text-xs text-center">Sin conductores activos</p>
                  </div>
                )}
                {liveEntries.map((lv) => {
                  const db     = vehicleMap[lv.v];
                  const drvId  = (db as (typeof db & { assigned_driver_id?: string }) | undefined)?.assigned_driver_id;
                  const driver = drvId ? userMap[drvId] : null;
                  const isSelected = selectedVehicleId === lv.v;
                  return (
                    <button
                      key={lv.v}
                      type="button"
                      onClick={() => setSelectedVehicleId(isSelected ? null : lv.v)}
                      className={`w-full text-left flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                        isSelected
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-border/40 bg-background/30 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <span className={`h-2.5 w-2.5 rounded-full flex block ${
                          lv.off ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{db?.alias ?? db?.plate ?? lv.v.slice(0, 8)}</p>
                        {driver && <p className="text-[10px] text-muted-foreground truncate">{driver.full_name}</p>}
                        <p className="text-[10px] text-muted-foreground">{Math.round(lv.s ?? 0)} km/h</p>
                      </div>
                      {isSelected && (
                        <span className="text-[9px] text-emerald-400 font-bold flex-shrink-0">VIENDO</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Leyenda en el panel lateral (versión compacta) */}
              <div className="flex-shrink-0 border-t border-border/40 px-4 py-3 space-y-1.5">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Leyenda</p>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-5 rounded-full flex-shrink-0" style={{ backgroundColor: routeColor }} />
                  <span className="text-[10px] text-muted-foreground">Ruta definida</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground">Recorrido conductor</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal asignar conductor ── */}
      <AssignDriverModal
        routeId={route.id}
        routeName={route.name}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        currentAssignment={currentAssignment}
      />

      {/* ── Confirmar eliminación ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
          >
            <h3 className="font-semibold">Eliminar ruta</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              ¿Confirmas eliminar <span className="font-semibold text-foreground">{route.name}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={() => void handleDelete()} disabled={deleteRoute.isPending}
                className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50">
                {deleteRoute.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
