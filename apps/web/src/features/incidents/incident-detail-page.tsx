'use client';
// ─── features/incidents/incident-detail-page.tsx ─────────────────────────────
// Vista de detalle de un incidente: metadata, estado, evidencias, resolución.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, RefreshCw } from 'lucide-react';
import {
  useIncident,
  useIncidentEvidence,
  useUpdateIncident,
  type IncidentStatus,
  type IncidentSeverity,
} from './use-incidents';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  mechanical: 'Mecánico', route_deviation: 'Desvío de ruta',
  accident: 'Accidente', weather: 'Condiciones climáticas',
  cargo: 'Problema de carga', other: 'Otro',
};
const SEVERITY_LABELS: Record<string, string> = {
  low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Crítico',
};
const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto', in_review: 'En revisión', resolved: 'Resuelto', closed: 'Cerrado',
};
const SEVERITY_COLORS: Record<string, string> = {
  low:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
};
const STATUS_COLORS: Record<string, string> = {
  open:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  in_review: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  resolved:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  closed:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

// ─── Resolution panel ─────────────────────────────────────────────────────────

function ResolutionPanel({ incidentId, currentStatus }: {
  incidentId: string;
  currentStatus: IncidentStatus;
}) {
  const [status,     setStatus]     = useState<IncidentStatus>(currentStatus);
  const [resolution, setResolution] = useState('');
  const [severity,   setSeverity]   = useState<IncidentSeverity | ''>('');
  const update = useUpdateIncident();

  const canSave = status !== currentStatus || resolution.trim() || severity;

  const handleSave = () => {
    update.mutate({
      id: incidentId,
      input: {
        status:     status !== currentStatus ? status : undefined,
        resolution: resolution.trim() || undefined,
        severity:   severity || undefined,
      },
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Gestionar incidente</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as IncidentStatus)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="open">Abierto</option>
            <option value="in_review">En revisión</option>
            <option value="resolved">Resuelto</option>
            <option value="closed">Cerrado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Ajustar gravedad</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IncidentSeverity | '')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Sin cambio</option>
            <option value="low">Bajo</option>
            <option value="medium">Medio</option>
            <option value="high">Alto</option>
            <option value="critical">Crítico</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Notas de resolución</label>
        <textarea
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={3}
          placeholder="Describe cómo se resolvió el incidente…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!canSave || update.isPending}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
      >
        {update.isPending ? 'Guardando…' : 'Guardar cambios'}
      </button>
      {update.isError && (
        <p className="text-xs text-destructive">{(update.error as Error).message}</p>
      )}
    </div>
  );
}

// ─── Evidence gallery ─────────────────────────────────────────────────────────

function EvidenceGallery({ incidentId }: { incidentId: string }) {
  const { data: evidence, isLoading } = useIncidentEvidence(incidentId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando evidencias…</p>;
  if (!evidence?.length) return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      Sin evidencias adjuntas
    </div>
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {evidence.map((ev) => (
        <a key={ev.id} href={ev.file_url} target="_blank" rel="noopener noreferrer">
          <div className="aspect-square rounded-xl overflow-hidden border border-border bg-muted hover:opacity-90 transition-opacity">
            {ev.media_type.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ev.file_url} alt={ev.file_name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <span className="text-2xl">📎</span>
                <span className="text-xs text-muted-foreground text-center px-2 truncate max-w-full">{ev.file_name}</span>
              </div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function IncidentDetailPage({ incidentId }: { incidentId: string }) {
  const { data: incident, isLoading, error } = useIncident(incidentId);

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
      <RefreshCw className="h-5 w-5 animate-spin" /> Cargando…
    </div>
  );

  if (error || !incident) return (
    <div className="flex-1 p-6 text-sm text-destructive">
      No se encontró el incidente o no tienes acceso.
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6">
      <div className="flex flex-col gap-6">
        {/* Back */}
      <Link href="/incidents" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" /> Incidentes
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{incident.code}</span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEVERITY_COLORS[incident.severity]}`}>
              {SEVERITY_LABELS[incident.severity]}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[incident.status]}`}>
              {STATUS_LABELS[incident.status]}
            </span>
          </div>
          <h1 className="text-xl font-bold mt-2">{TYPE_LABELS[incident.type]}</h1>
          {incident.description && (
            <p className="text-sm text-muted-foreground mt-1">{incident.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metadata */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Detalles</h2>
            <MetaRow label="Código"     value={incident.code} />
            <MetaRow label="Tipo"       value={TYPE_LABELS[incident.type]} />
            <MetaRow label="Gravedad"   value={SEVERITY_LABELS[incident.severity]} />
            <MetaRow label="Estado"     value={STATUS_LABELS[incident.status]} />
            <MetaRow label="Conductor"  value={incident.driver_email ?? incident.driver_id.slice(0, 8)} />
            {incident.vehicle_plate && <MetaRow label="Vehículo" value={incident.vehicle_plate} />}
            <MetaRow label="Reportado"  value={fmtDate(incident.created_at)} />
            {incident.resolved_at && <MetaRow label="Resuelto" value={fmtDate(incident.resolved_at)} />}
            {incident.lat != null && incident.lng != null && (
              <MetaRow
                label="Ubicación"
                value={
                  <a
                    href={`https://maps.google.com/?q=${incident.lat},${incident.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <MapPin className="h-3 w-3" />
                    {incident.lat.toFixed(5)}, {incident.lng.toFixed(5)}
                  </a>
                }
              />
            )}
          </div>

          {incident.resolution && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Resolución</h2>
              <p className="text-sm">{incident.resolution}</p>
            </div>
          )}

          {/* Evidencias */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Evidencias {(incident.evidence_count ?? 0) > 0 && `(${incident.evidence_count})`}
            </h2>
            <EvidenceGallery incidentId={incident.id} />
          </div>
        </div>

        {/* Actions */}
        <div>
          {incident.status !== 'closed' && (
            <ResolutionPanel incidentId={incident.id} currentStatus={incident.status} />
          )}
          {incident.status === 'closed' && (
            <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground text-center">
              Incidente cerrado
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
