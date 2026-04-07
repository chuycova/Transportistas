-- ─────────────────────────────────────────────────────────────
-- Migración 006: Tabla de Historial de Ubicaciones (Tracking)
-- Es la tabla de mayor volumen del sistema. Cada registro = 1 "ping" GPS.
-- Diseñada para lecturas rápidas por tiempo y vehículo.
-- ─────────────────────────────────────────────────────────────

-- Usamos bigserial (no UUID) como PK para máximo rendimiento en inserts masivos.
create table public.locations (
  id          bigserial     primary key,
  tenant_id   uuid          not null references public.tenants(id) on delete cascade,
  vehicle_id  uuid          not null references public.vehicles(id) on delete cascade,
  route_id    uuid          references public.routes(id) on delete set null,

  -- Coordenada GPS (punto en WGS84)
  point       extensions.geography(POINT, 4326) not null,

  -- Telemetría del vehículo en ese instante
  speed_kmh   float,                    -- Velocidad en km/h
  heading_deg smallint,                 -- Dirección (0–360 grados)
  accuracy_m  float,                    -- Precisión del GPS en metros

  -- Estado calculado en el backend al recibir el ping
  is_off_route  boolean   not null default false,
  deviation_m   float,                  -- Metros de desviación calculados en ese momento

  -- El timestamp lo provee el dispositivo móvil (importante para offline sync)
  recorded_at   timestamptz not null,
  -- El timestamp de cuando llegó al servidor (para detectar lag de sync offline)
  received_at   timestamptz not null default now()
);

-- ─── Índices Críticos ─────────────────────────────────────────
-- Índice espacial para buscar vehículos dentro de una zona geográfica
create index idx_locations_point       on public.locations using gist(point);

-- Índice compuesto para el caso de uso más frecuente: replay de historial de 1 vehículo
create index idx_locations_vehicle_time on public.locations(vehicle_id, recorded_at desc);

-- Índice para el dashboard de alertas activas (filtrar pings con desvío)
create index idx_locations_off_route   on public.locations(tenant_id, is_off_route)
  where is_off_route = true;

-- Índice para queries por tenant y tiempo (reportes diarios)
create index idx_locations_tenant_time on public.locations(tenant_id, recorded_at desc);

comment on table public.locations is
  'Historial de pings GPS de cada vehículo. Tabla de mayor volumen del sistema.';
comment on column public.locations.recorded_at is
  'Timestamp generado por el dispositivo móvil. Puede llegar con retraso (modo offline).';
comment on column public.locations.received_at is
  'Timestamp de llegada al servidor. La diferencia con recorded_at mide el lag offline.';
comment on column public.locations.deviation_m is
  'Distancia en metros desde la polyline de la ruta. Calculado por el backend, no por PostGIS en tiempo real.';
