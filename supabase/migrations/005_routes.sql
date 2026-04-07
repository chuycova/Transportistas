-- ─────────────────────────────────────────────────────────────
-- Migración 005: Tabla de Rutas
-- Almacena rutas predefinidas con su trazado geoespacial (Polyline).
-- ─────────────────────────────────────────────────────────────

create table public.routes (
  id              uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id       uuid          not null references public.tenants(id) on delete cascade,
  name            text          not null,
  description     text,
  status          text          not null default 'draft'
                                check (status in ('draft', 'active', 'archived')),

  -- Geometría PostGIS: línea completa de la ruta (SRID 4326 = WGS84, coordenadas GPS estándar)
  polyline        extensions.geography(LINESTRING, 4326) not null,

  -- Puntos de referencia rápida (origen y destino)
  origin_point    extensions.geography(POINT, 4326)     not null,
  dest_point      extensions.geography(POINT, 4326)     not null,
  origin_name     text          not null,                -- Nombre legible del origen
  dest_name       text          not null,                -- Nombre legible del destino

  -- Paradas intermedias ordenadas (array JSON para máxima flexibilidad)
  -- Estructura: [{ "order": 1, "name": "Almacén Norte", "lat": 19.4, "lng": -99.1 }, ...]
  stops           jsonb         not null default '[]'::jsonb,

  -- Métricas calculadas al guardar
  total_distance_m  float,      -- Distancia total de la ruta en metros
  estimated_duration_s int,     -- Duración estimada en segundos

  -- Umbral de desvío: si null, usa el del tenant en tenants.settings
  deviation_threshold_m int,

  created_by      uuid          references public.profiles(id) on delete set null,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create trigger routes_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();

-- Índice espacial GiST para queries de proximidad (ST_DWithin, ST_Distance)
create index idx_routes_polyline    on public.routes using gist(polyline);
create index idx_routes_tenant_id   on public.routes(tenant_id);
create index idx_routes_status      on public.routes(tenant_id, status);

comment on table public.routes is
  'Rutas predefinidas con su trazado PostGIS. La polyline es la referencia para detectar desvíos.';
comment on column public.routes.polyline is
  'Trazado completo de la ruta como LINESTRING en WGS84. Es la referencia para ST_DWithin.';
comment on column public.routes.stops is
  'Paradas intermedias ordenadas: [{ order, name, lat, lng, radius_m }]';
comment on column public.routes.deviation_threshold_m is
  'Metros de tolerancia para desvío. Si null, hereda del tenant (tenants.settings->deviation_threshold_m).';
