-- ─── route_assignments ────────────────────────────────────────────────────────
-- Tracks every assignment of a route to a driver+vehicle pair.
-- Multiple concurrent active assignments per route are allowed (different drivers).

CREATE TABLE public.route_assignments (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES public.tenants(id),
  route_id    uuid        NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  vehicle_id  uuid        NOT NULL REFERENCES public.vehicles(id),
  driver_id   uuid        NOT NULL REFERENCES public.profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid        REFERENCES public.profiles(id),
  is_active   boolean     NOT NULL DEFAULT true,
  notes       text
);

COMMENT ON TABLE public.route_assignments IS
  'Historial de asignaciones de rutas a conductores. Cada fila es una asignación con timestamp y quién la hizo. Múltiples asignaciones activas por ruta son permitidas.';

-- Indexes
CREATE INDEX idx_route_assignments_driver_active
  ON public.route_assignments(driver_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_route_assignments_route
  ON public.route_assignments(route_id, assigned_at DESC);

CREATE INDEX idx_route_assignments_tenant
  ON public.route_assignments(tenant_id);

-- RLS
ALTER TABLE public.route_assignments ENABLE ROW LEVEL SECURITY;

-- SELECT: same tenant
CREATE POLICY route_assignments_select_same_tenant ON public.route_assignments
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- INSERT: admin/operator
CREATE POLICY route_assignments_insert_admin ON public.route_assignments
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_role() = ANY(ARRAY['admin', 'super_admin', 'operator'])
  );

-- UPDATE: admin/operator (to deactivate)
CREATE POLICY route_assignments_update_admin ON public.route_assignments
  FOR UPDATE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = ANY(ARRAY['admin', 'super_admin', 'operator'])
  );

-- DELETE: admin only
CREATE POLICY route_assignments_delete_admin ON public.route_assignments
  FOR DELETE USING (
    tenant_id = auth_tenant_id()
    AND auth_role() = ANY(ARRAY['admin', 'super_admin'])
  );
