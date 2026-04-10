-- ─────────────────────────────────────────────────────────────────────────────
-- Ampliar CHECK constraint de alert_type para incluir emergency y geocercas
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.alerts
  drop constraint if exists alerts_alert_type_check;

alter table public.alerts
  add constraint alerts_alert_type_check
  check (alert_type in (
    'off_route', 'long_stop', 'speeding', 'arrived_stop',
    'route_completed', 'signal_lost', 'signal_recovered',
    'emergency', 'geofence_entry', 'geofence_exit'
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla de geocercas (polígonos por tenant)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.geofences (
  id               uuid        primary key default extensions.uuid_generate_v4(),
  tenant_id        uuid        not null references public.tenants(id) on delete cascade,
  name             text        not null,
  description      text,
  type             text        not null default 'generic'
                               check (type in ('base', 'client', 'risk_zone', 'restricted', 'generic')),
  color            text        not null default '#6366f1',
  polygon_coords   jsonb       not null,
  alert_on_enter   boolean     not null default true,
  alert_on_exit    boolean     not null default false,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger geofences_updated_at
  before update on public.geofences
  for each row execute function public.set_updated_at();

create index if not exists idx_geofences_tenant_active
  on public.geofences(tenant_id) where is_active = true;

alter table public.geofences enable row level security;

create policy "geofences_select_same_tenant" on public.geofences
  for select using (tenant_id = public.auth_tenant_id());

create policy "geofences_insert_admin" on public.geofences
  for insert with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "geofences_update_admin" on public.geofences
  for update using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "geofences_delete_admin" on public.geofences
  for delete using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.geofences is
  'Zonas geográficas definidas por polígono. Generan alertas al entrar/salir los vehículos.';
