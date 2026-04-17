'use client';
// ─── features/trips/trip-detail-page.tsx ─────────────────────────────────────
// Vista de detalle de un viaje. Muestra estado, actores, alertas relacionadas
// y permite actualizar el estado desde aquí también.

import Link from 'next/link';
import { ArrowLeft, Truck, MapPin, Navigation, Package, Clock, User, Route as RouteIcon, Calendar } from 'lucide-react';
import { useTrip, useUpdateTripStatus, type TripStatus } from './use-trips';
import { TripStatusBadge } from './trip-status-badge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDistance(km: number | null) {
  if (!km) return '—';
  return `${km.toFixed(1)} km`;
}

function fmtDuration(min: number | null) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

// ─── Timeline de estado ───────────────────────────────────────────────────────

const STATUS_TIMELINE: { status: TripStatus; label: string }[] = [
  { status: 'scheduled',      label: 'Programado' },
  { status: 'confirmed',      label: 'Confirmado' },
  { status: 'in_transit',     label: 'En tránsito' },
  { status: 'at_destination', label: 'En destino' },
  { status: 'completed',      label: 'Completado' },
];

const STATUS_ORDER_IDX: Partial<Record<TripStatus, number>> = {
  draft: -1, scheduled: 0, confirmed: 1, in_transit: 2, at_destination: 3, completed: 4, closed: 4, cancelled: -2,
};

function StatusTimeline({ current }: { current: TripStatus }) {
  const currentIdx = STATUS_ORDER_IDX[current] ?? 0;
  const isCancelled = current === 'cancelled';

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
        <span className="text-sm font-medium text-red-400">Viaje cancelado</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0">
      {STATUS_TIMELINE.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const pending = i > currentIdx;
        return (
          <div key={step.status} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`h-3 w-3 rounded-full border-2 transition-colors ${
                done   ? 'bg-emerald-500 border-emerald-500' :
                active ? 'bg-primary border-primary ring-2 ring-primary/30' :
                         'bg-muted border-border'
              }`} />
              <span className={`text-[10px] font-medium whitespace-nowrap ${
                active ? 'text-primary' : done ? 'text-emerald-500' : 'text-muted-foreground'
              }`}>{step.label}</span>
            </div>
            {i < STATUS_TIMELINE.length - 1 && (
              <div className={`h-0.5 w-8 mx-0.5 transition-colors ${done ? 'bg-emerald-500' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function TripDetailPage({ id }: { id: string }) {
  const { data: trip, isLoading, error } = useTrip(id);
  const updateStatus = useUpdateTripStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Cargando viaje...
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-muted-foreground">Viaje no encontrado.</p>
        <Link href="/trips" className="text-sm text-primary hover:underline">← Volver a viajes</Link>
      </div>
    );
  }

  const canConfirm       = trip.status === 'scheduled' || trip.status === 'draft';
  const canStart         = trip.status === 'confirmed';
  const canAtDestination = trip.status === 'in_transit';
  const canComplete      = trip.status === 'at_destination';
  const canCancel        = !['completed', 'closed', 'cancelled'].includes(trip.status);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Back nav + header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 shrink-0">
        <Link
          href="/trips"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{trip.code}</span>
            <TripStatusBadge status={trip.status} />
          </div>
          <h1 className="text-sm font-semibold text-foreground truncate mt-0.5">
            {trip.origin_name} → {trip.dest_name}
          </h1>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Timeline */}
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Estado del viaje
          </h2>
          <StatusTimeline current={trip.status} />
          {trip.cancellation_reason && (
            <p className="mt-3 text-xs text-muted-foreground">
              Motivo: {trip.cancellation_reason}
            </p>
          )}
        </div>

        {/* Acciones */}
        {(canConfirm || canStart || canAtDestination || canComplete || canCancel) && (
          <div className="flex flex-wrap gap-2">
            {canConfirm && (
              <button
                onClick={() => updateStatus.mutate({ id: trip.id, status: 'confirmed' })}
                disabled={updateStatus.isPending}
                className="flex items-center gap-2 rounded-xl bg-violet-500/15 border border-violet-500/30 px-4 py-2.5 text-sm font-semibold text-violet-400 hover:bg-violet-500/25 disabled:opacity-50 transition-colors"
              >
                Confirmar viaje
              </button>
            )}
            {canStart && (
              <button
                onClick={() => updateStatus.mutate({ id: trip.id, status: 'in_transit' })}
                disabled={updateStatus.isPending}
                className="flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
              >
                Iniciar viaje
              </button>
            )}
            {canAtDestination && (
              <button
                onClick={() => updateStatus.mutate({ id: trip.id, status: 'at_destination' })}
                disabled={updateStatus.isPending}
                className="flex items-center gap-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 px-4 py-2.5 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-50 transition-colors"
              >
                Marcar en destino
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => updateStatus.mutate({ id: trip.id, status: 'completed' })}
                disabled={updateStatus.isPending}
                className="flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
              >
                Completar viaje
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => updateStatus.mutate({ id: trip.id, status: 'cancelled' })}
                disabled={updateStatus.isPending}
                className="ml-auto flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        )}

        {/* Actores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/60 bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conductor</span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {trip.driver?.full_name ?? <span className="text-muted-foreground">Sin asignar</span>}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vehículo</span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {trip.vehicle
                ? <>{trip.vehicle.plate}{trip.vehicle.alias && <span className="text-muted-foreground text-xs ml-1">· {trip.vehicle.alias}</span>}</>
                : <span className="text-muted-foreground">Sin asignar</span>
              }
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <RouteIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ruta base</span>
            </div>
            <p className="text-sm font-medium text-foreground">
              {trip.route?.name ?? <span className="text-muted-foreground">Sin ruta</span>}
            </p>
          </div>
        </div>

        {/* Trayecto */}
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Trayecto</h2>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 pt-0.5">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <div className="w-0.5 h-8 bg-border" />
              <div className="h-3 w-3 rounded-full bg-red-500" />
            </div>
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs text-muted-foreground">Origen</p>
                <p className="text-sm font-medium text-foreground">{trip.origin_name}</p>
                <p className="text-xs text-muted-foreground/60">{trip.origin_lat.toFixed(5)}, {trip.origin_lng.toFixed(5)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Destino</p>
                <p className="text-sm font-medium text-foreground">{trip.dest_name}</p>
                <p className="text-xs text-muted-foreground/60">{trip.dest_lat.toFixed(5)}, {trip.dest_lng.toFixed(5)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas + Tiempos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Dist. estimada', value: fmtDistance(trip.estimated_distance_km) },
            { label: 'Tiempo est.',    value: fmtDuration(trip.estimated_duration_min) },
            { label: 'Dist. real',     value: fmtDistance(trip.actual_distance_km) },
            { label: 'Peso (ton)',     value: trip.weight_tons ? `${trip.weight_tons} t` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-card/60 p-3">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-base font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Carga */}
        {(trip.cargo_type || trip.container_numbers) && (
          <div className="rounded-xl border border-border/60 bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Carga</h2>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {trip.cargo_type && (
                <><dt className="text-muted-foreground">Tipo</dt><dd className="text-foreground font-medium">{trip.cargo_type}</dd></>
              )}
              {trip.container_numbers && (
                <><dt className="text-muted-foreground">Contenedores</dt><dd className="text-foreground font-medium font-mono text-xs">{trip.container_numbers}</dd></>
              )}
            </dl>
          </div>
        )}

        {/* Fechas */}
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fechas</h2>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Programado</dt>
            <dd className="text-foreground">{fmtDate(trip.scheduled_at)}</dd>
            <dt className="text-muted-foreground">Inicio real</dt>
            <dd className="text-foreground">{fmtDate(trip.started_at)}</dd>
            <dt className="text-muted-foreground">Finalización</dt>
            <dd className="text-foreground">{fmtDate(trip.completed_at)}</dd>
            <dt className="text-muted-foreground">Creado</dt>
            <dd className="text-foreground">{fmtDate(trip.created_at)}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
