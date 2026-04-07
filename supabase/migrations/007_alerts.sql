-- ─────────────────────────────────────────────────────────────
-- Migración 007: Tabla de Alertas
-- Registra cada evento significativo del sistema:
-- desvíos de ruta, paradas no programadas, llegadas, etc.
-- ─────────────────────────────────────────────────────────────

create table public.alerts (
  id              uuid          primary key default extensions.uuid_generate_v4(),
  tenant_id       uuid          not null references public.tenants(id) on delete cascade,
  vehicle_id      uuid          not null references public.vehicles(id) on delete cascade,
  route_id        uuid          references public.routes(id) on delete set null,

  -- El ping GPS que disparó la alerta
  location_id     bigint        references public.locations(id) on delete set null,

  alert_type      text          not null
                                check (alert_type in (
                                  'off_route',            -- Desvío de ruta
                                  'long_stop',            -- Parado más de N minutos
                                  'speeding',             -- Exceso de velocidad
                                  'arrived_stop',         -- Llegó a una parada programada
                                  'route_completed',      -- Ruta finalizada
                                  'signal_lost',          -- Pérdida de señal prolongada
                                  'signal_recovered'      -- Recuperó señal (sync offline)
                                )),

  severity        text          not null default 'warning'
                                check (severity in ('info', 'warning', 'critical')),

  -- Datos de contexto de la alerta (flexible por tipo)
  -- off_route: { "deviation_m": 120, "lat": 19.4, "lng": -99.1 }
  -- speeding:  { "speed_kmh": 110, "limit_kmh": 80 }
  payload         jsonb         not null default '{}'::jsonb,

  -- Estado de resolución
  is_resolved     boolean       not null default false,
  resolved_at     timestamptz,
  resolved_by     uuid          references public.profiles(id) on delete set null,
  resolution_note text,

  -- FCM enviado exitosamente
  notification_sent boolean     not null default false,

  created_at      timestamptz   not null default now()
);

-- Índices para el panel de alertas
create index idx_alerts_tenant_time   on public.alerts(tenant_id, created_at desc);
create index idx_alerts_vehicle       on public.alerts(vehicle_id, created_at desc);
create index idx_alerts_unresolved    on public.alerts(tenant_id, is_resolved)
  where is_resolved = false;
create index idx_alerts_type          on public.alerts(tenant_id, alert_type);

comment on table public.alerts is
  'Registro de eventos importantes: desvíos, paradas largas, exceso de velocidad, etc.';
comment on column public.alerts.payload is
  'Datos de contexto específicos al tipo de alerta. Ver TECH_STACK_AND_STRUCTURE.md para ejemplos.';
comment on column public.alerts.is_resolved is
  'El operador puede marcar la alerta como atendida desde el dashboard web.';
