-- ─────────────────────────────────────────────────────────────
-- Migración 008: Row Level Security (RLS) — Multitenencia
--
-- PRINCIPIO: Ninguna query puede cruzar el límite del tenant.
-- El tenant_id del JWT del usuario es la única autoridad.
-- El backend usa service_role_key (bypass RLS); el frontend usa anon/user key (RLS activo).
-- ─────────────────────────────────────────────────────────────

-- Función helper: extrae el tenant_id del JWT del usuario autenticado
create or replace function public.auth_tenant_id()
returns uuid language sql stable security definer as $$
  select (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid;
$$;

-- Función helper: extrae el rol del usuario autenticado
create or replace function public.auth_role()
returns text language sql stable security definer as $$
  select (auth.jwt() -> 'user_metadata' ->> 'role')::text;
$$;

-- ─── Habilitar RLS en todas las tablas públicas ───────────────
alter table public.tenants    enable row level security;
alter table public.profiles   enable row level security;
alter table public.vehicles   enable row level security;
alter table public.routes     enable row level security;
alter table public.locations  enable row level security;
alter table public.alerts     enable row level security;

-- ─── TENANTS ─────────────────────────────────────────────────
-- Un usuario solo puede ver su propio tenant
create policy "tenants_select_own" on public.tenants
  for select using (id = public.auth_tenant_id());

-- Solo super_admin puede crear/modificar tenants (gestión del SaaS)
create policy "tenants_insert_super_admin" on public.tenants
  for insert with check (public.auth_role() = 'super_admin');

create policy "tenants_update_super_admin" on public.tenants
  for update using (public.auth_role() = 'super_admin');

-- ─── PROFILES ────────────────────────────────────────────────
-- Cualquier usuario puede ver perfiles de su mismo tenant
create policy "profiles_select_same_tenant" on public.profiles
  for select using (tenant_id = public.auth_tenant_id());

-- Solo admin puede crear/editar perfiles dentro de su tenant
create policy "profiles_insert_admin" on public.profiles
  for insert with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

create policy "profiles_update_admin" on public.profiles
  for update using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

-- Un conductor puede actualizar su propio perfil (para guardar fcm_token)
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

-- ─── VEHICLES ────────────────────────────────────────────────
create policy "vehicles_select_same_tenant" on public.vehicles
  for select using (tenant_id = public.auth_tenant_id());

create policy "vehicles_insert_admin" on public.vehicles
  for insert with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

create policy "vehicles_update_admin" on public.vehicles
  for update using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "vehicles_delete_admin" on public.vehicles
  for delete using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

-- ─── ROUTES ──────────────────────────────────────────────────
create policy "routes_select_same_tenant" on public.routes
  for select using (tenant_id = public.auth_tenant_id());

create policy "routes_insert_admin" on public.routes
  for insert with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "routes_update_admin" on public.routes
  for update using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "routes_delete_admin" on public.routes
  for delete using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

-- ─── LOCATIONS ───────────────────────────────────────────────
-- Drivers: solo pueden insertar ubicaciones del vehículo que tienen asignado
create policy "locations_select_same_tenant" on public.locations
  for select using (tenant_id = public.auth_tenant_id());

-- El insert real lo hace el backend con service_role_key (bypass RLS)
-- Esta policy es fallback si el móvil inserta directamente
create policy "locations_insert_driver" on public.locations
  for insert with check (
    tenant_id = public.auth_tenant_id()
    and exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id
        and v.assigned_driver_id = auth.uid()
    )
  );

-- ─── ALERTS ──────────────────────────────────────────────────
create policy "alerts_select_same_tenant" on public.alerts
  for select using (tenant_id = public.auth_tenant_id());

-- Alerts las crea el backend (service_role_key), no el usuario directamente
-- Esta policy permite que admins/operators marquen alertas como resueltas
create policy "alerts_update_resolve" on public.alerts
  for update using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );
