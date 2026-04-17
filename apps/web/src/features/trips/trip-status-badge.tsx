'use client';
// ─── features/trips/trip-status-badge.tsx ────────────────────────────────────

import type { TripStatus } from './ports/ITripRepository';

const STATUS_META: Record<TripStatus, { label: string; className: string }> = {
  draft:          { label: 'Borrador',       className: 'bg-muted/30 text-muted-foreground border-border' },
  scheduled:      { label: 'Programado',     className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  confirmed:      { label: 'Confirmado',     className: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  in_transit:     { label: 'En tránsito',    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  at_destination: { label: 'En destino',     className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  completed:      { label: 'Completado',     className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  closed:         { label: 'Cerrado',        className: 'bg-muted/30 text-muted-foreground border-border' },
  cancelled:      { label: 'Cancelado',      className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  const meta = STATUS_META[status] ?? { label: status, className: 'bg-muted/30 text-muted-foreground border-border' };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}
