-- ─────────────────────────────────────────────────────────────
-- Migración 009: Índices Espaciales y de Rendimiento Adicionales
-- Ejecutar después de la carga inicial de datos para no ralentizar inserts.
-- ─────────────────────────────────────────────────────────────

-- ─── Función: Calcular desvío en metros desde un punto a una polyline ─────
-- Esta función es usada por el backend pero también se puede llamar directamente.
-- Devuelve la distancia en metros entre un punto GPS y la ruta más cercana.
create or replace function public.calculate_deviation_meters(
  vehicle_point extensions.geography,
  route_polyline extensions.geography
)
returns float language sql immutable parallel safe as $$
  select extensions.ST_Distance(vehicle_point, route_polyline);
$$;

-- ─── Función: Determinar si un punto está fuera de ruta ──────────────────
-- Retorna true si el punto está a más de threshold_m metros de la polyline.
create or replace function public.is_off_route(
  vehicle_point     extensions.geography,
  route_polyline    extensions.geography,
  threshold_m       float default 50.0
)
returns boolean language sql immutable parallel safe as $$
  select not extensions.ST_DWithin(vehicle_point, route_polyline, threshold_m);
$$;

-- ─── Función: Obtener la última ubicación conocida de cada vehículo ───────
-- Optimizada para el dashboard: 1 query para todos los vehículos activos del tenant.
create or replace function public.get_latest_locations(p_tenant_id uuid)
returns table (
  vehicle_id    uuid,
  lat           float,
  lng           float,
  speed_kmh     float,
  heading_deg   smallint,
  is_off_route  boolean,
  recorded_at   timestamptz
) language sql stable security definer as $$
  select distinct on (l.vehicle_id)
    l.vehicle_id,
    extensions.ST_Y(l.point::extensions.geometry) as lat,
    extensions.ST_X(l.point::extensions.geometry) as lng,
    l.speed_kmh,
    l.heading_deg,
    l.is_off_route,
    l.recorded_at
  from public.locations l
  where l.tenant_id = p_tenant_id
  order by l.vehicle_id, l.recorded_at desc;
$$;

-- ─── Función: Obtener historial de ruta de un vehículo (para replay) ─────
create or replace function public.get_vehicle_track(
  p_vehicle_id  uuid,
  p_from        timestamptz,
  p_to          timestamptz
)
returns table (
  lat           float,
  lng           float,
  speed_kmh     float,
  heading_deg   smallint,
  is_off_route  boolean,
  recorded_at   timestamptz
) language sql stable security definer as $$
  select
    extensions.ST_Y(l.point::extensions.geometry) as lat,
    extensions.ST_X(l.point::extensions.geometry) as lng,
    l.speed_kmh,
    l.heading_deg,
    l.is_off_route,
    l.recorded_at
  from public.locations l
  where l.vehicle_id = p_vehicle_id
    and l.recorded_at between p_from and p_to
  order by l.recorded_at asc;
$$;

-- ─── Índice adicional: búsqueda por origen/destino de ruta ───────────────
create index idx_routes_origin   on public.routes using gist(origin_point);
create index idx_routes_dest     on public.routes using gist(dest_point);

-- ─── Índice adicional: vehículos activos por tenant ──────────────────────
create index idx_vehicles_active on public.vehicles(tenant_id)
  where status = 'active';
