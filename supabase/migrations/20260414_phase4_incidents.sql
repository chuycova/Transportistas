-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 4: Incidentes y Evidencias
--
-- 1. generate_incident_code()  — genera códigos INC-YYYYMMDD-XXXX
-- 2. incidents                 — tabla principal de incidentes
-- 3. evidence                  — archivos multimedia adjuntos a incidentes
--
-- Equivalentes Puertos3:
--   incidents  ↔ Incidente
--   evidence   ↔ EvidenciaIncidente
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Función generadora de código de incidente ────────────────────────────

create or replace function public.generate_incident_code()
returns text
language plpgsql
as $$
declare
  today_str text := to_char(now(), 'YYYYMMDD');
  seq       int;
  code      text;
begin
  select count(*) + 1
    into seq
    from public.incidents
   where created_at::date = current_date;
  code := 'INC-' || today_str || '-' || lpad(seq::text, 4, '0');
  return code;
end;
$$;

-- ─── 2. Tabla incidents ───────────────────────────────────────────────────────

create table if not exists public.incidents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  trip_id     uuid references public.trips(id) on delete set null,
  vehicle_id  uuid references public.vehicles(id) on delete set null,
  driver_id   uuid not null,
  code        text not null,
  type        text not null check (type in ('mechanical','route_deviation','accident','weather','cargo','other')),
  severity    text not null default 'low' check (severity in ('low','medium','high','critical')),
  status      text not null default 'open' check (status in ('open','in_review','resolved','closed')),
  description text,
  lat         double precision,
  lng         double precision,
  resolution  text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Código único por tenant + fecha para facilitar búsqueda
create unique index if not exists incidents_code_tenant_uidx
  on public.incidents(tenant_id, code);

comment on table  public.incidents              is 'Incidentes reportados por conductores durante viajes.';
comment on column public.incidents.code         is 'Código legible generado al crear: INC-YYYYMMDD-XXXX.';
comment on column public.incidents.type         is 'Tipo: mechanical, route_deviation, accident, weather, cargo, other.';
comment on column public.incidents.severity     is 'Gravedad: low, medium, high, critical.';
comment on column public.incidents.status       is 'Estado del ciclo de vida: open, in_review, resolved, closed.';

-- trigger updated_at
create or replace function public.set_incidents_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_incidents_updated_at();

-- RLS
alter table public.incidents enable row level security;

create policy "tenant_incidents_select" on public.incidents
  for select using (tenant_id = auth_tenant_id());

create policy "tenant_incidents_insert" on public.incidents
  for insert with check (tenant_id = auth_tenant_id());

create policy "tenant_incidents_update" on public.incidents
  for update using (tenant_id = auth_tenant_id());

create policy "tenant_incidents_delete" on public.incidents
  for delete using (tenant_id = auth_tenant_id() and auth_role() = 'admin');

-- ─── 3. Tabla evidence ───────────────────────────────────────────────────────

create table if not exists public.evidence (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  incident_id  uuid references public.incidents(id) on delete cascade,
  trip_id      uuid references public.trips(id) on delete set null,
  driver_id    uuid not null,
  file_url     text not null,
  file_path    text not null,
  file_name    text not null,
  media_type   text not null default 'image/jpeg',
  uploaded_at  timestamptz not null default now()
);

comment on table  public.evidence             is 'Evidencias multimedia (fotos/videos) adjuntas a incidentes.';
comment on column public.evidence.file_url    is 'URL pública del archivo en Supabase Storage.';
comment on column public.evidence.file_path   is 'Ruta interna en el bucket (tenant_id/incident_id/filename).';

alter table public.evidence enable row level security;

create policy "tenant_evidence_select" on public.evidence
  for select using (tenant_id = auth_tenant_id());

create policy "tenant_evidence_insert" on public.evidence
  for insert with check (tenant_id = auth_tenant_id());

create policy "tenant_evidence_delete" on public.evidence
  for delete using (tenant_id = auth_tenant_id());
