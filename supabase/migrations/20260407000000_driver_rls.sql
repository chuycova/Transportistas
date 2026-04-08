-- ─── Migration: Multitenancy RLS — Monitor vs Conductor ─────────────────────
-- Archivo: supabase/migrations/20260407_driver_rls.sql
--
-- REGLAS:
--   Monitor (admin/operator/super_admin) → acceso completo a datos del tenant
--   Conductor (driver)                   → solo SU vehículo y SUS rutas asignadas
--
-- Helper: extrae el role del profile sin queries adicionales, usando el JWT claim
-- que ya setea la función handle_new_user/trigger via raw_app_meta_data.

-- ─── FUNCIÓN HELPER: role del usuario actual ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1. Claim en el JWT (seteado por el trigger de auth)
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    -- 2. Fallback: query al perfil
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()))
  );
$$;

-- ─── vehicles: SELECT ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vehicles: monitor can select own tenant" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles: driver sees only assigned vehicle" ON public.vehicles;

CREATE POLICY "vehicles: monitor can select own tenant"
  ON public.vehicles FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND public.current_user_role() IN ('admin', 'super_admin', 'operator')
  );

CREATE POLICY "vehicles: driver sees only assigned vehicle"
  ON public.vehicles FOR SELECT
  USING (
    assigned_driver_id = (SELECT auth.uid())
    AND public.current_user_role() = 'driver'
  );

-- ─── routes: SELECT ──────────────────────────────────────────────────────────
-- Monitor ve todas las rutas del tenant.
-- Conductor ve solo las rutas cuyo vehicle tiene assigned_driver_id = él.
DROP POLICY IF EXISTS "routes: monitor select tenant" ON public.routes;
DROP POLICY IF EXISTS "routes: driver select own routes" ON public.routes;

CREATE POLICY "routes: monitor select tenant"
  ON public.routes FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    AND public.current_user_role() IN ('admin', 'super_admin', 'operator')
  );

CREATE POLICY "routes: driver select own routes"
  ON public.routes FOR SELECT
  USING (
    public.current_user_role() = 'driver'
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = routes.vehicle_id
        AND v.assigned_driver_id = (SELECT auth.uid())
    )
  );

-- ─── locations: INSERT — solo el conductor dueño del vehículo puede insertar ─
DROP POLICY IF EXISTS "locations: driver insert own vehicle" ON public.locations;

CREATE POLICY "locations: driver insert own vehicle"
  ON public.locations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = locations.vehicle_id
        AND v.assigned_driver_id = (SELECT auth.uid())
        AND v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    )
  );

-- ─── locations: SELECT — monitor ve todo el tenant; driver solo su vehículo ──
DROP POLICY IF EXISTS "locations: monitor select tenant" ON public.locations;
DROP POLICY IF EXISTS "locations: driver select own vehicle" ON public.locations;

CREATE POLICY "locations: monitor select tenant"
  ON public.locations FOR SELECT
  USING (
    public.current_user_role() IN ('admin', 'super_admin', 'operator')
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = locations.vehicle_id
        AND v.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "locations: driver select own vehicle"
  ON public.locations FOR SELECT
  USING (
    public.current_user_role() = 'driver'
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = locations.vehicle_id
        AND v.assigned_driver_id = (SELECT auth.uid())
    )
  );

-- ─── alerts: driver ve solo sus alertas ────────────────────────────────────
DROP POLICY IF EXISTS "alerts: driver sees own alerts" ON public.alerts;

CREATE POLICY "alerts: driver sees own alerts"
  ON public.alerts FOR SELECT
  USING (
    public.current_user_role() = 'driver'
    AND EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = alerts.vehicle_id
        AND v.assigned_driver_id = (SELECT auth.uid())
    )
  );
