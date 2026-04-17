'use client';
// ─── features/routes/route-sections.tsx ──────────────────────────────────────
// Secciones para la página de detalle de ruta (Fase 3):
//   - RouteSettingsSection    → risk_level, max_deviation_m, gps_timeout_s, max_speed_kmh
//   - CheckpointsSection      → CRUD de puntos de validación
//   - TollBoothsSection       → CRUD de casetas de peaje
//   - RouteAlternativesSection → CRUD de rutas alternativas

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ShieldAlert, MapPin, Plus, Trash2, Check, X,
  ChevronDown, AlertTriangle, DollarSign, GitBranch,
  GripVertical, Lock, Unlock,
} from 'lucide-react';
import {
  useRouteCheckpoints, useCreateCheckpoint, useUpdateCheckpoint, useDeleteCheckpoint,
  useTollBooths, useCreateTollBooth, useDeleteTollBooth,
  useRouteAlternatives, useCreateRouteAlternative, useToggleRouteAlternative, useDeleteRouteAlternative,
  useUpdateRouteSettings,
  type RouteSettings,
} from './use-route-enrichment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMXN(n: number | null) {
  if (!n) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}

function fmtDuration(s: number | null) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function fmtDistance(m: number | null) {
  if (!m) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

const RISK_META = {
  low:    { label: 'Bajo',  className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  medium: { label: 'Medio', className: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  high:   { label: 'Alto',  className: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

// ─── Section: Configuración de seguridad de ruta ──────────────────────────────

export function RouteSettingsSection({
  routeId,
  current = {},
}: {
  routeId: string;
  current?: Partial<RouteSettings>;
}) {
  const update = useUpdateRouteSettings();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<RouteSettings>>({
    risk_level:      current.risk_level ?? 'low',
    max_deviation_m: current.max_deviation_m ?? null,
    gps_timeout_s:   current.gps_timeout_s ?? null,
    max_speed_kmh:   current.max_speed_kmh ?? null,
  });

  async function handleSave() {
    await update.mutateAsync({ id: routeId, settings: form });
    setEditing(false);
  }

  const risk = RISK_META[form.risk_level ?? 'low'];

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Configuración de seguridad</h3>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
            Editar
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Nivel de riesgo</dt>
            <dd className="mt-0.5">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${RISK_META[current.risk_level ?? 'low'].className}`}>
                {RISK_META[current.risk_level ?? 'low'].label}
              </span>
            </dd>
          </div>
          {[
            ['Desviación máx.', current.max_deviation_m != null ? `${current.max_deviation_m} m` : null],
            ['Timeout GPS',      current.gps_timeout_s != null ? `${current.gps_timeout_s} s` : null],
            ['Vel. máxima',      current.max_speed_kmh != null ? `${current.max_speed_kmh} km/h` : null],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground mt-0.5">{(value as string) ?? '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nivel de riesgo</label>
            <div className="relative">
              <select
                value={form.risk_level}
                onChange={(e) => setForm((f) => ({ ...f, risk_level: e.target.value as RouteSettings['risk_level'] }))}
                className="w-full appearance-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="low">Bajo</option>
                <option value="medium">Medio</option>
                <option value="high">Alto</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['Desviación máx. (m)', 'max_deviation_m'],
              ['Timeout GPS (s)',      'gps_timeout_s'],
              ['Vel. máxima (km/h)',  'max_speed_kmh'],
            ] as [string, keyof RouteSettings][]).map(([label, key]) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                <input
                  type="number"
                  min={0}
                  value={(form[key] as number | null) ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="—"
                  className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={update.isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1"
            >
              {update.isPending ? 'Guardando…' : <><Check className="h-3 w-3" /> Guardar</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Checkpoints ─────────────────────────────────────────────────────

export function CheckpointsSection({ routeId }: { routeId: string }) {
  const { data: checkpoints = [], isLoading } = useRouteCheckpoints(routeId);
  const create = useCreateCheckpoint();
  const update = useUpdateCheckpoint();
  const del    = useDeleteCheckpoint();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', lat: '', lng: '', radius_m: '200',
    is_mandatory: true, description: '', estimated_arrival_offset_s: '',
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      routeId,
      name: form.name,
      order_index: checkpoints.length + 1,
      lat: Number(form.lat),
      lng: Number(form.lng),
      is_mandatory: form.is_mandatory,
      radius_m: Number(form.radius_m) || 200,
      description: form.description || undefined,
      estimated_arrival_offset_s: form.estimated_arrival_offset_s
        ? Number(form.estimated_arrival_offset_s)
        : undefined,
    });
    setForm({ name: '', lat: '', lng: '', radius_m: '200', is_mandatory: true, description: '', estimated_arrival_offset_s: '' });
    setShowForm(false);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Checkpoints</h3>
          {checkpoints.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-bold">
              {checkpoints.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3 w-3" /> Agregar
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
            onSubmit={(e) => void handleCreate(e)}
          >
            <div className="rounded-xl border border-border/40 bg-background/40 p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Nombre *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ej. Caseta Tlalpan Norte"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Latitud *</label>
                  <input
                    required type="number" step="any"
                    value={form.lat}
                    onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="19.4326"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Longitud *</label>
                  <input
                    required type="number" step="any"
                    value={form.lng}
                    onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="-99.1332"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Radio geocerca (m)</label>
                  <input
                    type="number" min={50}
                    value={form.radius_m}
                    onChange={(e) => setForm((f) => ({ ...f, radius_m: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">ETA desde inicio (min)</label>
                  <input
                    type="number" min={0}
                    value={form.estimated_arrival_offset_s ? String(Math.round(Number(form.estimated_arrival_offset_s) / 60)) : ''}
                    onChange={(e) => setForm((f) => ({ ...f, estimated_arrival_offset_s: e.target.value ? String(Number(e.target.value) * 60) : '' }))}
                    placeholder="—"
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_mandatory}
                  onChange={(e) => setForm((f) => ({ ...f, is_mandatory: e.target.checked }))}
                  className="accent-primary"
                />
                Obligatorio (el conductor debe pasar por este punto)
              </label>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={create.isPending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {create.isPending ? 'Agregando…' : 'Agregar checkpoint'}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex h-20 items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : checkpoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/40">
          <MapPin className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Sin checkpoints definidos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {checkpoints.map((cp, idx) => (
            <div
              key={cp.id}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/30 px-3 py-2.5"
            >
              <div className="flex items-center gap-2 text-muted-foreground/50">
                <GripVertical className="h-4 w-4" />
                <span className="text-xs font-mono w-4 text-center">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{cp.name}</p>
                  {cp.is_mandatory ? (
                    <span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                      <Lock className="h-2.5 w-2.5" /> Obligatorio
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 rounded-full bg-muted/20 border border-border px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                      <Unlock className="h-2.5 w-2.5" /> Opcional
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {cp.lat.toFixed(5)}, {cp.lng.toFixed(5)} · r={cp.radius_m}m
                  {cp.estimated_arrival_offset_s != null && (
                    <span className="ml-2">ETA {Math.round(cp.estimated_arrival_offset_s / 60)}min</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => void del.mutateAsync({ id: cp.id, routeId })}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section: Casetas de peaje ────────────────────────────────────────────────

export function TollBoothsSection({ routeId }: { routeId: string }) {
  const { data: booths = [], isLoading } = useTollBooths(routeId);
  const create = useCreateTollBooth();
  const del    = useDeleteTollBooth();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', lat: '', lng: '', cost_mxn: '' });

  const totalCost = booths.reduce((acc, b) => acc + (b.cost_mxn ?? 0), 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      routeId,
      name: form.name,
      order_index: booths.length + 1,
      lat: Number(form.lat),
      lng: Number(form.lng),
      cost_mxn: form.cost_mxn ? Number(form.cost_mxn) : undefined,
    });
    setForm({ name: '', lat: '', lng: '', cost_mxn: '' });
    setShowForm(false);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Casetas de peaje</h3>
          {booths.length > 0 && (
            <span className="text-xs text-muted-foreground">
              · Total: <span className="font-semibold text-foreground">{fmtMXN(totalCost)}</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3 w-3" /> Agregar
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
            onSubmit={(e) => void handleCreate(e)}
          >
            <div className="rounded-xl border border-border/40 bg-background/40 p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Nombre *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ej. Caseta Cuernavaca"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Latitud *</label>
                  <input required type="number" step="any" value={form.lat}
                    onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="19.4326" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Longitud *</label>
                  <input required type="number" step="any" value={form.lng}
                    onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="-99.1332" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Costo estimado (MXN)</label>
                  <input type="number" min={0} step="0.01" value={form.cost_mxn}
                    onChange={(e) => setForm((f) => ({ ...f, cost_mxn: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="—" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={create.isPending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {create.isPending ? 'Agregando…' : 'Agregar caseta'}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex h-20 items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : booths.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/40">
          <DollarSign className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Sin casetas registradas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {booths.map((b, idx) => (
            <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/30 px-3 py-2.5">
              <span className="text-xs font-mono text-muted-foreground w-4 text-center flex-shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{b.name}</p>
                <p className="text-[11px] text-muted-foreground font-mono">{b.lat.toFixed(5)}, {b.lng.toFixed(5)}</p>
              </div>
              <span className="text-sm font-semibold text-emerald-400 flex-shrink-0">{fmtMXN(b.cost_mxn)}</span>
              <button onClick={() => void del.mutateAsync({ id: b.id, routeId })}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section: Rutas alternativas ──────────────────────────────────────────────

export function RouteAlternativesSection({ routeId }: { routeId: string }) {
  const { data: alternatives = [], isLoading } = useRouteAlternatives(routeId);
  const create = useCreateRouteAlternative();
  const toggle = useToggleRouteAlternative();
  const del    = useDeleteRouteAlternative();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', reason: '', total_distance_m: '', estimated_duration_s: '',
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      routeId,
      name: form.name,
      reason: form.reason || undefined,
      total_distance_m: form.total_distance_m ? Number(form.total_distance_m) : undefined,
      estimated_duration_s: form.estimated_duration_s ? Number(form.estimated_duration_s) * 60 : undefined,
    });
    setForm({ name: '', reason: '', total_distance_m: '', estimated_duration_s: '' });
    setShowForm(false);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Rutas alternativas</h3>
          {alternatives.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-bold">
              {alternatives.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3 w-3" /> Agregar
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
            onSubmit={(e) => void handleCreate(e)}
          >
            <div className="rounded-xl border border-border/40 bg-background/40 p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Nombre *</label>
                  <input required value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ej. Vía alterna por Texcoco" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Motivo</label>
                  <input value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Obras, clima, tráfico…" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Distancia (km)</label>
                  <input type="number" min={0} step="0.1" value={form.total_distance_m ? String(Number(form.total_distance_m) / 1000) : ''}
                    onChange={(e) => setForm((f) => ({ ...f, total_distance_m: e.target.value ? String(Number(e.target.value) * 1000) : '' }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="—" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Duración estimada (min)</label>
                  <input type="number" min={0} value={form.estimated_duration_s}
                    onChange={(e) => setForm((f) => ({ ...f, estimated_duration_s: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="—" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={create.isPending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {create.isPending ? 'Agregando…' : 'Agregar alternativa'}
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex h-20 items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : alternatives.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground/40">
          <GitBranch className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Sin rutas alternativas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alternatives.map((alt) => (
            <div key={alt.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/30 px-3 py-2.5">
              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${alt.is_active ? 'bg-emerald-400' : 'bg-muted-foreground/30'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{alt.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {[
                    alt.reason,
                    alt.total_distance_m && fmtDistance(alt.total_distance_m),
                    alt.estimated_duration_s && fmtDuration(alt.estimated_duration_s),
                  ].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
              <button
                onClick={() => void toggle.mutateAsync({ id: alt.id, routeId, is_active: !alt.is_active })}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition-colors ${
                  alt.is_active
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-muted/20 text-muted-foreground border-border hover:bg-muted/40'
                }`}
              >
                {alt.is_active ? <><Check className="h-3 w-3" /> Activa</> : 'Inactiva'}
              </button>
              <button
                onClick={() => void del.mutateAsync({ id: alt.id, routeId })}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
