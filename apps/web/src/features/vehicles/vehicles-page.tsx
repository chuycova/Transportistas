'use client';
import { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Truck, Car, X, Pencil, Trash2, ChevronDown,
  Smartphone, UserPlus, UserCheck, RefreshCw, Mail, Eye,
} from 'lucide-react';
import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
  type Vehicle,
} from './use-vehicles';
import { useTrackingStore } from '../../stores/use-tracking-store';
import { useDrivers, useInviteDriver, type Driver } from '../drivers/use-drivers';
import { useRouter } from 'next/navigation';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active:      { label: 'Activo',        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  inactive:    { label: 'Inactivo',      className: 'bg-muted/30 text-muted-foreground border-border' },
  maintenance: { label: 'Mantenimiento', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  off_route:   { label: 'Desvío',        className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const VEHICLE_TYPES = ['truck', 'car', 'van', 'motorcycle', 'other'] as const;
const STATUSES = ['active', 'inactive', 'maintenance'] as const;

function VehicleIcon({ type }: { type: string }) {
  if (type === 'car' || type === 'van') return <Car className="h-5 w-5" />;
  return <Truck className="h-5 w-5" />;
}

interface VehicleFormData {
  plate: string;
  alias: string;
  brand: string;
  model: string;
  year: string;
  vehicle_type: typeof VEHICLE_TYPES[number];
  color: string;
  status: typeof STATUSES[number];
  assigned_driver_id: string; // '' = sin asignar
}

const EMPTY_FORM: VehicleFormData = {
  plate: '', alias: '', brand: '', model: '',
  year: '', vehicle_type: 'truck', color: '#6366f1', status: 'inactive',
  assigned_driver_id: '',
};

// ─── Driver picker + invite inline ───────────────────────────────────────────
function DriverSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: drivers = [], isLoading, refetch } = useDrivers();
  const invite = useInviteDriver();

  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName]   = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [invOk, setInvOk]       = useState(false);

  const selected = drivers.find((d) => d.id === value);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    await invite.mutateAsync({ email: invEmail, full_name: invName, phone: invPhone || undefined });
    setInvOk(true);
    setShowInvite(false);
    setInvEmail(''); setInvName(''); setInvPhone('');
    // refetch para que aparezca en la lista
    void refetch();
    setTimeout(() => setInvOk(false), 4000);
  };

  return (
    <div className="col-span-2 space-y-2 rounded-xl border border-border/40 bg-background/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5" />
          Conductor / Dispositivo móvil
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Recargar conductores"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Lista de conductores */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <div className="h-3 w-3 animate-spin rounded-full border border-border border-t-primary" />
          Cargando conductores...
        </div>
      ) : drivers.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic py-1">
          No hay conductores registrados en este tenant.
        </p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
          {/* Opción sin asignar */}
          <button
            type="button"
            onClick={() => onChange('')}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors text-left ${
              value === ''
                ? 'bg-primary/10 border border-primary/30 text-primary'
                : 'border border-transparent hover:bg-muted/40 text-muted-foreground'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
            Sin asignar
          </button>

          {drivers.map((d) => (
            <DriverCard
              key={d.id}
              driver={d}
              selected={value === d.id}
              onSelect={() => onChange(d.id)}
            />
          ))}
        </div>
      )}

      {/* Invitar nuevo conductor */}
      {invOk && (
        <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
          <UserCheck className="h-3.5 w-3.5" />
          Invitación enviada — el conductor recibirá un email para configurar su cuenta.
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowInvite((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors"
      >
        <UserPlus className="h-3.5 w-3.5" />
        {showInvite ? 'Cancelar' : 'Invitar nuevo conductor'}
      </button>

      <AnimatePresence>
        {showInvite && (
          <motion.form
            onSubmit={(e) => void handleInvite(e)}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2 border-t border-border/30 mt-1">
              <p className="text-[10px] text-muted-foreground">
                Se creará una cuenta con rol <strong>driver</strong> y se enviará un magic-link al correo.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <input
                    required type="email" placeholder="Email del conductor *"
                    value={invEmail} onChange={(e) => setInvEmail(e.target.value)}
                    className="w-full rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
                  />
                </div>
                <input
                  required placeholder="Nombre completo *"
                  value={invName} onChange={(e) => setInvName(e.target.value)}
                  className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
                />
                <input
                  placeholder="Teléfono (opcional)"
                  value={invPhone} onChange={(e) => setInvPhone(e.target.value)}
                  className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
                />
              </div>
              {invite.error && (
                <p className="text-[10px] text-destructive">{invite.error.message}</p>
              )}
              <button
                type="submit"
                disabled={invite.isPending}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/90 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary transition-colors disabled:opacity-60"
              >
                <Mail className="h-3 w-3" />
                {invite.isPending ? 'Enviando...' : 'Enviar invitación'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Driver ya asignado — info rápida */}
      {selected && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
            {selected.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{selected.full_name}</p>
            <p className="text-[10px] text-muted-foreground">{selected.phone ?? 'Sin teléfono'}</p>
          </div>
          {selected.has_device ? (
            <div className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 rounded-full px-1.5 py-0.5 flex-shrink-0">
              <Smartphone className="h-2.5 w-2.5" />
              App activa
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 rounded-full px-1.5 py-0.5 flex-shrink-0">
              <Smartphone className="h-2.5 w-2.5" />
              Sin app
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DriverCard({
  driver, selected, onSelect,
}: {
  driver: Driver;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors text-left ${
        selected
          ? 'bg-primary/10 border border-primary/30'
          : 'border border-transparent hover:bg-muted/40'
      }`}
    >
      {/* Avatar inicial */}
      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
        selected ? 'bg-primary/20 text-primary' : 'bg-muted/60 text-muted-foreground'
      }`}>
        {driver.full_name.charAt(0).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`font-semibold truncate ${selected ? 'text-primary' : 'text-foreground'}`}>
          {driver.full_name}
        </p>
        {driver.phone && (
          <p className="text-[10px] text-muted-foreground truncate">{driver.phone}</p>
        )}
      </div>

      {/* Indicador de dispositivo */}
      <div className={`flex-shrink-0 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
        driver.has_device
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-muted/30 text-muted-foreground'
      }`}>
        <Smartphone className="h-2.5 w-2.5" />
        {driver.has_device ? 'App' : 'Sin app'}
      </div>
    </button>
  );
}

// ─── Modal de vehículo ────────────────────────────────────────────────────────
function VehicleModal({
  open, onClose, vehicle,
}: {
  open: boolean;
  onClose: () => void;
  vehicle?: Vehicle | null;
}) {
  const initialForm: VehicleFormData = vehicle
    ? {
        plate: vehicle.plate,
        alias: vehicle.alias ?? '',
        brand: vehicle.brand ?? '',
        model: vehicle.model ?? '',
        year: vehicle.year?.toString() ?? '',
        vehicle_type: (vehicle.vehicle_type as typeof VEHICLE_TYPES[number]) ?? 'truck',
        color: vehicle.color ?? '#6366f1',
        status: (vehicle.status as typeof STATUSES[number]) ?? 'inactive',
        assigned_driver_id: (vehicle as Vehicle & { assigned_driver_id?: string }).assigned_driver_id ?? '',
      }
    : EMPTY_FORM;

  const [form, setForm] = useState<VehicleFormData>(initialForm);

  const create = useCreateVehicle();
  const update = useUpdateVehicle();
  const isPending = create.isPending || update.isPending;
  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialForm);

  const set = (k: keyof VehicleFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      plate: form.plate.toUpperCase(),
      alias: form.alias || null,
      brand: form.brand || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      vehicle_type: form.vehicle_type,
      color: form.color,
      status: form.status,
      assigned_driver_id: form.assigned_driver_id || null,
    };
    if (vehicle) {
      await update.mutateAsync({ id: vehicle.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl border border-border/50 bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{vehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Placa */}
            <div className="col-span-2 space-y-1">
              <label htmlFor="plate" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Placa *</label>
              <input id="plate" required value={form.plate} onChange={set('plate')}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm uppercase tracking-widest focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                placeholder="ABC-123-A" />
            </div>

            {/* Alias */}
            <div className="space-y-1">
              <label htmlFor="alias" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Alias</label>
              <input id="alias" value={form.alias} onChange={set('alias')}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                placeholder="Unidad Norte" />
            </div>

            {/* Tipo */}
            <div className="space-y-1">
              <label htmlFor="vtype" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</label>
              <div className="relative">
                <select id="vtype" value={form.vehicle_type} onChange={set('vehicle_type')}
                  className="w-full appearance-none rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none">
                  {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Marca */}
            <div className="space-y-1">
              <label htmlFor="brand" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Marca</label>
              <input id="brand" value={form.brand} onChange={set('brand')}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                placeholder="Volvo" />
            </div>

            {/* Modelo */}
            <div className="space-y-1">
              <label htmlFor="model" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Modelo</label>
              <input id="model" value={form.model} onChange={set('model')}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                placeholder="FH 460" />
            </div>

            {/* Año */}
            <div className="space-y-1">
              <label htmlFor="year" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Año</label>
              <input id="year" type="number" min="1990" max="2030" value={form.year} onChange={set('year')}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                placeholder="2023" />
            </div>

            {/* Estado */}
            <div className="space-y-1">
              <label htmlFor="vstatus" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</label>
              <div className="relative">
                <select id="vstatus" value={form.status} onChange={set('status')}
                  className="w-full appearance-none rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none">
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]?.label ?? s}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-1">
              <label htmlFor="color" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Color del marcador</label>
              <div className="flex items-center gap-2">
                <input id="color" type="color" value={form.color} onChange={set('color')}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border/50 bg-background/50 p-1" />
                <span className="text-sm font-mono text-muted-foreground">{form.color}</span>
              </div>
            </div>

            {/* ── Conductor / Dispositivo móvil ── */}
            <DriverSection
              value={form.assigned_driver_id}
              onChange={(id) => setForm((p) => ({ ...p, assigned_driver_id: id }))}
            />
          </div>

          {(create.error || update.error) && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {(create.error as Error)?.message ?? (update.error as Error)?.message}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending || (!!vehicle && !hasChanges)}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
              {isPending ? 'Guardando...' : vehicle ? 'Guardar Cambios' : 'Crear Vehículo'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Página principal (sin cambios) ──────────────────────────────────────────
export function VehiclesPage() {
  const { data: vehicles = [], isLoading, error } = useVehicles();
  const deleteVehicle = useDeleteVehicle();
  const liveVehicles = useTrackingStore((s) => s.vehicles);
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [search, setSearch] = useState('');

  const filtered = vehicles.filter((v) =>
    !search ||
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    (v.alias ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === 'active').length,
    inactive: vehicles.filter((v) => v.status === 'inactive').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
  };

  const openCreate = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (v: Vehicle) => { setEditTarget(v); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTarget(null); };

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flotilla</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión de vehículos del tenant</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo Vehículo
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Activos', value: stats.active, color: 'text-emerald-400' },
          { label: 'Inactivos', value: stats.inactive, color: 'text-muted-foreground' },
          { label: 'Mantenimiento', value: stats.maintenance, color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card/60 p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por placa o alias..."
          className="w-full max-w-sm rounded-xl border border-border/50 bg-card/60 px-4 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((v) => {
              const live = liveVehicles[v.id];
              const statusInfo = STATUS_LABELS[live?.off ? 'off_route' : v.status] ?? STATUS_LABELS.inactive;

              return (
                <motion.div
                  key={v.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group relative rounded-2xl border border-border/50 bg-card/60 p-5 transition-shadow hover:shadow-xl hover:shadow-black/20"
                >
                  {/* Color bar */}
                  <div
                    className="absolute left-0 top-4 bottom-4 w-1 rounded-full"
                    style={{ backgroundColor: v.color ?? '#6366f1' }}
                  />

                  <div className="pl-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
                          <VehicleIcon type={v.vehicle_type} />
                        </div>
                        <div>
                          <p className="font-mono text-sm font-bold tracking-widest">{v.plate}</p>
                          {v.alias && <p className="text-xs text-muted-foreground">{v.alias}</p>}
                        </div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {(v.brand || v.model) && (
                        <p>{[v.brand, v.model, v.year].filter(Boolean).join(' · ')}</p>
                      )}
                      {live && (
                        <p className="font-mono text-primary/80">
                          {live.lat.toFixed(5)}, {live.lng.toFixed(5)} · {Math.round(live.s ?? 0)} km/h
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => router.push(`/vehicles/${v.id}`)}
                        className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Eye className="h-3 w-3" /> Ver detalle
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(v)}
                        className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(v)}
                        className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Eliminar
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="col-span-full flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 text-muted-foreground">
              <Truck className="h-8 w-8 opacity-30" />
              <p className="text-sm">{search ? 'Sin resultados' : 'Sin vehículos registrados'}</p>
              {!search && (
                <button type="button" onClick={openCreate} className="text-xs text-primary hover:underline">
                  Agregar el primero
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Vehicle Modal */}
      <AnimatePresence>
        {modalOpen && (
          <VehicleModal open={modalOpen} onClose={closeModal} vehicle={editTarget} />
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
            >
              <h3 className="font-semibold">Eliminar vehículo</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                ¿Confirmas eliminar <span className="font-mono font-bold text-foreground">{deleteTarget.plate}</span>? Esta acción no se puede deshacer.
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteVehicle.mutateAsync(deleteTarget.id);
                    setDeleteTarget(null);
                  }}
                  disabled={deleteVehicle.isPending}
                  className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-60"
                >
                  {deleteVehicle.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
