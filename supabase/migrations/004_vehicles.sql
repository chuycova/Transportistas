-- ─────────────────────────────────────────────────────────────
-- Migración 004: Tabla de Vehículos
-- Representa cada unidad de la flotilla que será monitorizada.
-- ─────────────────────────────────────────────────────────────

create table public.vehicles (
  id            uuid        primary key default extensions.uuid_generate_v4(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  plate         text        not null,                        -- Número de placa (ej: "ABC-1234")
  alias         text,                                        -- Nombre corto (ej: "Unidad 5")
  brand         text,                                        -- Marca (ej: "Mercedes-Benz")
  model         text,                                        -- Modelo (ej: "Actros 2553")
  year          smallint,
  vehicle_type  text        not null default 'truck'
                            check (vehicle_type in ('car', 'truck', 'van', 'motorcycle', 'other')),
  status        text        not null default 'inactive'
                            check (status in ('active', 'inactive', 'maintenance', 'off_route')),
  color         text,                                        -- Color en HEX para el ícono del mapa
  assigned_driver_id uuid   references public.profiles(id) on delete set null,
  metadata      jsonb       not null default '{}'::jsonb,    -- Datos extra: capacidad, seguro, etc.
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- La placa debe ser única dentro del mismo tenant
  unique (tenant_id, plate)
);

create trigger vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- Índices de consulta frecuente
create index idx_vehicles_tenant_id  on public.vehicles(tenant_id);
create index idx_vehicles_status     on public.vehicles(tenant_id, status);
create index idx_vehicles_driver     on public.vehicles(assigned_driver_id);

comment on table public.vehicles is
  'Unidades de la flotilla (coches, camiones, etc.) por tenant.';
comment on column public.vehicles.color is
  'Color HEX del marcador en el mapa, ej: #FF5733. Permite identificar visualmente cada unidad.';
comment on column public.vehicles.status is
  'active: en ruta y conectado. off_route: desvío detectado. inactive: sin actividad reciente.';
