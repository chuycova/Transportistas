-- ─────────────────────────────────────────────────────────────
-- Migración 003: Tabla de Perfiles de Usuario
-- Extiende la tabla auth.users de Supabase.
-- Un perfil puede ser: admin del tenant, operador o conductor.
-- ─────────────────────────────────────────────────────────────

create table public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  tenant_id   uuid        not null references public.tenants(id) on delete cascade,
  full_name   text        not null,
  phone       text,
  role        text        not null default 'driver'
                          check (role in ('super_admin', 'admin', 'operator', 'driver')),
  avatar_url  text,
  is_active   boolean     not null default true,
  fcm_token   text,       -- Token de Firebase para Push Notifications del conductor
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Índice para listar usuarios de un tenant eficientemente
create index idx_profiles_tenant_id on public.profiles(tenant_id);
create index idx_profiles_role on public.profiles(tenant_id, role);

-- Trigger: Crear perfil vacío automáticamente al registrar un usuario en Supabase Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  -- El tenant_id se inyecta via raw_user_meta_data al momento del registro
  insert into public.profiles (id, tenant_id, full_name, role)
  values (
    new.id,
    (new.raw_user_meta_data->>'tenant_id')::uuid,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'driver')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on table public.profiles is
  'Perfil extendido de usuarios. Un usuario pertenece a exactamente un tenant.';
comment on column public.profiles.role is
  'driver: solo envía GPS. operator: ve el mapa. admin: gestión completa del tenant.';
comment on column public.profiles.fcm_token is
  'Token FCM registrado desde la app móvil para recibir push notifications de desvío.';
