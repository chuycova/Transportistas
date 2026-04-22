'use client';
// ─── features/notifications/notification-toast.tsx ───────────────────────────
// Toast en tiempo real para alertas nuevas.
// - Se descarta arrastrando de izquierda a derecha (drag-to-dismiss).
// - Mini botón X para cerrar manualmente.
// - Respeta el tema (light/dark) usando las variables CSS del sistema de diseño.

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  AlertTriangle, Zap, Navigation, MapPin, Flag,
  WifiOff, Wifi, Siren, Circle, Bell, X,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertType =
  | 'emergency' | 'off_route' | 'speeding' | 'long_stop'
  | 'arrived_stop' | 'route_completed' | 'signal_lost'
  | 'signal_recovered' | 'geofence_entry' | 'geofence_exit';

interface ToastAlert {
  id: string;
  toastId: string; // unique per-toast instance
  alert_type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  vehicle_plate?: string;
  vehicle_alias?: string | null;
  created_at: string;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const ALERT_META: Record<AlertType, {
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  glowClass: string;
}> = {
  emergency:        { label: 'SOS — Emergencia',       icon: <Siren className="h-4 w-4" />,         colorClass: 'text-red-400',          bgClass: 'bg-red-500/12',      borderClass: 'border-red-500/50',    glowClass: 'shadow-red-500/15' },
  off_route:        { label: 'Desvío de ruta',          icon: <Navigation className="h-4 w-4" />,    colorClass: 'text-amber-400',        bgClass: 'bg-amber-500/10',    borderClass: 'border-amber-500/35',  glowClass: 'shadow-amber-500/10' },
  speeding:         { label: 'Exceso de velocidad',     icon: <Zap className="h-4 w-4" />,           colorClass: 'text-orange-400',       bgClass: 'bg-orange-500/10',   borderClass: 'border-orange-500/35', glowClass: 'shadow-orange-500/10' },
  long_stop:        { label: 'Parada prolongada',       icon: <AlertTriangle className="h-4 w-4" />, colorClass: 'text-yellow-400',       bgClass: 'bg-yellow-500/10',   borderClass: 'border-yellow-500/25', glowClass: 'shadow-yellow-500/10' },
  arrived_stop:     { label: 'Llegó a parada',          icon: <MapPin className="h-4 w-4" />,        colorClass: 'text-emerald-400',      bgClass: 'bg-emerald-500/10',  borderClass: 'border-emerald-500/25',glowClass: 'shadow-emerald-500/10' },
  route_completed:  { label: 'Ruta completada',         icon: <Flag className="h-4 w-4" />,          colorClass: 'text-blue-400',         bgClass: 'bg-blue-500/10',     borderClass: 'border-blue-500/25',   glowClass: 'shadow-blue-500/10' },
  signal_lost:      { label: 'Señal perdida',           icon: <WifiOff className="h-4 w-4" />,       colorClass: 'text-muted-foreground', bgClass: 'bg-muted/15',        borderClass: 'border-border/50',     glowClass: '' },
  signal_recovered: { label: 'Señal recuperada',        icon: <Wifi className="h-4 w-4" />,          colorClass: 'text-teal-400',         bgClass: 'bg-teal-500/10',     borderClass: 'border-teal-500/25',   glowClass: 'shadow-teal-500/10' },
  geofence_entry:   { label: 'Entrada a geocerca',      icon: <Circle className="h-4 w-4" />,        colorClass: 'text-violet-400',       bgClass: 'bg-violet-500/10',   borderClass: 'border-violet-500/25', glowClass: 'shadow-violet-500/10' },
  geofence_exit:    { label: 'Salida de geocerca',      icon: <Circle className="h-4 w-4" />,        colorClass: 'text-purple-400',       bgClass: 'bg-purple-500/10',   borderClass: 'border-purple-500/25', glowClass: 'shadow-purple-500/10' },
};

const AUTO_DISMISS_MS = 6000;

// ─── Single Toast ─────────────────────────────────────────────────────────────

interface SingleToastProps {
  alert: ToastAlert;
  onDismiss: (toastId: string) => void;
}

function SingleToast({ alert, onDismiss }: SingleToastProps) {
  const meta = ALERT_META[alert.alert_type] ?? ALERT_META.off_route;
  const isEmergency = alert.alert_type === 'emergency';

  // Drag-to-dismiss (left → right)
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 120], [1, 0]);
  const isDraggingRef = useRef(false);

  // Auto-dismiss timer
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(alert.toastId), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [alert.toastId, onDismiss]);

  const handleDragEnd = () => {
    if (x.get() > 80) {
      // Animate off-screen then dismiss
      void animate(x, 320, { duration: 0.25, ease: 'easeOut' }).then(() => {
        onDismiss(alert.toastId);
      });
    } else {
      // Snap back
      void animate(x, 0, { duration: 0.3, ease: 'easeOut' });
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.18 } }}
      style={{ x, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 320 }}
      dragElastic={{ left: 0, right: 0.3 }}
      onDragStart={() => { isDraggingRef.current = true; }}
      onDragEnd={handleDragEnd}
      className={`relative w-80 cursor-grab active:cursor-grabbing select-none`}
    >
      <div
        className={`
          flex items-start gap-3 rounded-2xl border px-4 py-3.5
          bg-card/95 backdrop-blur-md
          shadow-xl ${meta.glowClass}
          ${meta.borderClass}
          ${isEmergency && !false ? 'ring-1 ring-red-500/30' : ''}
          overflow-hidden
        `}
      >
        {/* Progress bar (auto-dismiss indicator) */}
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] bg-current opacity-25 rounded-b-2xl"
          style={{ color: 'var(--color-primary)' }}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
        />

        {/* Icon */}
        <div className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border ${meta.bgClass} ${meta.borderClass} ${meta.colorClass} mt-0.5`}>
          {isEmergency ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            >
              {meta.icon}
            </motion.div>
          ) : (
            meta.icon
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`text-xs font-bold ${meta.colorClass} leading-tight`}>
                {meta.label}
              </p>
              <p className="text-sm font-medium text-foreground mt-0.5 leading-tight truncate">
                {alert.vehicle_alias ?? alert.vehicle_plate}
                {alert.vehicle_alias && (
                  <span className="ml-1 text-xs text-muted-foreground">· {alert.vehicle_plate}</span>
                )}
              </p>
            </div>

            {/* Close button */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(alert.toastId);
              }}
              className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors mt-0.5"
              aria-label="Cerrar notificación"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Severity badge */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
              alert.severity === 'critical'
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : alert.severity === 'warning'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-muted/20 text-muted-foreground border-border/40'
            }`}>
              {alert.severity}
            </span>
            <span className="text-[10px] text-muted-foreground">Desliza para descartar</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Toast Provider / Container ───────────────────────────────────────────────
// Mounts once in AppShell, subscribes to Realtime INSERTs,
// renders toasts stacked in the bottom-right corner.

export function NotificationToastContainer() {
  const supabase = createSupabaseBrowserClient();
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  // Keep the last seen alert IDs so we don't re-toast on re-mount
  const seenRef = useRef<Set<string>>(new Set());

  const dismiss = useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleNewAlert = async (payload: any) => {
      const raw = payload?.new as Record<string, unknown> | undefined;
      if (!raw?.id || seenRef.current.has(raw.id as string)) return;
      seenRef.current.add(raw.id as string);

      // Enrich with vehicle info
      let vehicle_plate = '—';
      let vehicle_alias: string | null = null;
      if (raw.vehicle_id) {
        const { data } = await supabase
          .from('vehicles')
          .select('plate, alias')
          .eq('id', raw.vehicle_id as string)
          .single();
        if (data) {
          vehicle_plate = data.plate;
          vehicle_alias = data.alias ?? null;
        }
      }

      const toast: ToastAlert = {
        id: raw.id as string,
        toastId: `${raw.id as string}-${Date.now()}`,
        alert_type: raw.alert_type as AlertType,
        severity: raw.severity as 'info' | 'warning' | 'critical',
        vehicle_plate,
        vehicle_alias,
        created_at: raw.created_at as string ?? new Date().toISOString(),
      };

      setToasts((prev) => [toast, ...prev].slice(0, 5)); // max 5 stacked
    };

    const channel = supabase
      .channel('toast-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
      }, (payload) => { void handleNewAlert(payload); })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [supabase]);

  return (
    // Fixed container: bottom-right, above everything
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2 items-end pointer-events-none"
      aria-live="assertive"
      aria-label="Notificaciones en tiempo real"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.toastId} className="pointer-events-auto">
            <SingleToast alert={toast} onDismiss={dismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
