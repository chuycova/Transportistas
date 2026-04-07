-- Migración 010: Función RPC para crear rutas con geometría PostGIS
-- Necesaria porque el cliente JS de Supabase no puede construir tipos geography directamente.
-- El backend llama a: supabase.rpc('create_route', { p_polyline_wkt: 'LINESTRING(...)' })

create or replace function public.create_route(
  p_tenant_id           uuid,
  p_name                text,
  p_description         text,
  p_polyline_wkt        text,   -- ej: 'LINESTRING(-99.133 19.432, -99.120 19.428, ...)'
  p_origin_wkt          text,   -- ej: 'POINT(-99.133 19.432)'
  p_dest_wkt            text,
  p_origin_name         text,
  p_dest_name           text,
  p_stops               jsonb,
  p_total_distance_m    float,
  p_estimated_duration_s int,
  p_deviation_threshold_m int,
  p_created_by          uuid
)
returns uuid  -- Retorna el ID de la ruta creada
language plpgsql security definer as $$
declare
  v_route_id uuid;
begin
  insert into public.routes (
    tenant_id, name, description,
    polyline, origin_point, dest_point,
    origin_name, dest_name, stops,
    total_distance_m, estimated_duration_s,
    deviation_threshold_m, created_by
  ) values (
    p_tenant_id,
    p_name,
    p_description,
    extensions.ST_GeogFromText(p_polyline_wkt),
    extensions.ST_GeogFromText(p_origin_wkt),
    extensions.ST_GeogFromText(p_dest_wkt),
    p_origin_name,
    p_dest_name,
    p_stops,
    p_total_distance_m,
    p_estimated_duration_s,
    p_deviation_threshold_m,
    p_created_by
  )
  returning id into v_route_id;

  return v_route_id;
end;
$$;

comment on function public.create_route is
  'Inserta una ruta con geometría PostGIS desde WKT. Llamada vía RPC desde el backend NestJS.';
