-- Migración 011: RPCs para insertar ubicaciones con geometría PostGIS

-- ─── Insertar una ubicación individual ───────────────────────────────────────
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
returns json  -- Retorna la fila insertada como JSON
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
  returning * into v_row;

  return json_build_object(
    'id', v_row.id,
    'tenant_id', v_row.tenant_id,
    'vehicle_id', v_row.vehicle_id,
    'lat', p_lat,
    'lng', p_lng,
    'speed_kmh', v_row.speed_kmh,
    'heading_deg', v_row.heading_deg,
    'accuracy_m', v_row.accuracy_m,
    'is_off_route', v_row.is_off_route,
    'deviation_m', v_row.deviation_m,
    'recorded_at', v_row.recorded_at,
    'received_at', v_row.received_at
  );
end;
$$;

-- ─── Insertar múltiples ubicaciones (sync offline) ────────────────────────────
-- Recibe un JSON array de ubicaciones y las inserta en una transacción
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
    );
  end loop;
end;
$$;

comment on function public.insert_location is
  'Inserta un ping GPS individual con geometría PostGIS. Llamada desde el backend por cada actualización en tiempo real.';
comment on function public.bulk_insert_locations is
  'Inserta múltiples pings GPS en lote. Usada para sincronización offline del móvil.';
