'use client';
// ─── features/incidents/incidents-page.tsx ───────────────────────────────────
// Lista de incidentes con filtros por tipo, gravedad y estado.

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import {
  useIncidents,
  type IncidentRow,
  type IncidentType,
  type IncidentSeverity,
  type IncidentStatus,
} from './use-incidents';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<IncidentType, string> = {
  mechanical:      'Mecánico',
  route_deviation: 'Desvío',
  accident:        'Accidente',
  weather:         'Clima',
  cargo:           'Carga',
  other:           'Otro',
};

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  low:      'Bajo',
  medium:   'Medio',
  high:     'Alto',
  critical: 'Crítico',
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open:      'Abierto',
  in_review: 'En revisión',
  resolved:  'Resuelto',
  closed:    'Cerrado',
};

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  low:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATUS_COLORS: Record<IncidentStatus, string> = {
  open:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  in_review: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  resolved:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  closed:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function IncidentRow({ incident }: { incident: IncidentRow }) {
  return (
    <Link href={`/incidents/${incident.id}`}>
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{incident.code}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[incident.severity]}`}>
              {SEVERITY_LABELS[incident.severity]}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[incident.status]}`}>
              {STATUS_LABELS[incident.status]}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-foreground truncate">
            {TYPE_LABELS[incident.type]}
            {incident.description ? ` — ${incident.description}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {incident.driver_email ?? incident.driver_id.slice(0, 8)}
            {incident.vehicle_plate ? ` · ${incident.vehicle_plate}` : ''}
            {' · '}{fmtDate(incident.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {(incident.evidence_count ?? 0) > 0 && (
            <span className="text-xs text-muted-foreground">📷 {incident.evidence_count}</span>
          )}
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: Array<{ value: IncidentType | ''; label: string }> = [
  { value: '', label: 'Todos los tipos' },
  { value: 'mechanical',      label: 'Mecánico' },
  { value: 'route_deviation', label: 'Desvío' },
  { value: 'accident',        label: 'Accidente' },
  { value: 'weather',         label: 'Clima' },
  { value: 'cargo',           label: 'Carga' },
  { value: 'other',           label: 'Otro' },
];

const SEVERITY_OPTIONS: Array<{ value: IncidentSeverity | ''; label: string }> = [
  { value: '', label: 'Todas las gravedades' },
  { value: 'low',      label: 'Bajo' },
  { value: 'medium',   label: 'Medio' },
  { value: 'high',     label: 'Alto' },
  { value: 'critical', label: 'Crítico' },
];

const STATUS_OPTIONS: Array<{ value: IncidentStatus | ''; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'open',      label: 'Abierto' },
  { value: 'in_review', label: 'En revisión' },
  { value: 'resolved',  label: 'Resuelto' },
  { value: 'closed',    label: 'Cerrado' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function IncidentsPage() {
  const [typeFilter,     setTypeFilter]     = useState<IncidentType | ''>('');
  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | ''>('');
  const [statusFilter,   setStatusFilter]   = useState<IncidentStatus | ''>('');

  const { data: incidents, isLoading, error, refetch } = useIncidents({
    type:     typeFilter     || undefined,
    severity: severityFilter || undefined,
    status:   statusFilter   || undefined,
  });

  const openCount     = incidents?.filter((i) => i.status === 'open').length ?? 0;
  const criticalCount = incidents?.filter((i) => i.severity === 'critical').length ?? 0;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incidentes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reporte de eventos durante los viajes
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: incidents?.length ?? 0,      color: 'text-foreground' },
          { label: 'Abiertos',    value: openCount,                   color: 'text-blue-400' },
          { label: 'Críticos',    value: criticalCount,               color: 'text-red-400' },
          { label: 'Resueltos',   value: incidents?.filter((i) => i.status === 'resolved').length ?? 0, color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as IncidentType | '')}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as IncidentSeverity | '')}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | '')}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Cargando incidentes…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : incidents?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 opacity-20" />
          <p className="text-sm">No hay incidentes con los filtros seleccionados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {incidents!.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} />
          ))}
        </div>
      )}
    </div>
  );
}
