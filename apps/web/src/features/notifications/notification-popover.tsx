'use client';
// ─── features/notifications/notification-popover.tsx ─────────────────────────
// Popover de resumen rápido que aparece al pasar el cursor sobre el botón Bell.
// Muestra las últimas 5 alertas sin resolver con icono, vehículo y timestamp.

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, AlertTriangle, Zap, Navigation, MapPin, Flag,
  WifiOff, Wifi, Siren, Circle, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType =
  | 'emergency' | 'off_route' | 'speeding' | 'long_stop'
  | 'arrived_stop' | 'route_completed' | 'signal_lost'
  | 'signal_recovered' | 'geofence_entry' | 'geofence_exit';

interface AlertPreview {
  id: string;
  alert_type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  is_resolved: boolean;
  created_at: string;
  vehicle_plate?: string;
  vehicle_alias?: string | null;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const ALERT_META: Record<AlertType, { label: string; icon: React.ReactNode; colorClass: string; bgClass: string; borderClass: string }> = {
  emergency:        { label: 'SOS — Emergencia',       icon: <Siren className="h-3.5 w-3.5" />,         colorClass: 'text-red-400',              bgClass: 'bg-red-500/15',      borderClass: 'border-red-500/40' },
  off_route:        { label: 'Desvío de ruta',          icon: <Navigation className="h-3.5 w-3.5" />,    colorClass: 'text-amber-400',            bgClass: 'bg-amber-500/10',    borderClass: 'border-amber-500/30' },
  speeding:         { label: 'Exceso de velocidad',     icon: <Zap className="h-3.5 w-3.5" />,           colorClass: 'text-orange-400',           bgClass: 'bg-orange-500/10',   borderClass: 'border-orange-500/30' },
  long_stop:        { label: 'Parada prolongada',       icon: <AlertTriangle className="h-3.5 w-3.5" />, colorClass: 'text-yellow-400',           bgClass: 'bg-yellow-500/10',   borderClass: 'border-yellow-500/20' },
  arrived_stop:     { label: 'Llegó a parada',          icon: <MapPin className="h-3.5 w-3.5" />,        colorClass: 'text-emerald-400',          bgClass: 'bg-emerald-500/10',  borderClass: 'border-emerald-500/20' },
  route_completed:  { label: 'Ruta completada',         icon: <Flag className="h-3.5 w-3.5" />,          colorClass: 'text-blue-400',             bgClass: 'bg-blue-500/10',     borderClass: 'border-blue-500/20' },
  signal_lost:      { label: 'Señal perdida',           icon: <WifiOff className="h-3.5 w-3.5" />,       colorClass: 'text-muted-foreground',     bgClass: 'bg-muted/20',        borderClass: 'border-border/50' },
  signal_recovered: { label: 'Señal recuperada',        icon: <Wifi className="h-3.5 w-3.5" />,          colorClass: 'text-teal-400',             bgClass: 'bg-teal-500/10',     borderClass: 'border-teal-500/20' },
  geofence_entry:   { label: 'Entrada a geocerca',      icon: <Circle className="h-3.5 w-3.5" />,        colorClass: 'text-violet-400',           bgClass: 'bg-violet-500/10',   borderClass: 'border-violet-500/20' },
  geofence_exit:    { label: 'Salida de geocerca',      icon: <Circle className="h-3.5 w-3.5" />,        colorClass: 'text-purple-400',           bgClass: 'bg-purple-500/10',   borderClass: 'border-purple-500/20' },
};

function fmtTs(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1)  return 'Ahora';
  if (diffMin < 60) return `${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  if (h < 24)       return `${h}h`;
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useAlertPreviews() {
  const supabase = createSupabaseBrowserClient();
  const [alerts, setAlerts] = useState<AlertPreview[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const tenantId = session?.user?.user_metadata?.tenant_id as string | undefined;
      if (!tenantId || cancelled) return;

      const { data } = await supabase
        .from('alerts')
        .select('id, alert_type, severity, is_resolved, created_at, vehicles(plate, alias)')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data ?? []).map((a: any) => ({
        ...a,
        vehicle_plate: a.vehicles?.plate ?? '—',
        vehicle_alias: a.vehicles?.alias ?? null,
      })) as AlertPreview[];

      setAlerts(mapped);
      setUnread(mapped.filter((a) => !a.is_resolved).length);
    };

    void fetch();

    const channel = supabase
      .channel('popover-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => { void fetch(); })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { alerts, unread };
}

// ─── Popover ──────────────────────────────────────────────────────────────────

interface NotificationPopoverProps {
  /** Whether the popover should be shown */
  open: boolean;
}

function NotificationPopover({ open }: NotificationPopoverProps) {
  const { alerts, unread } = useAlertPreviews();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: -8, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -8, scale: 0.96 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          // Positioned to the right of the nav bar, growing upward
          className="absolute left-full bottom-0 ml-2 z-50 w-72 origin-bottom-left"
          role="dialog"
          aria-label="Resumen de notificaciones"
        >
          {/* Glass card */}
          <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bell className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-semibold">Notificaciones</span>
              </div>
              {unread > 0 && (
                <span className="rounded-full bg-red-500/15 text-red-400 border border-red-500/20 text-[10px] font-bold px-2 py-0.5">
                  {unread} sin resolver
                </span>
              )}
            </div>

            {/* Alert list */}
            {alerts.length === 0 ? (
              <div className="flex h-28 flex-col items-center justify-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 opacity-30" />
                <p className="text-xs">Todo al día</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {alerts.map((alert) => {
                  const meta = ALERT_META[alert.alert_type] ?? ALERT_META.off_route;
                  return (
                    <div
                      key={alert.id}
                      className={`flex items-center gap-3 px-4 py-2.5 ${alert.is_resolved ? 'opacity-45' : ''}`}
                    >
                      {/* Unread dot */}
                      <div className="flex-shrink-0">
                        {!alert.is_resolved
                          ? <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
                          : <span className="flex h-1.5 w-1.5" />}
                      </div>

                      {/* Icon */}
                      <div className={`flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg border ${meta.bgClass} ${meta.borderClass} ${meta.colorClass}`}>
                        {meta.icon}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${meta.colorClass}`}>{meta.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {alert.vehicle_alias ?? alert.vehicle_plate}
                        </p>
                      </div>

                      {/* Time */}
                      <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums">
                        {fmtTs(alert.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-border/40 px-4 py-2.5">
              <Link
                href="/notifications"
                className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-primary hover:bg-primary/8 transition-colors"
              >
                Ver todas las notificaciones
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Bell button with hover popover ──────────────────────────────────────────

interface NotificationBellProps {
  /** Whether the current page is /notifications (for active styling) */
  isActive: boolean;
  /** Unread count for badge */
  unreadCount: number;
}

export function NotificationBell({ isActive, unreadCount }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 180);
  };

  return (
    // Relative wrapper so the popover can be positioned beside the nav
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href="/notifications"
        id="nav-notifications"
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors mb-1 ${
          isActive
            ? 'bg-primary/20 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        title="Notificaciones"
        aria-label="Notificaciones"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>

      <NotificationPopover open={open} />
    </div>
  );
}
