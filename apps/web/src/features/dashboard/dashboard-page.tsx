'use client';
// ─── features/dashboard/dashboard-page.tsx ────────────────────────────────────
// Centro de Control — vista de resumen operativo.
// Muestra el estado actual de rutas, viajes, vehículos, conductores e incidentes.
// El mapa en vivo se accede desde /map.

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Route as RouteIcon, Truck, Users, PackagePlus,
  AlertTriangle, CheckCircle2, Clock, XCircle,
  Activity, ArrowRight, MapPin, Shield,
} from 'lucide-react';
import { useRoutes } from '@/features/routes/use-routes';
import { useTrips } from '@/features/trips/use-trips';
import { useVehicles } from '@/features/vehicles/use-vehicles';
import { useUsers } from '@/features/users/use-users';
import { useIncidents } from '@/features/incidents/use-incidents';
import { useTrackingStore } from '@/stores/use-tracking-store';
import type { TripRow } from '@/features/trips/use-trips';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  const h    = Math.floor(min / 60);
  if (h > 23) return `${Math.floor(h / 24)}d`;
  if (h > 0)  return `${h}h ${min % 60}m`;
  return `${min}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:    string;
  value:    number | string;
  sub?:     string;
  icon:     React.ReactNode;
  accent:   string;  // tailwind bg class
  href?:    string;
  urgent?:  boolean;
}

function StatCard({ label, value, sub, icon, accent, href, urgent }: StatCardProps) {
  const inner = (
    <div
      className={`group relative flex flex-col gap-3 rounded-2xl border bg-card/70 p-5 transition-all hover:shadow-lg hover:shadow-black/10 ${
        urgent
          ? 'border-destructive/40 shadow-destructive/10 shadow-md'
          : 'border-border/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          {icon}
        </div>
        {href && (
          <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
        )}
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/60 mt-1">{sub}</p>}
      </div>
      {urgent && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
        </span>
      )}
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

// ─── Trip status badge ────────────────────────────────────────────────────────

const TRIP_STATUS: Record<string, { label: string; cls: string }> = {
  draft:          { label: 'Borrador',     cls: 'bg-muted/40 text-muted-foreground' },
  scheduled:      { label: 'Programado',   cls: 'bg-blue-500/15 text-blue-400' },
  confirmed:      { label: 'Confirmado',   cls: 'bg-indigo-500/15 text-indigo-400' },
  in_transit:     { label: 'En tránsito',  cls: 'bg-amber-500/15 text-amber-400' },
  at_destination: { label: 'En destino',   cls: 'bg-cyan-500/15 text-cyan-400' },
  completed:      { label: 'Completado',   cls: 'bg-emerald-500/15 text-emerald-400' },
  closed:         { label: 'Cerrado',      cls: 'bg-emerald-500/15 text-emerald-400' },
  cancelled:      { label: 'Cancelado',    cls: 'bg-destructive/15 text-destructive' },
};

function TripBadge({ status }: { status: string }) {
  const meta = TRIP_STATUS[status] ?? TRIP_STATUS.draft;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

// ─── Active trip row ──────────────────────────────────────────────────────────

function ActiveTripRow({ trip }: { trip: TripRow }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-3 hover:bg-card/90 hover:shadow-md transition-all"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
        <Activity className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold truncate">
            {trip.origin_name} → {trip.dest_name}
          </p>
          <TripBadge status={trip.status} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {trip.vehicle?.plate ?? '—'}
          {trip.driver ? ` · ${trip.driver.full_name}` : ''}
          {trip.started_at ? ` · hace ${fmtRelativeTime(trip.started_at)}` : ''}
        </p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
    </Link>
  );
}

// ─── Recent trip row (completed) ──────────────────────────────────────────────

function RecentTripRow({ trip }: { trip: TripRow }) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-3 hover:bg-card/90 hover:shadow-md transition-all"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">
          {trip.origin_name} → {trip.dest_name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {trip.vehicle?.plate ?? '—'}
          {trip.driver ? ` · ${trip.driver.full_name}` : ''}
          {trip.completed_at ? ` · ${fmtDate(trip.completed_at)} ${fmtTime(trip.completed_at)}` : ''}
        </p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardPage() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: routes    = [] } = useRoutes();
  const { data: trips     = [] } = useTrips();
  const { data: vehicles  = [] } = useVehicles();
  const { data: users     = [] } = useUsers();
  const { data: incidents = [] } = useIncidents();
  const liveVehicles = useTrackingStore((s) => s.vehicles);

  // ── Computed metrics ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const activeRoutes    = routes.filter((r) => r.status === 'active').length;
    const activeVehicles  = Object.keys(liveVehicles).length;
    const activeTrips     = trips.filter((t) => t.status === 'in_transit' || t.status === 'at_destination').length;
    const completedTrips  = trips.filter((t) => t.status === 'completed' || t.status === 'closed').length;
    const scheduledTrips  = trips.filter((t) => t.status === 'scheduled' || t.status === 'confirmed').length;
    const cancelledTrips  = trips.filter((t) => t.status === 'cancelled').length;
    const drivers         = users.filter((u) => u.role === 'driver').length;
    const openIncidents   = incidents.filter((i) => i.status === 'open').length;
    const totalIncidents  = incidents.length;
    const offRoute        = Object.values(liveVehicles).filter((v) => v.off).length;

    return {
      activeRoutes, activeVehicles, activeTrips, completedTrips,
      scheduledTrips, cancelledTrips, drivers,
      openIncidents, totalIncidents, offRoute,
      totalVehicles: vehicles.length,
    };
  }, [routes, trips, vehicles, users, incidents, liveVehicles]);

  // ── Feed data ──────────────────────────────────────────────────────────────
  const inTransitTrips = trips
    .filter((t) => t.status === 'in_transit' || t.status === 'at_destination')
    .slice(0, 5);

  const recentTrips = trips
    .filter((t) => t.status === 'completed' || t.status === 'closed')
    .sort((a, b) => new Date(b.completed_at ?? b.updated_at).getTime() - new Date(a.completed_at ?? a.updated_at).getTime())
    .slice(0, 5);

  const openIncidentsList = incidents
    .filter((i) => i.status === 'open')
    .slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Centro de Control</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resumen operativo en tiempo real</p>
        </div>
        <Link
          href="/map"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          <MapPin className="h-4 w-4" />
          Ver mapa en vivo
        </Link>
      </div>

      {/* ── KPI grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard
          label="Viajes en tránsito"
          value={metrics.activeTrips}
          sub={`${metrics.scheduledTrips} programados`}
          icon={<Activity className="h-5 w-5" />}
          accent="bg-amber-500/10 text-amber-400"
          href="/trips"
          urgent={metrics.activeTrips > 0}
        />
        <StatCard
          label="Rutas activas"
          value={metrics.activeRoutes}
          sub={`${routes.length} totales`}
          icon={<RouteIcon className="h-5 w-5" />}
          accent="bg-indigo-500/10 text-indigo-400"
          href="/routes"
        />
        <StatCard
          label="Vehículos en línea"
          value={metrics.activeVehicles}
          sub={metrics.offRoute > 0 ? `${metrics.offRoute} fuera de ruta` : `${metrics.totalVehicles} registrados`}
          icon={<Truck className="h-5 w-5" />}
          accent="bg-blue-500/10 text-blue-400"
          href="/vehicles"
          urgent={metrics.offRoute > 0}
        />
        <StatCard
          label="Viajes completados"
          value={metrics.completedTrips}
          sub={metrics.cancelledTrips > 0 ? `${metrics.cancelledTrips} cancelados` : undefined}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="bg-emerald-500/10 text-emerald-400"
          href="/historial"
        />
        <StatCard
          label="Incidentes abiertos"
          value={metrics.openIncidents}
          sub={`${metrics.totalIncidents} registrados`}
          icon={<Shield className="h-5 w-5" />}
          accent={metrics.openIncidents > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted/40 text-muted-foreground'}
          href="/incidents"
          urgent={metrics.openIncidents > 0}
        />
      </div>

      {/* ── Secondary stats row ── */}
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
        {[
          { label: 'Conductores registrados', value: metrics.drivers, icon: <Users className="h-4 w-4" />, href: '/users' },
          { label: 'Viajes programados',      value: metrics.scheduledTrips, icon: <Clock className="h-4 w-4" />, href: '/trips' },
          { label: 'Viajes cancelados',       value: metrics.cancelledTrips, icon: <XCircle className="h-4 w-4" />, href: '/trips' },
          { label: 'Total viajes',            value: trips.length, icon: <PackagePlus className="h-4 w-4" />, href: '/trips' },
        ].map((s) => (
          <Link key={s.label} href={s.href}
            className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 hover:bg-card/90 hover:shadow-md transition-all">
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">{s.icon}</span>
            <div>
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Feeds: in-transit + recent + incidents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* En tránsito */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-400" />
              En tránsito ahora
            </h2>
            <Link href="/trips" className="text-[11px] text-primary hover:underline">Ver todos</Link>
          </div>
          {inTransitTrips.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border/40 text-muted-foreground gap-1">
              <Activity className="h-6 w-6 opacity-20" />
              <p className="text-xs">Sin viajes activos</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {inTransitTrips.map((t) => <ActiveTripRow key={t.id} trip={t} />)}
            </div>
          )}
        </div>

        {/* Completados recientes */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Completados recientes
            </h2>
            <Link href="/historial" className="text-[11px] text-primary hover:underline">Ver historial</Link>
          </div>
          {recentTrips.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border/40 text-muted-foreground gap-1">
              <CheckCircle2 className="h-6 w-6 opacity-20" />
              <p className="text-xs">Sin viajes completados</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentTrips.map((t) => <RecentTripRow key={t.id} trip={t} />)}
            </div>
          )}
        </div>

        {/* Incidentes abiertos */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Incidentes abiertos
            </h2>
            <Link href="/incidents" className="text-[11px] text-primary hover:underline">Ver todos</Link>
          </div>
          {openIncidentsList.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border/40 text-muted-foreground gap-1">
              <Shield className="h-6 w-6 opacity-20" />
              <p className="text-xs">Sin incidentes activos</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {openIncidentsList.map((inc) => (
                <Link
                  key={inc.id}
                  href={`/incidents/${inc.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 hover:bg-destructive/10 hover:shadow-md transition-all"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{inc.type ?? 'Incidente'}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {inc.description ?? '—'}
                      {inc.created_at ? ` · ${fmtRelativeTime(inc.created_at)}` : ''}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/30 group-hover:text-destructive/60 transition-colors" />
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
