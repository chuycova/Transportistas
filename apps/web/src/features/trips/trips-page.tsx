'use client';
// ─── features/trips/trips-page.tsx ───────────────────────────────────────────
// Página de gestión de viajes. Permite a operadores/admin crear, ver y
// actualizar el estado de los viajes de transporte.

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Truck, MapPin, Package, Clock, ChevronRight,
  Navigation, CheckCircle, XCircle, Search,
} from 'lucide-react';
import {
  useTrips,
  useCreateTrip,
  useUpdateTripStatus,
  useDeleteTrip,
  type TripRow,
  type CreateTripInput,
  type TripStatus,
} from './use-trips';
import { useVehicles } from '../vehicles/use-vehicles';
import { useUsers } from '../users/use-users';
import { useRoutes } from '../routes/use-routes';
import { TripStatusBadge } from './trip-status-badge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
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

// Agrupación visual por estado
const STATUS_ORDER: TripStatus[] = [
  'in_transit', 'at_destination', 'confirmed', 'scheduled', 'draft',
  'completed', 'closed', 'cancelled',
];

// ─── Formulario de nuevo viaje ────────────────────────────────────────────────

interface TripFormProps {
  onClose: () => void;
}

function TripForm({ onClose }: TripFormProps) {
  const createTrip = useCreateTrip();
  const { data: vehicles = [] } = useVehicles();
  const { data: users = [] } = useUsers();
  const { data: routes = [] } = useRoutes();

  const drivers = users.filter((u) => u.role === 'driver' && u.is_active);

  const [form, setForm] = useState<Partial<CreateTripInput>>({
    status: 'scheduled',
    origin_lat: 0, origin_lng: 0,
    dest_lat: 0,   dest_lng: 0,
  });

  function set(key: keyof CreateTripInput, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Auto-fill origen/destino desde la ruta seleccionada
  function handleRouteChange(routeId: string) {
    set('route_id', routeId || undefined);
    if (!routeId) return;
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;
    set('origin_name', route.origin_name);
    set('dest_name', route.dest_name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.origin_name || !form.dest_name) return;
    try {
      await createTrip.mutateAsync(form as CreateTripInput);
      onClose();
    } catch { /* error shown via mutation state */ }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Ruta base */}
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Ruta base (opcional)</label>
          <select
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.route_id ?? ''}
            onChange={(e) => handleRouteChange(e.target.value)}
          >
            <option value="">Sin ruta base</option>
            {routes.filter((r) => r.status === 'active').map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Origen */}
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Origen *</label>
            <input
              required
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Nombre del origen"
              value={form.origin_name ?? ''}
              onChange={(e) => set('origin_name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Destino *</label>
            <input
              required
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Nombre del destino"
              value={form.dest_name ?? ''}
              onChange={(e) => set('dest_name', e.target.value)}
            />
          </div>
        </div>

        {/* Conductor */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Conductor</label>
          <select
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.driver_id ?? ''}
            onChange={(e) => set('driver_id', e.target.value || undefined)}
          >
            <option value="">Sin asignar</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </div>

        {/* Vehículo */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Vehículo</label>
          <select
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.vehicle_id ?? ''}
            onChange={(e) => set('vehicle_id', e.target.value || undefined)}
          >
            <option value="">Sin asignar</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.plate}{v.alias ? ` — ${v.alias}` : ''}</option>
            ))}
          </select>
        </div>

        {/* Fecha programada */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Fecha programada</label>
          <input
            type="datetime-local"
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ''}
            onChange={(e) =>
              set('scheduled_at', e.target.value ? new Date(e.target.value).toISOString() : undefined)
            }
          />
        </div>

        {/* Estado inicial */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Estado inicial</label>
          <select
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.status ?? 'scheduled'}
            onChange={(e) => set('status', e.target.value as TripStatus)}
          >
            <option value="draft">Borrador</option>
            <option value="scheduled">Programado</option>
            <option value="confirmed">Confirmado</option>
          </select>
        </div>

        {/* Tipo de carga */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tipo de carga</label>
          <input
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Ej. Contenedor, Granel..."
            value={form.cargo_type ?? ''}
            onChange={(e) => set('cargo_type', e.target.value || undefined)}
          />
        </div>

        {/* Peso */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Peso (toneladas)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="0.00"
            value={form.weight_tons ?? ''}
            onChange={(e) => set('weight_tons', e.target.value ? parseFloat(e.target.value) : undefined)}
          />
        </div>

        {/* Contenedores */}
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Números de contenedor</label>
          <input
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="CONT001, CONT002 (separados por coma)"
            value={form.container_numbers ?? ''}
            onChange={(e) => set('container_numbers', e.target.value || undefined)}
          />
        </div>
      </div>

      {createTrip.isError && (
        <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
          {createTrip.error?.message ?? 'Error al crear viaje'}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={createTrip.isPending}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {createTrip.isPending ? 'Creando...' : 'Crear viaje'}
        </button>
      </div>
    </form>
  );
}

// ─── Tarjeta de viaje ─────────────────────────────────────────────────────────

interface TripCardProps {
  trip: TripRow;
  onDelete: (id: string) => void;
}

function TripCard({ trip, onDelete }: TripCardProps) {
  const updateStatus = useUpdateTripStatus();

  const isActive = ['confirmed', 'in_transit', 'at_destination'].includes(trip.status);
  const canConfirm = trip.status === 'scheduled' || trip.status === 'draft';
  const canCancel  = !['completed', 'closed', 'cancelled'].includes(trip.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl border border-border/60 bg-card/60 p-4 hover:border-border transition-colors group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-muted-foreground">{trip.code}</span>
            <TripStatusBadge status={trip.status} />
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[120px]">{trip.origin_name}</span>
            </span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="text-muted-foreground text-xs flex items-center gap-1">
              <Navigation className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[120px]">{trip.dest_name}</span>
            </span>
          </div>
        </div>
        <Link
          href={`/trips/${trip.id}`}
          className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          title="Ver detalle"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Actores */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5">
          <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-foreground truncate">
            {trip.vehicle?.plate ?? 'Sin vehículo'}
            {trip.vehicle?.alias ? ` · ${trip.vehicle.alias}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5">
          <span className="text-xs text-muted-foreground">👤</span>
          <span className="text-xs text-foreground truncate">
            {trip.driver?.full_name ?? 'Sin conductor'}
          </span>
        </div>
      </div>

      {/* Métricas */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        {trip.cargo_type && (
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" />{trip.cargo_type}
          </span>
        )}
        {trip.estimated_distance_km && (
          <span>{fmtDistance(trip.estimated_distance_km)}</span>
        )}
        {trip.estimated_duration_min && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{fmtDuration(trip.estimated_duration_min)}
          </span>
        )}
        {trip.scheduled_at && (
          <span className="ml-auto">{fmtDate(trip.scheduled_at)}</span>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
        {canConfirm && (
          <button
            onClick={() => updateStatus.mutate({ id: trip.id, status: 'confirmed' })}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />Confirmar
          </button>
        )}
        {trip.status === 'confirmed' && (
          <button
            onClick={() => updateStatus.mutate({ id: trip.id, status: 'in_transit' })}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
          >
            <Navigation className="h-3.5 w-3.5" />Iniciar
          </button>
        )}
        {trip.status === 'in_transit' && (
          <button
            onClick={() => updateStatus.mutate({ id: trip.id, status: 'at_destination' })}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />En destino
          </button>
        )}
        {trip.status === 'at_destination' && (
          <button
            onClick={() => updateStatus.mutate({ id: trip.id, status: 'completed' })}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="h-3.5 w-3.5" />Completar
          </button>
        )}
        {isActive && (
          <Link
            href={`/trips/${trip.id}`}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors ml-auto"
          >
            Ver detalle
          </Link>
        )}
        {canCancel && (
          <button
            onClick={() => updateStatus.mutate({ id: trip.id, status: 'cancelled' })}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors ml-auto"
          >
            <XCircle className="h-3.5 w-3.5" />Cancelar
          </button>
        )}
        {trip.status === 'completed' && (
          <button
            onClick={() => onDelete(trip.id)}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />Eliminar
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function TripsPage() {
  const { data: trips = [], isLoading, error } = useTrips();
  const deleteTrip = useDeleteTrip();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TripStatus | 'all'>('all');

  const filtered = trips
    .filter((t) => filterStatus === 'all' || t.status === filterStatus)
    .filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        t.code.toLowerCase().includes(q) ||
        t.origin_name.toLowerCase().includes(q) ||
        t.dest_name.toLowerCase().includes(q) ||
        (t.driver?.full_name ?? '').toLowerCase().includes(q) ||
        (t.vehicle?.plate ?? '').toLowerCase().includes(q)
      );
    });

  // Estadísticas rápidas
  const activeCount    = trips.filter((t) => ['confirmed', 'in_transit', 'at_destination'].includes(t.status)).length;
  const scheduledCount = trips.filter((t) => ['scheduled', 'draft'].includes(t.status)).length;
  const doneCount      = trips.filter((t) => ['completed', 'closed'].includes(t.status)).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Viajes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeCount} activos · {scheduledCount} programados · {doneCount} completados
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Nuevo viaje
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border/30 shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full rounded-lg border border-border bg-muted/30 py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Buscar por código, origen, conductor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'in_transit', 'confirmed', 'scheduled', 'completed', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
              }`}
            >
              {s === 'all' ? 'Todos' :
               s === 'in_transit' ? 'En tránsito' :
               s === 'confirmed' ? 'Confirmados' :
               s === 'scheduled' ? 'Programados' :
               s === 'completed' ? 'Completados' : 'Cancelados'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            Cargando viajes...
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {(error as Error).message}
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Truck className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {search || filterStatus !== 'all'
                ? 'No hay viajes que coincidan con el filtro.'
                : 'Aún no hay viajes registrados. Crea el primero.'}
            </p>
          </div>
        )}
        <AnimatePresence mode="popLayout">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onDelete={(id) => deleteTrip.mutate(id)}
              />
            ))}
          </div>
        </AnimatePresence>
      </div>

      {/* Modal nuevo viaje */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-foreground">Nuevo viaje</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <TripForm onClose={() => setShowForm(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
