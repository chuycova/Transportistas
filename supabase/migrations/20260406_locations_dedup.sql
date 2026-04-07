-- ─────────────────────────────────────────────────────────────────────────────
-- Migración: Deduplicación de pings GPS offline
--
-- Problema: cuando el móvil envía un ping, guarda en WatermelonDB (synced=false).
-- Si la respuesta HTTP llega pero se pierde en tránsito, el ping se reenvía en
-- la siguiente reconexión → duplicado en locations.
--
-- Solución:
--   1. Restricción UNIQUE (vehicle_id, recorded_at) — dos pings del mismo vehículo
--      con el mismo timestamp son necesariamente duplicados.
--   2. Las RPCs insert_location y bulk_insert_locations usan ON CONFLICT DO NOTHING,
--      haciendo que el insert sea idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Restricción única de deduplicación
alter table public.locations
  add constraint uq_locations_vehicle_recorded_at
  unique (vehicle_id, recorded_at);

-- 2. Reemplazar insert_location con versión idempotente
create or replace function public.insert_location(
  p_tenant_id   uuid,
  p_vehicle_id  uuid,
  p_route_id    uuid,
  p_lat         float,
  p_lng         float,
  p_speed_kmh   float,
  p_heading_deg smallint,
  p_accuracy_m  float,
  p_is_off_route boolean,
  p_deviation_m float,
  p_recorded_at timestamptz
)
returns json
language plpgsql security definer as $$
declare
  v_row public.locations%rowtype;
begin
  insert into public.locations (
    tenant_id, vehicle_id, route_id, point,
    speed_kmh, heading_deg, accuracy_m,
    is_off_route, deviation_m, recorded_at
  )
  values (
    p_tenant_id,
    p_vehicle_id,
    p_route_id,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography,
    p_speed_kmh,
    p_heading_deg,
    p_accuracy_m,
    p_is_off_route,
    p_deviation_m,
    p_recorded_at
  )
  on conflict (vehicle_id, recorded_at) do nothing
  returning * into v_row;

  -- Si el ping ya existía (conflict), devolver la fila existente
  if v_row.id is null then
    select * into v_row
      from public.locations
     where vehicle_id = p_vehicle_id
       and recorded_at = p_recorded_at;
  end if;

  return json_build_object(
    'id',          v_row.id,
    'tenant_id',   v_row.tenant_id,
    'vehicle_id',  v_row.vehicle_id,
    'lat',         p_lat,
    'lng',         p_lng,
    'speed_kmh',   v_row.speed_kmh,
    'heading_deg', v_row.heading_deg,
    'accuracy_m',  v_row.accuracy_m,
    'is_off_route',v_row.is_off_route,
    'deviation_m', v_row.deviation_m,
    'recorded_at', v_row.recorded_at,
    'received_at', v_row.received_at
  );
end;
$$;

-- 3. Reemplazar bulk_insert_locations con versión idempotente
create or replace function public.bulk_insert_locations(p_locations jsonb)
returns void
language plpgsql security definer as $$
declare
  loc jsonb;
begin
  for loc in select * from jsonb_array_elements(p_locations)
  loop
    insert into public.locations (
      tenant_id, vehicle_id, route_id, point,
      speed_kmh, heading_deg, accuracy_m,
      is_off_route, deviation_m, recorded_at
    )
    values (
      (loc->>'tenant_id')::uuid,
      (loc->>'vehicle_id')::uuid,
      nullif(loc->>'route_id', 'null')::uuid,
      extensions.ST_GeogFromText(loc->>'point'),
      (loc->>'speed_kmh')::float,
      (loc->>'heading_deg')::smallint,
      (loc->>'accuracy_m')::float,
      (loc->>'is_off_route')::boolean,
      (loc->>'deviation_m')::float,
      (loc->>'recorded_at')::timestamptz
    )
    on conflict (vehicle_id, recorded_at) do nothing;
  end loop;
end;
$$;

comment on constraint uq_locations_vehicle_recorded_at on public.locations is
  'Garantiza idempotencia en el sync offline: si el móvil reenvía un ping ya guardado, el insert se ignora silenciosamente.';
