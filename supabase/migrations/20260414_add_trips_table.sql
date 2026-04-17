-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 1: Tabla trips (Viajes)
--
-- Entidad central del modelo de negocio. Conecta Chofer + Vehículo + Ruta
-- con un ciclo de vida completo (draft → scheduled → in_transit → completed).
--
-- Equivalente a "Viaje" en Puertos3 (DevExpress XAF).
-- Mapeo enum: draft=0, scheduled=10, confirmed=1, in_transit=2,
--             at_destination=3, completed=4, closed=5, cancelled=6
--
-- Relaciona:
--   - locations.trip_id  → pings GPS de este viaje
--   - alerts.trip_id     → alertas generadas durante este viaje
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Función helper para generar código de viaje ─────────────────────────────
-- Formato: VJ-YYYYMMDD-NNNNN (compatible con CodigoViaje de Puertos3)
create or replace function public.generate_trip_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date    text := to_char(now(), 'YYYYMMDD');
  v_count   int;
  v_code    text;
begin
  select count(*) + 1
    into v_count
    from public.trips
   where created_at::date = current_date;

  v_code := 'VJ-' || v_date || '-' || lpad(v_count::text, 5, '0');
  return v_code;
end;
$$;

-- ─── Tabla principal ──────────────────────────────────────────────────────────
create table if not exists public.trips (
  id                    uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id             uuid          not null references public.tenants(id) on delete cascade,

  -- Código único de operación (auto-generado)
  code                  text          not null unique default public.generate_trip_code(),

  -- Actores del viaje
  driver_id             uuid          references public.profiles(id) on delete set null,
  vehicle_id            uuid          references public.vehicles(id) on delete set null,
  route_id              uuid          references public.routes(id) on delete set null,

  -- Origen (desnormalizado para queries rápidas sin JOIN)
  origin_name           text          not null,
  origin_lat            double precision not null,
  origin_lng            double precision not null,

  -- Destino (desnormalizado)
  dest_name             text          not null,
  dest_lat              double precision not null,
  dest_lng              double precision not null,

  -- Información de carga
  cargo_type            text,
  container_numbers     text,          -- CSV cuando hay múltiples contenedores
  weight_tons           double precision,

  -- Tiempos del ciclo de vida
  scheduled_at          timestamptz,   -- Cuándo está programado salir
  started_at            timestamptz,   -- Cuándo inició realmente
  completed_at          timestamptz,   -- Cuándo llegó a destino

  -- Métricas (calculadas por el backend al crear/completar)
  estimated_distance_km double precision,
  estimated_duration_min int,
  actual_distance_km    double precision,  -- Se actualiza al completar el viaje

  -- Estado del viaje
  status                text          not null default 'scheduled'
                        check (status in (
                          'draft',          -- Borrador, aún no confirmado
                          'scheduled',      -- Programado (Puertos3: 10)
                          'confirmed',      -- Confirmado por operador
                          'in_transit',     -- En tránsito (Puertos3: 2)
                          'at_destination', -- Llegó a destino (Puertos3: 3)
                          'completed',      -- Completado y cerrado (Puertos3: 4)
                          'closed',         -- Cerrado administrativamente
                          'cancelled'       -- Cancelado (Puertos3: 6)
                        )),
  cancellation_reason   text,

  -- Token para tracking público (sin autenticación, para clientes externos)
  -- Nulo hasta que el operador active el tracking público
  tracking_token        text          unique,

  -- Quién creó el viaje
  created_by            uuid          references public.profiles(id) on delete set null,

  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

-- ─── Trigger updated_at ───────────────────────────────────────────────────────
create trigger trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

-- ─── Índices ──────────────────────────────────────────────────────────────────
-- Consultas más frecuentes: viajes activos del tenant
create index if not exists idx_trips_tenant_status
  on public.trips(tenant_id, status);

-- Viajes por conductor (para vista del driver en la app móvil)
create index if not exists idx_trips_driver
  on public.trips(driver_id, status);

-- Viajes por vehículo
create index if not exists idx_trips_vehicle
  on public.trips(vehicle_id, created_at desc);

-- Viajes por ruta
create index if not exists idx_trips_route
  on public.trips(route_id, created_at desc);

-- Búsqueda por código (frecuente en operaciones)
create index if not exists idx_trips_code
  on public.trips(tenant_id, code);

-- Viajes por fecha programada (para planificación)
create index if not exists idx_trips_scheduled
  on public.trips(tenant_id, scheduled_at)
  where scheduled_at is not null;

-- Viajes activos (partial index — muy frecuente en el dashboard)
create index if not exists idx_trips_active
  on public.trips(tenant_id, started_at desc)
  where status in ('confirmed', 'in_transit', 'at_destination');

-- ─── Vincular locations con trips ────────────────────────────────────────────
alter table public.locations
  add column if not exists trip_id uuid references public.trips(id) on delete set null;

create index if not exists idx_locations_trip
  on public.locations(trip_id, recorded_at desc);

-- ─── Vincular alerts con trips ────────────────────────────────────────────────
alter table public.alerts
  add column if not exists trip_id uuid references public.trips(id) on delete set null;

create index if not exists idx_alerts_trip
  on public.alerts(trip_id, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.trips enable row level security;

-- Monitors: ven todos los viajes del tenant
create policy "trips: monitor select tenant"
  on public.trips for select
  using (
    tenant_id = public.auth_tenant_id()
    and public.current_user_role() in ('admin', 'super_admin', 'operator')
  );

-- Drivers: solo ven sus propios viajes asignados
create policy "trips: driver select own"
  on public.trips for select
  using (
    public.current_user_role() = 'driver'
    and driver_id = auth.uid()
  );

-- Solo admin/operator pueden crear viajes
create policy "trips: admin insert"
  on public.trips for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and public.current_user_role() in ('admin', 'super_admin', 'operator')
  );

-- Admin/operator pueden actualizar cualquier viaje del tenant
create policy "trips: admin update"
  on public.trips for update
  using (
    tenant_id = public.auth_tenant_id()
    and public.current_user_role() in ('admin', 'super_admin', 'operator')
  );

-- Driver puede actualizar solo su propio viaje (para cambiar estado: in_transit, at_destination)
create policy "trips: driver update own status"
  on public.trips for update
  using (
    public.current_user_role() = 'driver'
    and driver_id = auth.uid()
  );

-- Solo super_admin puede eliminar viajes
create policy "trips: super_admin delete"
  on public.trips for delete
  using (
    tenant_id = public.auth_tenant_id()
    and public.current_user_role() = 'super_admin'
  );

-- ─── Comments ─────────────────────────────────────────────────────────────────
comment on table public.trips is
  'Operacion de transporte. Entidad central del sistema — conecta Chofer, Vehiculo y Ruta con un ciclo de vida completo. Equivalente a "Viaje" en el modelo Puertos3.';

comment on column public.trips.code is
  'Codigo unico de operacion, formato VJ-YYYYMMDD-NNNNN. Compatible con CodigoViaje de Puertos3.';

comment on column public.trips.status is
  'Estado del viaje. Mapeo Puertos3 int: draft=0, confirmed=1, in_transit=2, at_destination=3, completed=4, closed=5, cancelled=6, scheduled=10.';

comment on column public.trips.tracking_token is
  'Token publico para rastreo sin autenticacion (para clientes externos). Se genera bajo demanda.';

comment on column public.trips.container_numbers is
  'Numeros de contenedor separados por coma cuando el viaje transporta multiples contenedores.';

comment on column public.trips.actual_distance_km is
  'Distancia real recorrida. Se calcula al completar el viaje sumando los pings GPS de locations.';
