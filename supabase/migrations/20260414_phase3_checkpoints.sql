-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3: Checkpoints y Enriquecimiento de Rutas
--
-- 1. ALTER routes         — risk_level, max_deviation_m, gps_timeout_s, max_speed_kmh, version
-- 2. Recrear view         — routes_with_polyline incluye nuevas columnas
-- 3. route_checkpoints    — puntos de validación obligatorios/opcionales
-- 4. checkpoint_records   — registro de paso del conductor por cada checkpoint
-- 5. toll_booths          — casetas de peaje con costo estimado
-- 6. route_alternatives   — rutas alternativas vinculadas a una principal
--
-- Equivalentes Puertos3:
--   route_checkpoints   ↔ PuntoValidacion
--   checkpoint_records  ↔ RegistroPasoCheckpoint
--   toll_booths         ↔ CasetaPeaje
--   route_alternatives  ↔ RutaAlternativa
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Enriquecer routes ─────────────────────────────────────────────────────

alter table public.routes
  add column if not exists risk_level       text not null default 'low'
    check (risk_level in ('low', 'medium', 'high')),
  add column if not exists max_deviation_m  int,
  add column if not exists gps_timeout_s    int,
  add column if not exists max_speed_kmh    int,
  add column if not exists version          int not null default 1;

comment on column public.routes.risk_level      is 'Nivel de riesgo de la ruta: low, medium, high.';
comment on column public.routes.max_deviation_m is 'Distancia máxima de desvío permitida antes de marcar la ruta como desviada. Si null usa deviation_threshold_m.';
comment on column public.routes.gps_timeout_s   is 'Segundos sin señal GPS antes de emitir alerta signal_lost.';
comment on column public.routes.max_speed_kmh   is 'Velocidad máxima permitida en esta ruta en km/h.';
comment on column public.routes.version         is 'Versión de la ruta, incrementar al modificar geometría.';

-- ─── 2. Recrear view routes_with_polyline ─────────────────────────────────────

create or replace view public.routes_with_polyline as
  select
    id,
    tenant_id,
    name,
    description,
    status,
    origin_name,
    dest_name,
    vehicle_id,
    total_distance_m,
    estimated_duration_s,
    deviation_threshold_m,
    risk_level,
    max_deviation_m,
    gps_timeout_s,
    max_speed_kmh,
    version,
    created_at,
    updated_at,
    ((st_asgeojson(polyline)::json -> 'coordinates'))::jsonb  as polyline_coords,
    st_y(origin_point::geometry)                              as origin_lat,
    st_x(origin_point::geometry)                             as origin_lng,
    st_y(dest_point::geometry)                               as dest_lat,
    st_x(dest_point::geometry)                               as dest_lng,
    created_by,
    stops
  from public.routes;

-- ─── 3. route_checkpoints ────────────────────────────────────────────────────

create table if not exists public.route_checkpoints (
  id                          uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id                   uuid          not null references public.tenants(id) on delete cascade,
  route_id                    uuid          not null references public.routes(id) on delete cascade,

  name                        text          not null,
  description                 text,
  order_index                 int           not null,
  is_mandatory                boolean       not null default true,

  -- Posición
  lat                         double precision not null,
  lng                         double precision not null,
  radius_m                    int           not null default 200,
  point                       extensions.geography(POINT, 4326),

  -- Tiempo estimado de llegada desde inicio del viaje (para alertas de retraso)
  estimated_arrival_offset_s  int,

  created_at                  timestamptz   not null default now(),
  updated_at                  timestamptz   not null default now()
);

-- Auto-calcular point desde lat/lng
create or replace function public.set_checkpoint_point()
returns trigger language plpgsql as $$
begin
  new.point := extensions.st_point(new.lng, new.lat)::extensions.geography;
  return new;
end;
$$;

create trigger checkpoint_set_point
  before insert or update on public.route_checkpoints
  for each row execute function public.set_checkpoint_point();

create trigger route_checkpoints_updated_at
  before update on public.route_checkpoints
  for each row execute function public.set_updated_at();

create index if not exists idx_checkpoints_route
  on public.route_checkpoints(route_id, order_index);
create index if not exists idx_checkpoints_point
  on public.route_checkpoints using gist(point);

alter table public.route_checkpoints enable row level security;

create policy "checkpoints: tenant select"
  on public.route_checkpoints for select
  using (tenant_id = public.auth_tenant_id());

create policy "checkpoints: admin insert"
  on public.route_checkpoints for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "checkpoints: admin update"
  on public.route_checkpoints for update
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "checkpoints: admin delete"
  on public.route_checkpoints for delete
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.route_checkpoints is
  'Puntos de validación en ruta (obligatorios u opcionales) con geocerca de llegada. Equivalente a PuntoValidacion en Puertos3.';

-- ─── 4. checkpoint_records ───────────────────────────────────────────────────

create table if not exists public.checkpoint_records (
  id              uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id       uuid          not null references public.tenants(id) on delete cascade,
  trip_id         uuid          not null references public.trips(id) on delete cascade,
  checkpoint_id   uuid          not null references public.route_checkpoints(id) on delete cascade,
  driver_id       uuid          not null references public.profiles(id) on delete cascade,

  arrived_at      timestamptz   not null default now(),
  lat             double precision,
  lng             double precision,
  notes           text,

  created_at      timestamptz   not null default now(),

  unique (trip_id, checkpoint_id)
);

create index if not exists idx_checkpoint_records_trip
  on public.checkpoint_records(trip_id, arrived_at);
create index if not exists idx_checkpoint_records_driver
  on public.checkpoint_records(driver_id);

alter table public.checkpoint_records enable row level security;

create policy "checkpoint_records: tenant select"
  on public.checkpoint_records for select
  using (
    tenant_id = public.auth_tenant_id()
    and (
      public.auth_role() in ('admin', 'super_admin', 'operator')
      or (public.auth_role() = 'driver' and driver_id = auth.uid())
    )
  );

create policy "checkpoint_records: driver insert"
  on public.checkpoint_records for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and (
      public.auth_role() in ('admin', 'super_admin', 'operator')
      or (public.auth_role() = 'driver' and driver_id = auth.uid())
    )
  );

create policy "checkpoint_records: admin delete"
  on public.checkpoint_records for delete
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.checkpoint_records is
  'Registro de paso del conductor por cada checkpoint de la ruta. Equivalente a RegistroPasoCheckpoint en Puertos3.';

-- ─── 5. toll_booths ──────────────────────────────────────────────────────────

create table if not exists public.toll_booths (
  id              uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id       uuid          not null references public.tenants(id) on delete cascade,
  route_id        uuid          not null references public.routes(id) on delete cascade,

  name            text          not null,
  order_index     int           not null,
  lat             double precision not null,
  lng             double precision not null,
  cost_mxn        numeric(10,2),

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create trigger toll_booths_updated_at
  before update on public.toll_booths
  for each row execute function public.set_updated_at();

create index if not exists idx_toll_booths_route
  on public.toll_booths(route_id, order_index);

alter table public.toll_booths enable row level security;

create policy "toll_booths: tenant select"
  on public.toll_booths for select
  using (tenant_id = public.auth_tenant_id());

create policy "toll_booths: admin insert"
  on public.toll_booths for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "toll_booths: admin update"
  on public.toll_booths for update
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "toll_booths: admin delete"
  on public.toll_booths for delete
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.toll_booths is
  'Casetas de peaje en la ruta con costo estimado. Equivalente a CasetaPeaje en Puertos3.';

-- ─── 6. route_alternatives ───────────────────────────────────────────────────

create table if not exists public.route_alternatives (
  id                    uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id             uuid          not null references public.tenants(id) on delete cascade,
  primary_route_id      uuid          not null references public.routes(id) on delete cascade,

  name                  text          not null,
  reason                text,
  polyline              extensions.geography(LINESTRING, 4326),
  total_distance_m      double precision,
  estimated_duration_s  int,
  is_active             boolean       not null default true,

  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

create trigger route_alternatives_updated_at
  before update on public.route_alternatives
  for each row execute function public.set_updated_at();

create index if not exists idx_route_alternatives_primary
  on public.route_alternatives(primary_route_id);
create index if not exists idx_route_alternatives_polyline
  on public.route_alternatives using gist(polyline);

alter table public.route_alternatives enable row level security;

create policy "route_alternatives: tenant select"
  on public.route_alternatives for select
  using (tenant_id = public.auth_tenant_id());

create policy "route_alternatives: admin insert"
  on public.route_alternatives for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "route_alternatives: admin update"
  on public.route_alternatives for update
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "route_alternatives: admin delete"
  on public.route_alternatives for delete
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.route_alternatives is
  'Rutas alternativas vinculadas a una ruta principal (desvíos, obras, clima). Equivalente a RutaAlternativa en Puertos3.';
