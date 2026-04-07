-- ─────────────────────────────────────────────────────────────
-- Migración 002: Tabla de Tenants (Empresas / Flotillas)
-- Un "tenant" representa una empresa cliente del SaaS.
-- ─────────────────────────────────────────────────────────────

create table public.tenants (
  id          uuid        primary key default extensions.uuid_generate_v4(),
  name        text        not null,
  slug        text        not null unique,         -- Identificador URL-friendly (ej: "transportes-garcia")
  plan        text        not null default 'free'  -- 'free' | 'pro' | 'enterprise'
                          check (plan in ('free', 'pro', 'enterprise')),
  is_active   boolean     not null default true,
  settings    jsonb       not null default '{}'::jsonb,  -- Config flexible por tenant
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Trigger para auto-actualizar updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

comment on table public.tenants is
  'Empresas o flotillas de transporte que usan el sistema (multitenencia).';
comment on column public.tenants.slug is
  'Identificador único URL-friendly del tenant, ej: transportes-garcia.';
comment on column public.tenants.settings is
  'Configuración flexible por tenant: umbral de desvío, colores, timezone, etc.';
