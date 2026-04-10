-- ─────────────────────────────────────────────────────────────────────────────
-- vehicle_user_assignments: many-to-many vehículo ↔ usuario
-- Permite asignar múltiples usuarios a un vehículo y rastrear el historial.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.vehicle_user_assignments (
  id            uuid        primary key default extensions.uuid_generate_v4(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  vehicle_id    uuid        not null references public.vehicles(id) on delete cascade,
  user_id       uuid        not null references public.profiles(id) on delete cascade,
  assigned_at   timestamptz not null default now(),
  assigned_by   uuid        references public.profiles(id) on delete set null,
  unassigned_at timestamptz,
  is_active     boolean     not null default true,
  notes         text
);

-- Índices
create index if not exists idx_vua_vehicle_active
  on public.vehicle_user_assignments(vehicle_id)
  where is_active = true;

create index if not exists idx_vua_user
  on public.vehicle_user_assignments(user_id);

create index if not exists idx_vua_tenant
  on public.vehicle_user_assignments(tenant_id);

create index if not exists idx_vua_history
  on public.vehicle_user_assignments(vehicle_id, assigned_at desc);

-- RLS
alter table public.vehicle_user_assignments enable row level security;

create policy "vua_select_same_tenant" on public.vehicle_user_assignments
  for select using (tenant_id = public.auth_tenant_id());

create policy "vua_insert_admin" on public.vehicle_user_assignments
  for insert with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "vua_update_admin" on public.vehicle_user_assignments
  for update using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "vua_delete_admin" on public.vehicle_user_assignments
  for delete using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.vehicle_user_assignments is
  'Asignaciones de usuarios (conductores, operadores) a vehículos. is_active=false indica historial.';
