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
  Maximize2, Minimize2, Navigation, History,
} from 'lucide-react';
import {
  Map as GMap, AdvancedMarker, Polyline,
} from '@vis.gl/react-google-maps';
import {
  useRoute, useUpdateRouteStatus, useDeleteRoute, useRouteAssignments,
} from './use-routes';
import {
  RouteSettingsSection, CheckpointsSection, TollBoothsSection, RouteAlternativesSection,
} from './route-sections';
import { useVehicles } from '../vehicles/use-vehicles';
import { useUsers } from '../users/use-users';
import { useTrackingStore } from '../../stores/use-tracking-store';
import { AssignDriverModal } from './assign-driver-modal';
import { useState } from 'react';

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
      <div className="flex items-center gap-2">
        <div className="h-0.5 w-6 rounded-full bg-red-400" />
        <span className="text-[10px] text-foreground">Desvio de ruta</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-0.5 w-6 rounded-full bg-cyan-400" />
        <span className="text-[10px] text-foreground">En camino al inicio</span>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function RouteDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

  const { data: route, isLoading, error } = useRoute(id);
  const { data: vehicles = [] } = useVehicles();
  const { data: users    = [] } = useUsers();
  const updateStatus  = useUpdateRouteStatus();
  const deleteRoute   = useDeleteRoute();

  // Live tracking store para trails en tiempo real
  const liveVehicles  = useTrackingStore((s) => s.vehicles);
  const trails        = useTrackingStore((s) => s.trails);
  const activeRoutes  = useTrackingStore((s) => s.activeRoutes);
  const navRoutes     = useTrackingStore((s) => s.navRoutes);

  const { data: assignments = [] } = useRouteAssignments(id);

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

  // Normalizar stops — Supabase puede devolver jsonb de vistas como string en lugar de objeto
  const stops = (() => {
    const raw = route.stops;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as typeof raw; } catch { return []; }
    }
    return [];
  })();

  const assignedVehicle  = route.vehicle_id ? vehicleMap[route.vehicle_id] : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignedDriverId = assignedVehicle ? (assignedVehicle as any).assigned_driver_id as string | null : null;
  const assignedDriver   = assignedDriverId ? userMap[assignedDriverId] : null;

  // Build activeAssignments from route_assignments data for the modal
  const activeAssignments = assignments
    .filter((a) => a.is_active)
    .map((a) => {
      const v = vehicleMap[a.vehicle_id];
      const d = userMap[a.driver_id];
      return {
        driverId: a.driver_id,
        driverName: d?.full_name ?? a.driver_id.slice(0, 8),
        vehiclePlate: v?.plate ?? a.vehicle_id.slice(0, 8),
      };
    });

  // ── Polyline para el mapa expandido ──────────────────────────────────────
  const polyline = (route.polyline_coords ?? []).map(([lng, lat]) => ({ lat, lng }));

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
              {activeAssignments.length > 0 ? 'Asignar otro conductor' : 'Asignar conductor'}
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

                {/* Minimap — Google Maps real, tamaño fijo */}
                <div
                  className="relative flex-shrink-0 rounded-xl overflow-hidden border border-border/40"
                  style={{ width: 240, height: 150 }}
                >
                  {polyline.length >= 2 ? (
                    <GMap
                      mapId={mapId}
                      defaultBounds={{
                        north: Math.max(...polyline.map((p) => p.lat)),
                        south: Math.min(...polyline.map((p) => p.lat)),
                        east:  Math.max(...polyline.map((p) => p.lng)),
                        west:  Math.min(...polyline.map((p) => p.lng)),
                        padding: 24,
                      }}
                      gestureHandling="none"
                      disableDefaultUI={true}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <Polyline
                        path={polyline}
                        strokeColor={routeColor}
                        strokeWeight={4}
                        strokeOpacity={0.9}
                      />
                      <AdvancedMarker position={polyline[0]} title={route.origin_name}>
                        <div className="h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow" />
                      </AdvancedMarker>
                      {stops.sort((a, b) => a.order - b.order).map((s, i) => (
                        <AdvancedMarker key={i} position={{ lat: s.lat, lng: s.lng }} title={`P${i + 1}: ${s.name}`}>
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-white shadow" />
                        </AdvancedMarker>
                      ))}
                      <AdvancedMarker position={polyline[polyline.length - 1]} title={route.dest_name}>
                        <div className="h-3 w-3 rounded-full bg-red-500 border-2 border-white shadow" />
                      </AdvancedMarker>
                    </GMap>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground bg-muted/20">
                      Sin polilínea
                    </div>
                  )}
                  {/* Botón expandir */}
                  <button
                    type="button"
                    onClick={() => setMapExpanded(true)}
                    className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-card/90 border border-border/50 px-2 py-1 text-[10px] font-semibold hover:bg-primary hover:text-white hover:border-primary transition-all shadow-lg"
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
                      { label: 'Paradas',    value: stops.length > 0 ? `${stops.length}` : '—', icon: <MapPin className="h-3 w-3" /> },
                    ].map(({ label, value, icon }) => (
                      <div key={label} className="rounded-xl border border-border/50 bg-card/60 p-2.5 text-center">
                        <div className="flex justify-center text-muted-foreground mb-1">{icon}</div>
                        <p className="text-sm font-bold leading-none">{value}</p>
                        <p className="text-[9px] text-muted-foreground mt-1">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Timeline: origen → paradas → destino */}
                  <div className="rounded-xl border border-border/50 bg-card/60 overflow-hidden">
                    <p className="px-3 pt-2.5 pb-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/30">
                      Recorrido definido
                    </p>
                    <div className="relative px-3 py-2 space-y-0">
                      {/* Línea vertical conectora */}
                      <div className="absolute left-[21px] top-4 bottom-4 w-px bg-border/50" />

                      {/* Origen */}
                      <div className="flex items-center gap-2.5 py-1.5 relative">
                        <span className="z-10 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 ring-offset-1 ring-offset-card" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate leading-none">{route.origin_name}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Origen</p>
                        </div>
                      </div>

                      {/* Paradas intermedias */}
                      {stops.sort((a, b) => a.order - b.order).map((s, i) => (
                        <div key={i} className="flex items-center gap-2.5 py-1.5 relative">
                          <span className="z-10 h-4 w-4 flex-shrink-0 rounded-full bg-amber-500 ring-2 ring-amber-500/25 ring-offset-1 ring-offset-card" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold truncate leading-none">{s.name}</p>
                              <span className="flex-shrink-0 rounded-md bg-amber-500/15 border border-amber-500/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                                P{i + 1}
                              </span>
                              {s.radius_m && (
                                <span className="flex-shrink-0 text-[9px] text-muted-foreground">{s.radius_m}m</span>
                              )}
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-0.5">Parada {i + 1}</p>
                          </div>
                        </div>
                      ))}

                      {/* Destino */}
                      <div className="flex items-center gap-2.5 py-1.5 relative">
                        <span className="z-10 h-4 w-4 flex-shrink-0 rounded-full bg-red-500 ring-2 ring-red-500/20 ring-offset-1 ring-offset-card" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate leading-none">{route.dest_name}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">Destino</p>
                        </div>
                      </div>
                    </div>
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

              {/* ── Historial de asignaciones ── */}
              {assignments.length > 0 && (
                <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                    <History className="h-3 w-3" /> Historial de asignaciones
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
                    {assignments.map((a) => {
                      const aVehicle = vehicleMap[a.vehicle_id];
                      const aDriver  = userMap[a.driver_id];
                      const aBy      = a.assigned_by ? userMap[a.assigned_by] : null;
                      const dateStr  = new Date(a.assigned_at).toLocaleString('es-MX', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      });
                      return (
                        <div
                          key={a.id}
                          className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                            a.is_active
                              ? 'border-emerald-500/20 bg-emerald-500/5'
                              : 'border-border/30 bg-muted/10 opacity-60'
                          }`}
                        >
                          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {aDriver?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {aDriver?.full_name ?? a.driver_id.slice(0, 8)}
                            </p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Car className="h-2.5 w-2.5" />
                              {aVehicle?.alias ?? aVehicle?.plate ?? a.vehicle_id.slice(0, 8)}
                            </p>
                            {a.notes && (
                              <p className="text-[10px] text-muted-foreground/70 italic mt-0.5 truncate">
                                {a.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-[10px] text-muted-foreground">{dateStr}</p>
                            {aBy && (
                              <p className="text-[9px] text-muted-foreground/60">por {aBy.full_name}</p>
                            )}
                            {a.is_active ? (
                              <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-bold text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Activa
                              </span>
                            ) : (
                              <span className="text-[9px] text-muted-foreground/50 mt-0.5">Inactiva</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
            className="flex-1 flex flex-row overflow-hidden"
          >
            {/* Mapa full — absolute inset para resolver height:100% */}
            <div className="flex-1 relative">
              <div className="absolute inset-0">
              {polyline.length > 0 ? (
                <GMap
                  mapId={mapId}
                  defaultBounds={{
                    north: Math.max(...polyline.map((p) => p.lat)),
                    south: Math.min(...polyline.map((p) => p.lat)),
                    east:  Math.max(...polyline.map((p) => p.lng)),
                    west:  Math.min(...polyline.map((p) => p.lng)),
                    padding: 40,
                  }}
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

                    {/* Trail del conductor seleccionado — segmentado on/off route */}
                    {selectedTrail.length > 1 && (() => {
                      const segments: { off: boolean; path: { lat: number; lng: number }[] }[] = [];
                      let currentOff = selectedTrail[0]!.off ?? false;
                      let currentPath: { lat: number; lng: number }[] = [{ lat: selectedTrail[0]!.lat, lng: selectedTrail[0]!.lng }];
                      for (let i = 1; i < selectedTrail.length; i++) {
                        const pt = selectedTrail[i]!;
                        const ptOff = pt.off ?? false;
                        if (ptOff !== currentOff) {
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
                          key={`trail-seg-${si}`}
                          path={seg.path}
                          strokeColor={seg.off ? '#ef4444' : '#22c55e'}
                          strokeWeight={4}
                          strokeOpacity={seg.off ? 0.85 : 0.8}
                        />
                      ));
                    })()}

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

                    {/* Paradas intermedias */}
                    {stops.sort((a, b) => a.order - b.order).map((s, i) => (
                      <AdvancedMarker key={i} position={{ lat: s.lat, lng: s.lng }} title={s.name}>
                        <div className="flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg ring-2 ring-amber-300/40">
                          <MapPin className="h-2.5 w-2.5" />
                          <span>P{i + 1}</span>
                          <span className="opacity-80">{s.name}</span>
                        </div>
                      </AdvancedMarker>
                    ))}

                    {/* Ruta de navegación: vehículo → primer punto (Directions API o fallback recto) */}
                    {route.vehicle_id && liveVehicles[route.vehicle_id] && activeRoutes[route.vehicle_id] === route.id && polyline.length > 0 && (() => {
                      const lv = liveVehicles[route.vehicle_id!];
                      const firstWp = polyline[0]!;
                      const dx = lv.lat - firstWp.lat;
                      const dy = lv.lng - firstWp.lng;
                      const distApprox = Math.sqrt(dx * dx + dy * dy) * 111_000;
                      if (distApprox < 150) return null;

                      // Preferir polyline de Directions API
                      const navPath = navRoutes[route.vehicle_id!];
                      const path = navPath && navPath.length >= 2
                        ? navPath
                        : [{ lat: lv.lat, lng: lv.lng }, firstWp];

                      return (
                        <Polyline
                          path={path}
                          strokeColor="#06b6d4"
                          strokeWeight={3}
                          strokeOpacity={0.7}
                          geodesic
                        />
                      );
                    })()}

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
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  Sin polilínea registrada
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
              </div>{/* /absolute inset-0 */}
            </div>{/* /flex-1 relative */}

            {/* Panel lateral: lista de conductores en ruta */}
            <div className="w-[280px] border-l border-border/50 bg-card/40 flex flex-col overflow-hidden">
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
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-5 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground">Desvio de ruta</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-5 rounded-full bg-cyan-400 flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground">En camino al inicio</span>
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
        activeAssignments={activeAssignments}
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
