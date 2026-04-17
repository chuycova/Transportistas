-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2: Enrichment de Choferes y Vehículos
--
-- 1. ALTER profiles  — datos fiscales/legales del conductor
-- 2. ALTER vehicles  — datos técnicos/legales del vehículo
-- 3. driver_documents    — documentos con validación
-- 4. vehicle_documents   — documentos con validación
-- 5. emergency_contacts  — contactos de emergencia del conductor
-- 6. maintenance_records — historial de mantenimiento vehicular
--
-- Equivalentes Puertos3:
--   driver_documents   ↔ DocumentoChofer
--   vehicle_documents  ↔ DocumentoCamion
--   emergency_contacts ↔ ContactoEmergencia
--   maintenance_records ↔ RegistroMantenimiento
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Enriquecer profiles (conductores) ─────────────────────────────────────

alter table public.profiles
  add column if not exists curp              text,
  add column if not exists rfc               text,
  add column if not exists license_number    text,
  add column if not exists license_category  text
    check (license_category in ('A', 'B', 'C', 'D', 'E', 'federal') or license_category is null),
  add column if not exists license_expiry    date,
  add column if not exists avg_rating        double precision
    check (avg_rating >= 0 and avg_rating <= 5 or avg_rating is null),
  add column if not exists total_trips       int not null default 0,
  add column if not exists on_time_pct       double precision
    check (on_time_pct >= 0 and on_time_pct <= 100 or on_time_pct is null),
  add column if not exists risk_level        text not null default 'low'
    check (risk_level in ('low', 'medium', 'high'));

comment on column public.profiles.curp            is 'CURP del conductor (18 caracteres). Solo aplica a role=driver.';
comment on column public.profiles.rfc             is 'RFC del conductor o usuario con facturacion.';
comment on column public.profiles.license_number  is 'Número de licencia de conducir federal.';
comment on column public.profiles.license_category is 'Categoría de licencia: A, B, C, D, E o federal.';
comment on column public.profiles.license_expiry  is 'Fecha de vencimiento de la licencia.';
comment on column public.profiles.avg_rating      is 'Calificación promedio del conductor (0-5). Se actualiza al completar viajes.';
comment on column public.profiles.total_trips     is 'Total de viajes completados. Se incrementa automáticamente al completar un viaje.';
comment on column public.profiles.on_time_pct     is 'Porcentaje de viajes completados a tiempo (0-100). Se recalcula al completar viajes.';
comment on column public.profiles.risk_level      is 'Nivel de riesgo del conductor: low, medium, high. Determinado por comportamiento en ruta.';

-- ─── 2. Enriquecer vehicles ───────────────────────────────────────────────────

alter table public.vehicles
  add column if not exists vin                  text unique,
  add column if not exists cargo_capacity_tons  double precision,
  add column if not exists insurance_policy     text,
  add column if not exists insurance_expiry     date,
  add column if not exists mileage_km           int not null default 0;

comment on column public.vehicles.vin                 is 'Vehicle Identification Number (17 caracteres). Número de serie del vehículo.';
comment on column public.vehicles.cargo_capacity_tons is 'Capacidad máxima de carga en toneladas.';
comment on column public.vehicles.insurance_policy    is 'Número de póliza de seguro vigente.';
comment on column public.vehicles.insurance_expiry    is 'Fecha de vencimiento del seguro.';
comment on column public.vehicles.mileage_km          is 'Kilometraje actual. Se actualiza manualmente o al completar viajes.';

-- ─── 3. driver_documents ─────────────────────────────────────────────────────

create table if not exists public.driver_documents (
  id                uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id         uuid          not null references public.tenants(id) on delete cascade,
  driver_id         uuid          not null references public.profiles(id) on delete cascade,

  doc_type          text          not null
    check (doc_type in ('ine', 'license', 'proof_of_address', 'medical_cert', 'other')),
  doc_number        text,
  title             text          not null,

  -- Estado de validación
  status            text          not null default 'pending'
    check (status in ('pending', 'valid', 'expired', 'rejected')),
  rejection_reason  text,

  -- Vigencia
  issued_at         date,
  expires_at        date,

  -- Auditoría de validación
  validated_at      timestamptz,
  validated_by      uuid          references public.profiles(id) on delete set null,

  -- Archivo en Supabase Storage
  file_url          text,
  file_path         text,

  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create trigger driver_documents_updated_at
  before update on public.driver_documents
  for each row execute function public.set_updated_at();

create index if not exists idx_driver_docs_driver
  on public.driver_documents(driver_id, doc_type);
create index if not exists idx_driver_docs_tenant_status
  on public.driver_documents(tenant_id, status);
create index if not exists idx_driver_docs_expiry
  on public.driver_documents(expires_at)
  where expires_at is not null;

alter table public.driver_documents enable row level security;

create policy "driver_docs: tenant select"
  on public.driver_documents for select
  using (
    tenant_id = public.auth_tenant_id()
    and (
      public.auth_role() in ('admin', 'super_admin', 'operator')
      or (public.auth_role() = 'driver' and driver_id = auth.uid())
    )
  );

create policy "driver_docs: admin insert"
  on public.driver_documents for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "driver_docs: admin update"
  on public.driver_documents for update
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "driver_docs: admin delete"
  on public.driver_documents for delete
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.driver_documents is
  'Documentos del conductor (INE, licencia, comprobante domicilio, etc.) con estado de validación. Equivalente a DocumentoChofer en Puertos3.';

-- ─── 4. vehicle_documents ─────────────────────────────────────────────────────

create table if not exists public.vehicle_documents (
  id                uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id         uuid          not null references public.tenants(id) on delete cascade,
  vehicle_id        uuid          not null references public.vehicles(id) on delete cascade,

  doc_type          text          not null
    check (doc_type in ('tarjeta_circulacion', 'seguro', 'verificacion', 'revision_fisica', 'other')),
  doc_number        text,
  title             text          not null,

  status            text          not null default 'pending'
    check (status in ('pending', 'valid', 'expired', 'rejected')),
  rejection_reason  text,

  issued_at         date,
  expires_at        date,

  validated_at      timestamptz,
  validated_by      uuid          references public.profiles(id) on delete set null,

  file_url          text,
  file_path         text,

  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create trigger vehicle_documents_updated_at
  before update on public.vehicle_documents
  for each row execute function public.set_updated_at();

create index if not exists idx_vehicle_docs_vehicle
  on public.vehicle_documents(vehicle_id, doc_type);
create index if not exists idx_vehicle_docs_tenant_status
  on public.vehicle_documents(tenant_id, status);
create index if not exists idx_vehicle_docs_expiry
  on public.vehicle_documents(expires_at)
  where expires_at is not null;

alter table public.vehicle_documents enable row level security;

create policy "vehicle_docs: tenant select"
  on public.vehicle_documents for select
  using (tenant_id = public.auth_tenant_id());

create policy "vehicle_docs: admin insert"
  on public.vehicle_documents for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "vehicle_docs: admin update"
  on public.vehicle_documents for update
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "vehicle_docs: admin delete"
  on public.vehicle_documents for delete
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.vehicle_documents is
  'Documentos del vehículo (tarjeta de circulación, seguro, verificación) con estado de validación. Equivalente a DocumentoCamion en Puertos3.';

-- ─── 5. emergency_contacts ───────────────────────────────────────────────────

create table if not exists public.emergency_contacts (
  id              uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id       uuid          not null references public.tenants(id) on delete cascade,
  driver_id       uuid          not null references public.profiles(id) on delete cascade,

  full_name       text          not null,
  relationship    text,
  phone           text          not null,
  phone_alt       text,
  is_primary      boolean       not null default false,

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

create trigger emergency_contacts_updated_at
  before update on public.emergency_contacts
  for each row execute function public.set_updated_at();

create index if not exists idx_emergency_contacts_driver
  on public.emergency_contacts(driver_id);

alter table public.emergency_contacts enable row level security;

create policy "emergency_contacts: tenant select"
  on public.emergency_contacts for select
  using (
    tenant_id = public.auth_tenant_id()
    and (
      public.auth_role() in ('admin', 'super_admin', 'operator')
      or (public.auth_role() = 'driver' and driver_id = auth.uid())
    )
  );

create policy "emergency_contacts: admin insert"
  on public.emergency_contacts for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "emergency_contacts: admin update"
  on public.emergency_contacts for update
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "emergency_contacts: admin delete"
  on public.emergency_contacts for delete
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.emergency_contacts is
  'Contactos de emergencia del conductor. Equivalente a ContactoEmergencia en Puertos3.';

-- ─── 6. maintenance_records ───────────────────────────────────────────────────

create table if not exists public.maintenance_records (
  id                    uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id             uuid          not null references public.tenants(id) on delete cascade,
  vehicle_id            uuid          not null references public.vehicles(id) on delete cascade,

  maintenance_type      text          not null
    check (maintenance_type in ('preventive', 'corrective', 'inspection', 'other')),
  description           text          not null,

  workshop_name         text,
  cost_mxn              numeric(12,2),

  mileage_km_at_service int,

  service_date          date          not null,
  next_service_date     date,
  next_service_km       int,

  file_url              text,
  file_path             text,

  performed_by          uuid          references public.profiles(id) on delete set null,

  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

create trigger maintenance_records_updated_at
  before update on public.maintenance_records
  for each row execute function public.set_updated_at();

create index if not exists idx_maintenance_vehicle
  on public.maintenance_records(vehicle_id, service_date desc);
create index if not exists idx_maintenance_next_service
  on public.maintenance_records(vehicle_id, next_service_date)
  where next_service_date is not null;

alter table public.maintenance_records enable row level security;

create policy "maintenance_records: tenant select"
  on public.maintenance_records for select
  using (tenant_id = public.auth_tenant_id());

create policy "maintenance_records: admin insert"
  on public.maintenance_records for insert
  with check (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "maintenance_records: admin update"
  on public.maintenance_records for update
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin', 'operator')
  );

create policy "maintenance_records: admin delete"
  on public.maintenance_records for delete
  using (
    tenant_id = public.auth_tenant_id()
    and public.auth_role() in ('admin', 'super_admin')
  );

comment on table public.maintenance_records is
  'Historial de mantenimiento vehicular (preventivo, correctivo, inspecciones). Equivalente a RegistroMantenimiento en Puertos3.';
