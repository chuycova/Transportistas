'use client';
// ─── features/drivers/driver-sections.tsx ────────────────────────────────────
// Secciones reutilizables para el detalle del conductor:
//   - DriverFieldsSection   → CURP, RFC, licencia, métricas
//   - DriverDocumentsSection → documentos con validación
//   - EmergencyContactsSection → contactos de emergencia

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, X, FileText, CheckCircle2, XCircle, Clock, AlertTriangle,
  Phone, User, Trash2, ShieldCheck,
} from 'lucide-react';
import {
  useDriverDocuments, useCreateDriverDocument, useValidateDriverDocument,
  useDeleteDriverDocument, useEmergencyContacts, useCreateEmergencyContact,
  useDeleteEmergencyContact, useUpdateDriverFields,
  type DriverDocument, type EmergencyContact, type DocType, type DriverFields,
} from './use-driver-enrichment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocType, string> = {
  ine:              'INE / IFE',
  license:          'Licencia de conducir',
  proof_of_address: 'Comprobante de domicilio',
  medical_cert:     'Certificado médico',
  other:            'Otro',
};

const STATUS_META = {
  pending:  { label: 'Pendiente', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   icon: Clock },
  valid:    { label: 'Válido',    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  expired:  { label: 'Vencido',  className: 'bg-red-500/15 text-red-400 border-red-500/30',         icon: AlertTriangle },
  rejected: { label: 'Rechazado',className: 'bg-red-500/15 text-red-400 border-red-500/30',         icon: XCircle },
};

function DocStatusBadge({ status }: { status: DriverDocument['status'] }) {
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

// ─── Section: Datos del conductor (CURP, RFC, licencia, métricas) ─────────────

export function DriverFieldsSection({ driverId, current = {} }: {
  driverId: string;
  current?: Partial<DriverFields> & { role?: string };
}) {
  const update = useUpdateDriverFields();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<DriverFields>>({
    curp:              current.curp ?? '',
    rfc:               current.rfc ?? '',
    license_number:    current.license_number ?? '',
    license_category:  current.license_category ?? '',
    license_expiry:    current.license_expiry ?? '',
    risk_level:        current.risk_level ?? 'low',
  });

  async function handleSave() {
    const patch: Partial<DriverFields> = {};
    if (form.curp !== undefined)             patch.curp             = form.curp || null;
    if (form.rfc !== undefined)              patch.rfc              = form.rfc || null;
    if (form.license_number !== undefined)   patch.license_number   = form.license_number || null;
    if (form.license_category !== undefined) patch.license_category = form.license_category || null;
    if (form.license_expiry !== undefined)   patch.license_expiry   = form.license_expiry || null;
    if (form.risk_level !== undefined)       patch.risk_level       = form.risk_level;
    await update.mutateAsync({ id: driverId, fields: patch });
    setEditing(false);
  }

  const riskColors = { low: 'text-emerald-400', medium: 'text-amber-400', high: 'text-red-400' };

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Datos del conductor</h3>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary hover:underline"
          >
            Editar
          </button>
        )}
      </div>

      {!editing ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ['CURP',        current.curp],
            ['RFC',         current.rfc],
            ['No. licencia', current.license_number],
            ['Categoría',   current.license_category],
            ['Vence',       fmtDate(current.license_expiry ?? null)],
            ['Total viajes', current.total_trips ?? 0],
            ['A tiempo',    current.on_time_pct != null ? `${current.on_time_pct.toFixed(0)}%` : '—'],
            ['Calificación', current.avg_rating != null ? `${current.avg_rating.toFixed(1)} ★` : '—'],
          ].map(([label, value]) => (
            <div key={label as string}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground mt-0.5">{(value as string | number) || '—'}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs text-muted-foreground">Nivel de riesgo</dt>
            <dd className={`font-semibold mt-0.5 capitalize ${riskColors[current.risk_level ?? 'low']}`}>
              {current.risk_level === 'low' ? 'Bajo' : current.risk_level === 'medium' ? 'Medio' : 'Alto'}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'curp',              label: 'CURP',              placeholder: '18 caracteres' },
            { key: 'rfc',               label: 'RFC',               placeholder: '12–13 caracteres' },
            { key: 'license_number',    label: 'No. licencia',      placeholder: 'Número federal' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
              <input
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={placeholder}
                value={(form as Record<string, string>)[key] ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Categoría</label>
            <select
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.license_category ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, license_category: e.target.value || null }))}
            >
              <option value="">— sin categoría —</option>
              {['A', 'B', 'C', 'D', 'E', 'federal'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Vencimiento licencia</label>
            <input
              type="date"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.license_expiry ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, license_expiry: e.target.value || null }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nivel de riesgo</label>
            <select
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={form.risk_level ?? 'low'}
              onChange={(e) => setForm((p) => ({ ...p, risk_level: e.target.value as DriverFields['risk_level'] }))}
            >
              <option value="low">Bajo</option>
              <option value="medium">Medio</option>
              <option value="high">Alto</option>
            </select>
          </div>
          <div className="col-span-2 flex gap-2 pt-1">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground hover:bg-muted/60 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => { void handleSave(); }}
              disabled={update.isPending}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {update.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Documentos del conductor ────────────────────────────────────────

export function DriverDocumentsSection({ driverId }: { driverId: string }) {
  const { data: docs = [], isLoading } = useDriverDocuments(driverId);
  const createDoc  = useCreateDriverDocument();
  const validateDoc = useValidateDriverDocument();
  const deleteDoc  = useDeleteDriverDocument();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ doc_type: 'ine' as DocType, title: '', doc_number: '', issued_at: '', expires_at: '' });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await createDoc.mutateAsync({
      driverId,
      doc_type:   form.doc_type,
      title:      form.title || DOC_TYPE_LABELS[form.doc_type],
      doc_number: form.doc_number || undefined,
      issued_at:  form.issued_at  || undefined,
      expires_at: form.expires_at || undefined,
    });
    setShowForm(false);
    setForm({ doc_type: 'ine', title: '', doc_number: '', issued_at: '', expires_at: '' });
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
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />Agregar
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={(e) => { void handleAdd(e); }}
            className="mb-4 grid grid-cols-2 gap-3 overflow-hidden"
          >
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Tipo de documento *</label>
              <select
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.doc_type}
                onChange={(e) => setForm((p) => ({ ...p, doc_type: e.target.value as DocType }))}
              >
                {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Número de documento</label>
              <input
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Número / folio"
                value={form.doc_number}
                onChange={(e) => setForm((p) => ({ ...p, doc_number: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vence</label>
              <input
                type="date"
                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.expires_at}
                onChange={(e) => setForm((p) => ({ ...p, expires_at: e.target.value }))}
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground hover:bg-muted/60">
                Cancelar
              </button>
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
              <div className="flex items-center gap-2 mb-1">
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
              {doc.rejection_reason && <p className="text-xs text-red-400 mt-1">{doc.rejection_reason}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {doc.status === 'pending' && (
                <>
                  <button
                    onClick={() => validateDoc.mutate({ id: doc.id, driverId, status: 'valid' })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title="Aprobar"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => validateDoc.mutate({ id: doc.id, driverId, status: 'rejected', rejection_reason: 'Rechazado por operador' })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Rechazar"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={() => deleteDoc.mutate({ id: doc.id, driverId })}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Contactos de emergencia ─────────────────────────────────────────

export function EmergencyContactsSection({ driverId }: { driverId: string }) {
  const { data: contacts = [], isLoading } = useEmergencyContacts(driverId);
  const createContact = useCreateEmergencyContact();
  const deleteContact = useDeleteEmergencyContact();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', relationship: '', phone_alt: '', is_primary: false });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name || !form.phone) return;
    await createContact.mutateAsync({
      driverId,
      full_name:    form.full_name,
      phone:        form.phone,
      relationship: form.relationship || undefined,
      phone_alt:    form.phone_alt   || undefined,
      is_primary:   form.is_primary,
    });
    setShowForm(false);
    setForm({ full_name: '', phone: '', relationship: '', phone_alt: '', is_primary: false });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Contactos de emergencia</h3>
          {contacts.length > 0 && (
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">{contacts.length}</span>
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />Agregar
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={(e) => { void handleAdd(e); }}
            className="mb-4 grid grid-cols-2 gap-3 overflow-hidden"
          >
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nombre completo *</label>
              <input required className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Nombre" value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Parentesco</label>
              <input className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Esposo/a, Padre, Hijo/a..." value={form.relationship}
                onChange={(e) => setForm((p) => ({ ...p, relationship: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Teléfono *</label>
              <input required type="tel" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="+52 55 0000 0000" value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Teléfono alterno</label>
              <input type="tel" className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Opcional" value={form.phone_alt}
                onChange={(e) => setForm((p) => ({ ...p, phone_alt: e.target.value }))} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="is_primary" checked={form.is_primary}
                onChange={(e) => setForm((p) => ({ ...p, is_primary: e.target.checked }))}
                className="rounded border-border" />
              <label htmlFor="is_primary" className="text-xs text-foreground">Contacto principal</label>
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground hover:bg-muted/60">
                Cancelar
              </button>
              <button type="submit" disabled={createContact.isPending}
                className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {createContact.isPending ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
      {!isLoading && contacts.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Sin contactos de emergencia.</p>
      )}

      <div className="space-y-2">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/20 border border-border/40 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/40 shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                  {c.is_primary && (
                    <span className="text-[10px] font-semibold text-primary border border-primary/30 rounded-full px-1.5 py-0.5">Principal</span>
                  )}
                </div>
                {c.relationship && <p className="text-xs text-muted-foreground">{c.relationship}</p>}
                <p className="text-xs text-foreground/70">{c.phone}{c.phone_alt ? ` · ${c.phone_alt}` : ''}</p>
              </div>
            </div>
            <button
              onClick={() => deleteContact.mutate({ id: c.id, driverId })}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
