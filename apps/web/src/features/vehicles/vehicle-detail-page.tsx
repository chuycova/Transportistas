'use client';
// ─── features/vehicles/vehicle-detail-page.tsx ───────────────────────────────
// Pantalla de administración de un vehículo individual. Secciones:
//   1. Header: datos del vehículo + estado en vivo
//   2. Usuarios asignados: lista con acceso móvil, historial de conductores
//   3. Línea de tiempo actual: posición en ruta, % recorrido, tiempo restante
//   4. Historial de rutas
//   5. Desvíos y alertas

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Truck, Car, MapPin, Navigation, Clock, AlertTriangle,
  CheckCircle2, XCircle, Route as RouteIcon, Zap, Activity,
  TrendingUp, Shield, ChevronRight, RefreshCw,
  Users, UserPlus, UserMinus, Smartphone, History,
} from 'lucide-react';
import { useVehicles } from './use-vehicles';
import {
  useVehicleRoutes, useVehicleAlerts, useVehicleTrack,
  useVehicleAssignedUsers, useAddVehicleUser, useRemoveVehicleUser,
} from './use-vehicle-detail';
import { useTrackingStore } from '../../stores/use-tracking-store';
import { useRoutes } from '../routes/use-routes';
import { useUsers } from '../users/use-users';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
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

// ─── Constantes de etiquetas ──────────────────────────────────────────────────

const ALERT_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  off_route:         { label: 'Desvío de ruta',     icon: <Navigation className="h-3.5 w-3.5" />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  speeding:          { label: 'Exceso de velocidad', icon: <TrendingUp className="h-3.5 w-3.5" />, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  long_stop:         { label: 'Parada prolongada',   icon: <Clock className="h-3.5 w-3.5" />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  arrived_stop:      { label: 'Llegó a parada',      icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  route_completed:   { label: 'Ruta completada',     icon: <RouteIcon className="h-3.5 w-3.5" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  signal_lost:       { label: 'Señal perdida',       icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-destructive bg-destructive/10 border-destructive/30' },
  signal_recovered:  { label: 'Señal recuperada',    icon: <Zap className="h-3.5 w-3.5" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  emergency:         { label: 'Emergencia',           icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-destructive bg-destructive/10 border-destructive/30' },
};

const SEVERITY_DOT: Record<string, string> = {
  info:     'bg-blue-400',
  warning:  'bg-amber-400',
  critical: 'bg-destructive',
};

const ROUTE_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active:   { label: 'Activa',    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  inactive: { label: 'Inactiva',  className: 'bg-muted/20 text-muted-foreground border-border' },
  draft:    { label: 'Borrador',  className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  archived: { label: 'Archivada', className: 'bg-muted/20 text-muted-foreground/60 border-border/50' },
};

const ROLE_LABELS: Record<string, string> = {
  driver:      'Conductor',
  operator:    'Operador',
  admin:       'Admin',
  super_admin: 'Super Admin',
};

const ROLE_COLORS: Record<string, string> = {
  driver:      'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  operator:    'bg-sky-500/10 text-sky-400 border-sky-500/30',
  admin:       'bg-amber-500/10 text-amber-400 border-amber-500/30',
  super_admin: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

// ─── Sección: Usuarios asignados + historial de conductores ──────────────────
function AssignedUsersSection({
  vehicleId,
  primaryDriverId,
}: {
  vehicleId: string;
  primaryDriverId: string | null | undefined;
}) {
  const { data: assignments = [], isLoading, refetch } = useVehicleAssignedUsers(vehicleId);
  const { data: allUsers = [] } = useUsers();
  const addUser    = useAddVehicleUser();
  const removeUser = useRemoveVehicleUser();

  const [showHistory, setShowHistory] = useState(false);
  const [showPicker, setShowPicker]   = useState(false);

  const activeAssignments = assignments.filter((a) => a.is_active);
  const pastAssignments   = assignments.filter((a) => !a.is_active);
  const assignedUserIds   = new Set(activeAssignments.map((a) => a.user_id));
  const availableUsers    = allUsers.filter((u) => !assignedUserIds.has(u.id));

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground">Usuarios asignados</h2>
          {activeAssignments.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-bold">
              {activeAssignments.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pastAssignments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <History className="h-3.5 w-3.5" />
              {showHistory ? 'Ocultar' : `Historial (${pastAssignments.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Asignaciones activas */}
      {!isLoading && activeAssignments.length === 0 && !showPicker && (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
          <Users className="h-8 w-8 opacity-30" />
          <p className="text-sm italic">Sin usuarios asignados</p>
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {activeAssignments.map((a) => {
            const isPrimary = a.user_id === primaryDriverId;
            const role = a.profile?.role ?? '';

            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/40 p-3"
              >
                {/* Avatar */}
                <div className={`h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                  isPrimary ? 'bg-primary/20 text-primary' : 'bg-muted/60 text-muted-foreground'
                }`}>
                  {a.profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {a.profile?.full_name ?? 'Usuario desconocido'}
                    {isPrimary && (
                      <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                        <Smartphone className="h-2 w-2" />Acceso Móvil
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {ROLE_LABELS[role] ?? role}
                    {' · '}Desde{' '}
                    {new Date(a.assigned_at).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>

                {/* Role badge */}
                <span className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                  ROLE_COLORS[role] ?? 'bg-muted/20 text-muted-foreground border-border'
                }`}>
                  {ROLE_LABELS[role] ?? role}
                </span>

                {/* Quitar */}
                <button
                  type="button"
                  onClick={() => removeUser.mutate({ assignmentId: a.id, vehicleId })}
                  disabled={removeUser.isPending}
                  className="flex-shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                  title="Quitar asignación"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Picker para añadir usuario */}
      <div className="mt-3 border-t border-border/30 pt-3">
        <AnimatePresence>
          {showPicker ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden space-y-2"
            >
              <p className="text-xs text-muted-foreground font-medium">Selecciona un usuario para asignar:</p>
              {availableUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic py-2">
                  Todos los usuarios ya están asignados
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {availableUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={async () => {
                        await addUser.mutateAsync({ vehicleId, userId: u.id });
                        setShowPicker(false);
                      }}
                      disabled={addUser.isPending}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-primary/10 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="h-6 w-6 flex-shrink-0 rounded-full bg-muted/60 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{u.full_name}</p>
                        {u.phone && <p className="text-muted-foreground">{u.phone}</p>}
                      </div>
                      <span className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                        ROLE_COLORS[u.role] ?? 'bg-muted/20 text-muted-foreground border-border'
                      }`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Asignar usuario
            </button>
          )}
        </AnimatePresence>
      </div>

      {/* Historial de conductores / usuarios pasados */}
      <AnimatePresence>
        {showHistory && pastAssignments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" />
                Historial de conductores / usuarios
              </p>
              <div className="space-y-1.5">
                {pastAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2.5 rounded-lg bg-muted/20 px-3 py-2 opacity-70"
                  >
                    <div className="h-6 w-6 flex-shrink-0 rounded-full bg-muted/50 flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                      {a.profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground truncate">
                        {a.profile?.full_name ?? 'Usuario eliminado'}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {new Date(a.assigned_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {a.unassigned_at && (
                          <> → {new Date(a.unassigned_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                        )}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold opacity-60 ${
                      ROLE_COLORS[a.profile?.role ?? ''] ?? 'bg-muted/20 text-muted-foreground border-border'
                    }`}>
                      {ROLE_LABELS[a.profile?.role ?? ''] ?? a.profile?.role ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sección: Línea de tiempo actual ─────────────────────────────────────────
function ActiveTimeline({
  vehicleId,
  live,
}: {
  vehicleId: string;
  live: { lat: number; lng: number; s?: number; h?: number; off?: boolean } | undefined;
}) {
  const { data: routes = [] } = useRoutes();
  const { data: track = [], isLoading: trackLoading, refetch } = useVehicleTrack(vehicleId);

  const activeRoute = routes.find(
    (r) => r.status === 'active' &&
      ((r as typeof r & { vehicle_id?: string }).vehicle_id === vehicleId || !routes.some(
        (rr) => (rr as typeof rr & { vehicle_id?: string }).vehicle_id
      ))
  );

  const polyline = useMemo(() => {
    if (!activeRoute?.polyline_coords) return [];
    return (activeRoute.polyline_coords as [number, number][]).map(
      ([lngV, latV]) => ({ lat: latV, lng: lngV }),
    );
  }, [activeRoute]);

  const { progress, closestIdx, distanceRemaining } = useMemo(() => {
    if (!live || polyline.length === 0) return { progress: 0, closestIdx: 0, distanceRemaining: null };
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < polyline.length; i++) {
      const d = haversineMeters(live, polyline[i]);
      if (d < minDist) { minDist = d; closestIdx = i; }
    }
    let rem = 0;
    for (let i = closestIdx; i < polyline.length - 1; i++) {
      rem += haversineMeters(polyline[i], polyline[i + 1]);
    }
    return {
      progress: Math.round((closestIdx / Math.max(polyline.length - 1, 1)) * 100),
      closestIdx,
      distanceRemaining: rem,
    };
  }, [live, polyline]);

  const etaSeconds = useMemo(() => {
    if (distanceRemaining === null || distanceRemaining <= 0) return null;
    const speed = live?.s && live.s > 2 ? live.s : null;
    if (!speed) return null;
    return Math.round((distanceRemaining / 1000) / speed * 3600);
  }, [distanceRemaining, live]);

  const recentDeviations = track.filter((p) => p.is_off_route).length;
  const maxDeviation = track.reduce((max, p) => Math.max(max, p.deviation_m ?? 0), 0);

  if (!live) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground">Estado actual</h2>
        </div>
        <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground">
          <MapPin className="h-6 w-6 opacity-40" />
          <p className="text-sm">Sin señal GPS activa</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground">Estado actual</h2>
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          title="Actualizar"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${trackLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-background/50 border border-border/30 p-3 text-center">
          <p className="text-2xl font-black text-foreground">{Math.round(live.s ?? 0)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">km/h</p>
        </div>
        <div className="col-span-2 rounded-xl bg-background/50 border border-border/30 p-3">
          <p className="text-xs font-mono text-primary/80">{live.lat.toFixed(5)}, {live.lng.toFixed(5)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {live.off ? (
              <span className="text-destructive font-medium">Fuera de ruta</span>
            ) : activeRoute ? (
              <span className="text-emerald-400 font-medium">En ruta: {activeRoute.name}</span>
            ) : (
              'GPS activo — sin ruta asignada'
            )}
          </p>
        </div>
      </div>

      {activeRoute && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground font-medium truncate max-w-[60%]">
              {activeRoute.origin_name} → {activeRoute.dest_name}
            </span>
            <span className="font-bold text-foreground">{progress}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-border/40 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${live.off ? 'bg-destructive' : 'bg-emerald-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>
              {closestIdx > 0 && polyline.length > 0 && (
                <>Recorrido: {formatDistance(
                  polyline.slice(0, closestIdx).reduce((acc, pt, i, arr) =>
                    i === 0 ? 0 : acc + haversineMeters(arr[i - 1], pt), 0
                  )
                )}</>
              )}
            </span>
            <span className="flex items-center gap-1">
              {distanceRemaining !== null && distanceRemaining > 0 && (
                <><MapPin className="h-2.5 w-2.5" />{formatDistance(distanceRemaining)} restantes</>
              )}
            </span>
          </div>
          {etaSeconds !== null && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background/30 rounded-lg px-2.5 py-1.5 w-fit">
              <Clock className="h-3 w-3" />
              ETA estimado: <span className="font-bold text-foreground">{formatDuration(etaSeconds)}</span>
            </div>
          )}
        </div>
      )}

      {track.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">{track.length}</p>
            <p className="text-[10px] text-muted-foreground">Pings recibidos</p>
          </div>
          <div className="text-center">
            <p className={`text-sm font-bold ${recentDeviations > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {recentDeviations}
            </p>
            <p className="text-[10px] text-muted-foreground">Desvíos (6h)</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">
              {maxDeviation > 0 ? `${Math.round(maxDeviation)}m` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">Max desvío</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sección: Historial de rutas ──────────────────────────────────────────────
function RoutesHistory({ vehicleId }: { vehicleId: string }) {
  const { data: routes = [], isLoading } = useVehicleRoutes(vehicleId);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
      <div className="flex items-center gap-2 mb-4">
        <RouteIcon className="h-5 w-5 text-primary" />
        <h2 className="font-bold text-foreground">Historial de rutas</h2>
        <span className="ml-auto text-xs text-muted-foreground">{routes.length} rutas</span>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}

      {!isLoading && routes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          <RouteIcon className="h-8 w-8 opacity-30" />
          <p className="text-sm italic">Sin rutas asignadas aún</p>
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence>
          {routes.map((r, idx) => {
            const statusInfo = ROUTE_STATUS_LABELS[r.status] ?? ROUTE_STATUS_LABELS.inactive;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/40 p-3 hover:bg-background/60 transition-colors"
              >
                <div className="text-center min-w-[48px]">
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(r.updated_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {r.origin_name} → {r.dest_name}
                  </p>
                </div>

                <div className="text-right text-[10px] text-muted-foreground flex-shrink-0">
                  {r.total_distance_m && <p>{formatDistance(r.total_distance_m)}</p>}
                  {r.estimated_duration_s && <p>{formatDuration(r.estimated_duration_s)}</p>}
                </div>

                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold flex-shrink-0 ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Sección: Alertas y desvíos ───────────────────────────────────────────────
function AlertsHistory({ vehicleId }: { vehicleId: string }) {
  const { data: alerts = [], isLoading, refetch } = useVehicleAlerts(vehicleId);

  const deviationCount  = alerts.filter((a) => a.alert_type === 'off_route').length;
  const criticalCount   = alerts.filter((a) => a.severity === 'critical').length;
  const unresolvedCount = alerts.filter((a) => !a.is_resolved).length;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-foreground">Alertas y desvíos</h2>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 text-center">
            <p className="text-xl font-black text-amber-400">{deviationCount}</p>
            <p className="text-[10px] text-muted-foreground">Desvíos</p>
          </div>
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-center">
            <p className="text-xl font-black text-destructive">{criticalCount}</p>
            <p className="text-[10px] text-muted-foreground">Críticos</p>
          </div>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
            <p className="text-xl font-black text-primary">{unresolvedCount}</p>
            <p className="text-[10px] text-muted-foreground">Sin resolver</p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}

      {!isLoading && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 text-emerald-500/40" />
          <p className="text-sm italic">Sin alertas registradas</p>
        </div>
      )}

      <div className="relative space-y-0">
        {alerts.length > 0 && (
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/40" />
        )}

        {alerts.slice(0, 50).map((alert, idx) => {
          const meta = ALERT_LABELS[alert.alert_type] ?? {
            label: alert.alert_type,
            icon: <AlertTriangle className="h-3.5 w-3.5" />,
            color: 'text-muted-foreground bg-muted/20 border-border',
          };

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex gap-3 pl-4 py-2.5 relative"
            >
              <div className={`absolute left-0 top-4 h-3.5 w-3.5 rounded-full border-2 border-card flex-shrink-0 ${SEVERITY_DOT[alert.severity] ?? 'bg-muted'}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  {!alert.is_resolved && (
                    <span className="text-[9px] font-bold text-destructive bg-destructive/10 rounded-full px-1.5 py-0.5">
                      ACTIVO
                    </span>
                  )}
                </div>

                {typeof alert.payload?.deviationM === 'number' && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {Math.round(alert.payload.deviationM)}m fuera del corredor
                  </p>
                )}

                {alert.resolution_note && (
                  <p className="text-[10px] text-emerald-400 mt-0.5 italic">
                    Resuelto: {alert.resolution_note}
                  </p>
                )}

                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {new Date(alert.created_at).toLocaleString('es-MX', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                  {' · '}{timeAgo(alert.created_at)}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sección: Telemetría de velocidad ────────────────────────────────────────
function SpeedTimeline({ vehicleId }: { vehicleId: string }) {
  const { data: track = [], isLoading } = useVehicleTrack(vehicleId);

  const recent = track.slice(-60);

  if (isLoading || recent.length < 3) return null;

  const maxSpeed = Math.max(...recent.map((p) => p.speed_kmh ?? 0), 1);

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="font-bold text-foreground">Telemetría reciente</h2>
        <span className="ml-auto text-xs text-muted-foreground">{recent.length} pings</span>
      </div>

      <div className="flex items-end gap-px h-16 w-full">
        {recent.map((p, i) => {
          const pct = ((p.speed_kmh ?? 0) / maxSpeed) * 100;
          const isOff = p.is_off_route;
          return (
            <div
              key={p.id ?? i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${Math.max(pct, 4)}%`,
                backgroundColor: isOff ? '#ef4444' : '#6366f1',
                opacity: 0.7 + (i / recent.length) * 0.3,
              }}
              title={`${Math.round(p.speed_kmh ?? 0)} km/h${isOff ? ' — fuera de ruta' : ''}`}
            />
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
        <span>{new Date(recent[0].recorded_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="text-primary">Velocidad · <span className="text-destructive">Desvío</span></span>
        <span>{new Date(recent[recent.length - 1].recorded_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export function VehicleDetailPage({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const { data: vehicles = [], isLoading: vLoading } = useVehicles();
  const liveVehicles = useTrackingStore((s) => s.vehicles);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const live = liveVehicles[vehicleId];

  const vehicleWithDriver = vehicle as (typeof vehicle & { assigned_driver_id?: string | null }) | undefined;

  if (vLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background">
        <Truck className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Vehículo no encontrado</p>
        <button
          type="button"
          onClick={() => router.push('/vehicles')}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a flotilla
        </button>
      </div>
    );
  }

  const isOffRoute = !!live?.off;
  const VehicleTypeIcon = vehicle.vehicle_type === 'car' || vehicle.vehicle_type === 'van'
    ? Car : Truck;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="w-full p-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => router.push('/vehicles')}
            className="mt-1 rounded-xl p-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors flex-shrink-0"
            title="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: vehicle.color ?? '#6366f1' }}
              >
                <VehicleTypeIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h1 className="text-2xl font-black font-mono tracking-widest text-foreground">
                  {vehicle.plate}
                </h1>
                {vehicle.alias && (
                  <p className="text-sm text-muted-foreground">{vehicle.alias}</p>
                )}
              </div>

              <span className={`ml-auto rounded-full border px-3 py-1 text-xs font-bold flex-shrink-0 ${
                isOffRoute
                  ? 'bg-destructive/15 text-destructive border-destructive/30'
                  : live
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-muted/30 text-muted-foreground border-border'
              }`}>
                {isOffRoute ? '⚠ FUERA DE RUTA' : live ? '● EN VIVO' : 'OFFLINE'}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 mt-3">
              {[
                vehicle.brand && vehicle.model && `${vehicle.brand} ${vehicle.model}`,
                vehicle.year && `Año ${vehicle.year}`,
                vehicle.vehicle_type,
              ].filter(Boolean).map((item) => (
                <span key={item} className="text-xs text-muted-foreground bg-background/50 border border-border/30 rounded-lg px-2 py-1">
                  {item}
                </span>
              ))}
              <button
                type="button"
                onClick={() => router.push('/vehicles')}
                className="text-xs text-primary flex items-center gap-1 hover:underline ml-auto"
              >
                Editar datos
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Usuarios asignados ────────────────────────────────────────── */}
        <AssignedUsersSection
          vehicleId={vehicleId}
          primaryDriverId={vehicleWithDriver?.assigned_driver_id}
        />

        {/* ── Estado actual + línea de tiempo ──────────────────────────── */}
        <ActiveTimeline
          vehicleId={vehicleId}
          live={live ? { lat: live.lat, lng: live.lng, s: live.s, h: live.h, off: live.off } : undefined}
        />

        {/* ── Telemetría de velocidad ───────────────────────────────────── */}
        <SpeedTimeline vehicleId={vehicleId} />

        {/* ── Grid: Rutas + Alertas ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RoutesHistory vehicleId={vehicleId} />
          <AlertsHistory vehicleId={vehicleId} />
        </div>

      </div>
    </div>
  );
}
