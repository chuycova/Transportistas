'use client';
// ─── features/notifications/notifications-page.tsx ────────────────────────────
// Centro de notificaciones del dashboard: alertas del sistema en tiempo real.
// Las alertas se suscriben via Supabase Realtime y se pueden marcar como resueltas.

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, AlertTriangle, Zap, Navigation, CheckCircle2,
  WifiOff, Wifi, MapPin, Flag, Siren, Filter, CheckCheck,
  RefreshCw, Circle,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType =
  | 'emergency'
  | 'off_route'
  | 'speeding'
  | 'long_stop'
  | 'arrived_stop'
  | 'route_completed'
  | 'signal_lost'
  | 'signal_recovered'
  | 'geofence_entry'
  | 'geofence_exit';

interface Alert {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  route_id: string | null;
  alert_type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  payload: Record<string, unknown>;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  // Joined via hook
  vehicle_plate?: string;
  vehicle_alias?: string | null;
}

// ─── Metadata por tipo de alerta ──────────────────────────────────────────────

const ALERT_META: Record<AlertType, {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  emergency: {
    label: 'SOS — Emergencia',
    icon: <Siren className="h-4 w-4" />,
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/15',
    borderClass: 'border-red-500/40',
  },
  off_route: {
    label: 'Desvío de ruta',
    icon: <Navigation className="h-4 w-4" />,
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
  },
  speeding: {
    label: 'Exceso de velocidad',
    icon: <Zap className="h-4 w-4" />,
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
  },
  long_stop: {
    label: 'Parada prolongada',
    icon: <AlertTriangle className="h-4 w-4" />,
    colorClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/20',
  },
  arrived_stop: {
    label: 'Llegó a parada',
    icon: <MapPin className="h-4 w-4" />,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
  },
  route_completed: {
    label: 'Ruta completada',
    icon: <Flag className="h-4 w-4" />,
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/20',
  },
  signal_lost: {
    label: 'Señal perdida',
    icon: <WifiOff className="h-4 w-4" />,
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/20',
    borderClass: 'border-border/50',
  },
  signal_recovered: {
    label: 'Señal recuperada',
    icon: <Wifi className="h-4 w-4" />,
    colorClass: 'text-teal-400',
    bgClass: 'bg-teal-500/10',
    borderClass: 'border-teal-500/20',
  },
  geofence_entry: {
    label: 'Entrada a geocerca',
    icon: <Circle className="h-4 w-4" />,
    colorClass: 'text-violet-400',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500/20',
  },
  geofence_exit: {
    label: 'Salida de geocerca',
    icon: <Circle className="h-4 w-4" />,
    colorClass: 'text-purple-400',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
  },
};

function fmtTs(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `Hace ${diffH}h`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function payloadSummary(type: AlertType, payload: Record<string, unknown>): string {
  switch (type) {
    case 'off_route':     return `Desviación: ${payload.deviation_m ?? '?'} m`;
    case 'speeding':      return `${payload.speed_kmh ?? '?'} km/h (límite ${payload.limit_kmh ?? '?'})`;
    case 'long_stop':     return `Parado ${payload.minutes ?? '?'} min`;
    case 'arrived_stop':  return `Parada: ${payload.stop_name ?? 'sin nombre'}`;
    case 'geofence_entry':return `Geocerca: ${payload.geofence_name ?? payload.geofence_id ?? ''}`;
    case 'geofence_exit': return `Geocerca: ${payload.geofence_name ?? payload.geofence_id ?? ''}`;
    case 'emergency':     return payload.message ? String(payload.message) : 'Presionó el botón de panico';
    default:              return '';
  }
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all',     label: 'Todas' },
  { key: 'unread',  label: 'Sin resolver' },
  { key: 'emergency', label: 'Emergencias' },
  { key: 'critical',  label: 'Críticas' },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export function NotificationsPage() {
  const supabase = createSupabaseBrowserClient();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [resolving, setResolving] = useState<Set<string>>(new Set());

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string | undefined;
      if (!tenantId) return;

      const { data, error } = await supabase
        .from('alerts')
        .select(`
          id, tenant_id, vehicle_id, route_id, alert_type, severity,
          payload, is_resolved, resolved_at, resolved_by, resolution_note, created_at,
          vehicles(plate, alias)
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data ?? []).map((a: any) => ({
        ...a,
        vehicle_plate: a.vehicles?.plate ?? '—',
        vehicle_alias: a.vehicles?.alias ?? null,
      }));
      setAlerts(mapped as Alert[]);
    } catch (err) {
      console.error('[Notifications] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void fetchAlerts(); }, [fetchAlerts]);

  // ── Realtime: nuevas alertas ──────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
      }, () => { void fetchAlerts(); })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'alerts',
      }, () => { void fetchAlerts(); })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [supabase, fetchAlerts]);

  // ── Resolver alerta ───────────────────────────────────────────────────────
  const resolveAlert = async (id: string) => {
    setResolving((prev) => new Set(prev).add(id));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase
        .from('alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: session?.user?.id ?? null,
        })
        .eq('id', id);
      setAlerts((prev) =>
        prev.map((a) => a.id === id ? { ...a, is_resolved: true } : a),
      );
    } finally {
      setResolving((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  // Resolver todas las visibles
  const resolveAll = async () => {
    const toResolve = filtered.filter((a) => !a.is_resolved).map((a) => a.id);
    if (!toResolve.length) return;
    setResolving(new Set(toResolve));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase
        .from('alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: session?.user?.id ?? null,
        })
        .in('id', toResolve);
      setAlerts((prev) =>
        prev.map((a) => toResolve.includes(a.id) ? { ...a, is_resolved: true } : a),
      );
    } finally {
      setResolving(new Set());
    }
  };

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtered = alerts.filter((a) => {
    if (filter === 'unread')      return !a.is_resolved;
    if (filter === 'emergency')   return a.alert_type === 'emergency';
    if (filter === 'critical')    return a.severity === 'critical';
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.is_resolved).length;
  const emergencyCount = alerts.filter((a) => a.alert_type === 'emergency' && !a.is_resolved).length;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-border/50 bg-card/60 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-base font-bold">Notificaciones</h1>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} sin resolver${emergencyCount > 0 ? ` · ${emergencyCount} emergencia${emergencyCount !== 1 ? 's' : ''}` : ''}`
                  : 'Todo al día'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchAlerts()}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 transition-colors disabled:opacity-50"
              title="Actualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void resolveAll()}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Resolver todas
              </button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              {label}
              {key === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500/20 text-red-400 px-1 text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
              {key === 'emergency' && emergencyCount > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500/20 text-red-400 px-1 text-[10px] font-bold">
                  {emergencyCount}
                </span>
              )}
            </button>
          ))}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1">
            <Filter className="h-3 w-3" />
            {filtered.length} alertas
          </div>
        </div>
      </div>

      {/* ── Lista de alertas ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && alerts.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Bell className="h-10 w-10 opacity-20" />
            <p className="text-sm">
              {filter === 'all' ? 'Sin alertas registradas' : 'Sin alertas en este filtro'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            <AnimatePresence initial={false}>
              {filtered.map((alert) => {
                const meta = ALERT_META[alert.alert_type] ?? ALERT_META.off_route;
                const isEmergency = alert.alert_type === 'emergency';
                const summary = payloadSummary(alert.alert_type, alert.payload);
                const isResolvingThis = resolving.has(alert.id);

                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`group flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/20 ${
                      alert.is_resolved ? 'opacity-50' : ''
                    } ${isEmergency && !alert.is_resolved ? 'bg-red-500/5' : ''}`}
                  >
                    {/* Indicador de no-leído */}
                    <div className="flex-shrink-0 pt-1">
                      {!alert.is_resolved ? (
                        <span className="flex h-2 w-2 rounded-full bg-primary" />
                      ) : (
                        <span className="flex h-2 w-2 rounded-full bg-transparent" />
                      )}
                    </div>

                    {/* Icono */}
                    <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border ${meta.bgClass} ${meta.borderClass} ${meta.colorClass}`}>
                      {isEmergency && !alert.is_resolved ? (
                        <motion.div
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ repeat: Infinity, duration: 1.2 }}
                        >
                          {meta.icon}
                        </motion.div>
                      ) : meta.icon}
                    </div>

                    {/* Contenido */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${meta.colorClass}`}>
                          {meta.label}
                        </p>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          alert.severity === 'critical'
                            ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : alert.severity === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-muted/20 text-muted-foreground border-border/40'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>

                      <p className="text-sm text-foreground font-medium mt-0.5">
                        {alert.vehicle_alias ?? alert.vehicle_plate}
                        {alert.vehicle_alias && (
                          <span className="ml-1 text-xs text-muted-foreground">· {alert.vehicle_plate}</span>
                        )}
                      </p>

                      {summary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{summary}</p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[11px] text-muted-foreground">{fmtTs(alert.created_at)}</span>
                        {alert.is_resolved && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Resuelta
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acción resolver */}
                    {!alert.is_resolved && (
                      <div className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => void resolveAlert(alert.id)}
                          disabled={isResolvingThis}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          {isResolvingThis ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-emerald-400 border-t-transparent" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Resolver
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
