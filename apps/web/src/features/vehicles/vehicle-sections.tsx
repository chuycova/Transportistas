'use client';
// ─── features/vehicles/vehicle-sections.tsx ──────────────────────────────────
// Secciones reutilizables para el detalle del vehículo:
//   - VehicleFieldsSection     → VIN, capacidad, seguro, kilometraje
//   - VehicleDocumentsSection  → documentos con validación
//   - MaintenanceSection       → historial de mantenimiento

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, FileText, CheckCircle2, XCircle, Clock, AlertTriangle,
  Wrench, Trash2, DollarSign,
} from 'lucide-react';
import {
  useVehicleDocuments, useCreateVehicleDocument, useValidateVehicleDocument,
  useDeleteVehicleDocument, useMaintenanceRecords, useCreateMaintenanceRecord,
  useDeleteMaintenanceRecord, useUpdateVehicleFields,
  type VehicleDocument, type VehicleDocType, type MaintenanceType, type VehicleEnrichedFields,
} from './use-vehicle-enrichment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<VehicleDocType, string> = {
  tarjeta_circulacion: 'Tarjeta de circulación',
  seguro:              'Seguro',
  verificacion:        'Verificación',
  revision_fisica:     'Revisión física',
  other:               'Otro',
};

const MAINTENANCE_LABELS: Record<MaintenanceType, string> = {
  preventive:  'Preventivo',
  corrective:  'Correctivo',
  inspection:  'Inspección',
  other:       'Otro',
};

const STATUS_META = {
  pending:  { label: 'Pendiente', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',      icon: Clock },
  valid:    { label: 'Válido',    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  expired:  { label: 'Vencido',  className: 'bg-red-500/15 text-red-400 border-red-500/30',             icon: AlertTriangle },
  rejected: { label: 'Rechazado',className: 'bg-red-500/15 text-red-400 border-red-500/30',             icon: XCircle },
};

function DocStatusBadge({ status }: { status: VehicleDocument['status'] }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.className}`}>
      <Icon className="h-3 w-3" />{meta.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpiringSoon(iso: string | null) {
  if (!iso) return false;
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 30;
}

function fmtCurrency(n: number | null) {
  if (!n) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}

// ─── Section: Datos técnicos del vehículo ─────────────────────────────────────

export function VehicleFieldsSection({ vehicleId, current = {} }: {
  vehicleId: string;
  current?: Partial<VehicleEnrichedFields>;
}) {
  const update = useUpdateVehicleFields();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<VehicleEnrichedFields>>({
    vin:                  current.vin ?? '',
    cargo_capacity_tons:  current.cargo_capacity_tons ?? undefined,
    insurance_policy:     current.insurance_policy ?? '',
    insurance_expiry:     current.insurance_expiry ?? '',
    mileage_km:           current.mileage_km ?? 0,
  });

  async function handleSave() {
    const patch: Partial<VehicleEnrichedFields> = {
      vin:                  (form.vin as string) || null,
      cargo_capacity_tons:  form.cargo_capacity_tons ?? null,
      insurance_policy:     (form.insurance_policy as string) || null,
      insurance_expiry:     (form.insurance_expiry as string) || null,
      mileage_km:           form.mileage_km ?? 0,
    };
    await update.mutateAsync({ id: vehicleId, fields: patch });
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Datos técnicos</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
            Editar
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ['VIN',             current.vin],
            ['Capacidad (ton)', current.cargo_capacity_tons != null ? `${current.cargo_capacity_tons} t` : null],
            ['Póliza seguro',   current.insurance_policy],
            ['Vence seguro',    fmtDate(current.insurance_expiry ?? null)],
            ['Kilometraje',     current.mileage_km != null ? `${current.mileage_km.toLocaleString('es-MX')} km` : null],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground mt-0.5">{(value as string) || '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">VIN</label>
            <input
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="17 caracteres"
              maxLength={17}
              value={(form.vin as string) ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, vin: e.target.value.toUpperCase() }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Capacidad (toneladas)</label>
            <input type="number" min="0" step="0.1"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.cargo_capacity_tons ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, cargo_capacity_tons: e.target.value ? parseFloat(e.target.value) : undefined }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Kilometraje actual</label>
            <input type="number" min="0"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.mileage_km ?? 0}
              onChange={(e) => setForm((p) => ({ ...p, mileage_km: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Póliza de seguro</label>
            <input
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Número de póliza"
              value={(form.insurance_policy as string) ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, insurance_policy: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Vencimiento seguro</label>
            <input type="date"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={(form.insurance_expiry as string) ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, insurance_expiry: e.target.value }))}
            />
          </div>
          <div className="col-span-2 flex gap-2 pt-1">
            <button onClick={() => setEditing(false)}
              className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground hover:bg-muted/60">
              Cancelar
            </button>
            <button onClick={() => { void handleSave(); }} disabled={update.isPending}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {update.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Documentos del vehículo ─────────────────────────────────────────

export function VehicleDocumentsSection({ vehicleId }: { vehicleId: string }) {
  const { data: docs = [], isLoading } = useVehicleDocuments(vehicleId);
  const createDoc   = useCreateVehicleDocument();
  const validateDoc = useValidateVehicleDocument();
  const deleteDoc   = useDeleteVehicleDocument();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ doc_type: 'tarjeta_circulacion' as VehicleDocType, doc_number: '', issued_at: '', expires_at: '' });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await createDoc.mutateAsync({
      vehicleId,
      doc_type:   form.doc_type,
      title:      DOC_TYPE_LABELS[form.doc_type],
      doc_number: form.doc_number || undefined,
      issued_at:  form.issued_at  || undefined,
      expires_at: form.expires_at || undefined,
    });
    setShowForm(false);
    setForm({ doc_type: 'tarjeta_circulacion', doc_number: '', issued_at: '', expires_at: '' });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Documentos</h3>
          {docs.length > 0 && (
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">{docs.length}</span>
          )}
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
          <Plus className="h-3.5 w-3.5" />Agregar
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={(e) => { void handleAdd(e); }}
            className="mb-4 grid grid-cols-2 gap-3 overflow-hidden">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
              <select className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.doc_type} onChange={(e) => setForm((p) => ({ ...p, doc_type: e.target.value as VehicleDocType }))}>
                {(Object.entries(DOC_TYPE_LABELS) as [VehicleDocType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Número / folio</label>
              <input className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Opcional" value={form.doc_number}
                onChange={(e) => setForm((p) => ({ ...p, doc_number: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vence</label>
              <input type="date" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.expires_at} onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))} />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground hover:bg-muted/60">Cancelar</button>
              <button type="submit" disabled={createDoc.isPending}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {createDoc.isPending ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
      {!isLoading && docs.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Sin documentos registrados.</p>
      )}
      <div className="space-y-2">
        {docs.map((doc) => (
          <div key={doc.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/20 border border-border/40 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-medium text-foreground">{DOC_TYPE_LABELS[doc.doc_type]}</span>
                <DocStatusBadge status={doc.status} />
                {isExpiringSoon(doc.expires_at) && (
                  <span className="text-[10px] font-semibold text-amber-400">⚠ Vence pronto</span>
                )}
              </div>
              {doc.doc_number && <p className="text-xs text-muted-foreground">No. {doc.doc_number}</p>}
              {doc.expires_at && (
                <p className={`text-xs ${new Date(doc.expires_at) < new Date() ? 'text-red-400' : 'text-muted-foreground'}`}>
                  Vence: {fmtDate(doc.expires_at)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {doc.status === 'pending' && (
                <>
                  <button onClick={() => validateDoc.mutate({ id: doc.id, vehicleId, status: 'valid' })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Aprobar">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => validateDoc.mutate({ id: doc.id, vehicleId, status: 'rejected', rejection_reason: 'Rechazado por operador' })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Rechazar">
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button onClick={() => deleteDoc.mutate({ id: doc.id, vehicleId })}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Mantenimiento ───────────────────────────────────────────────────

export function MaintenanceSection({ vehicleId }: { vehicleId: string }) {
  const { data: records = [], isLoading } = useMaintenanceRecords(vehicleId);
  const createRecord = useCreateMaintenanceRecord();
  const deleteRecord = useDeleteMaintenanceRecord();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    maintenance_type: 'preventive' as MaintenanceType,
    description: '', service_date: '', workshop_name: '',
    cost_mxn: '', mileage_km_at_service: '', next_service_date: '',
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.service_date) return;
    await createRecord.mutateAsync({
      vehicleId,
      maintenance_type:      form.maintenance_type,
      description:           form.description,
      service_date:          form.service_date,
      workshop_name:         form.workshop_name || undefined,
      cost_mxn:              form.cost_mxn ? parseFloat(form.cost_mxn) : undefined,
      mileage_km_at_service: form.mileage_km_at_service ? parseInt(form.mileage_km_at_service) : undefined,
      next_service_date:     form.next_service_date || undefined,
    });
    setShowForm(false);
    setForm({ maintenance_type: 'preventive', description: '', service_date: '', workshop_name: '', cost_mxn: '', mileage_km_at_service: '', next_service_date: '' });
  }

  const totalCost = records.reduce((sum, r) => sum + (r.cost_mxn ?? 0), 0);

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Mantenimiento</h3>
          {records.length > 0 && (
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">{records.length} registros</span>
          )}
          {totalCost > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />{fmtCurrency(totalCost)} total
            </span>
          )}
        </div>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
          <Plus className="h-3.5 w-3.5" />Agregar
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={(e) => { void handleAdd(e); }}
            className="mb-4 grid grid-cols-2 gap-3 overflow-hidden">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo *</label>
              <select className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.maintenance_type} onChange={(e) => setForm((p) => ({ ...p, maintenance_type: e.target.value as MaintenanceType }))}>
                {(Object.entries(MAINTENANCE_LABELS) as [MaintenanceType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fecha de servicio *</label>
              <input required type="date" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.service_date} onChange={(e) => setForm((p) => ({ ...p, service_date: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Descripción *</label>
              <input required className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Cambio de aceite, frenos, etc." value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Taller</label>
              <input className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Nombre del taller" value={form.workshop_name}
                onChange={(e) => setForm((p) => ({ ...p, workshop_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Costo (MXN)</label>
              <input type="number" min="0" step="0.01" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="0.00" value={form.cost_mxn}
                onChange={(e) => setForm((p) => ({ ...p, cost_mxn: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Km al momento</label>
              <input type="number" min="0" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Odómetro" value={form.mileage_km_at_service}
                onChange={(e) => setForm((p) => ({ ...p, mileage_km_at_service: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Próximo servicio</label>
              <input type="date" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.next_service_date} onChange={(e) => setForm((p) => ({ ...p, next_service_date: e.target.value }))} />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground hover:bg-muted/60">Cancelar</button>
              <button type="submit" disabled={createRecord.isPending}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {createRecord.isPending ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
      {!isLoading && records.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Sin registros de mantenimiento.</p>
      )}
      <div className="space-y-2">
        {records.map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/20 border border-border/40 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-semibold text-foreground">{r.description}</span>
                <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wide">
                  {MAINTENANCE_LABELS[r.maintenance_type]}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span>📅 {fmtDate(r.service_date)}</span>
                {r.workshop_name && <span>🔧 {r.workshop_name}</span>}
                {r.cost_mxn && <span className="text-amber-400">{fmtCurrency(r.cost_mxn)}</span>}
                {r.mileage_km_at_service && <span>{r.mileage_km_at_service.toLocaleString('es-MX')} km</span>}
              </div>
              {r.next_service_date && (
                <p className={`text-xs mt-1 ${new Date(r.next_service_date) < new Date() ? 'text-red-400' : 'text-muted-foreground'}`}>
                  Próximo: {fmtDate(r.next_service_date)}
                </p>
              )}
            </div>
            <button onClick={() => deleteRecord.mutate({ id: r.id, vehicleId })}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
