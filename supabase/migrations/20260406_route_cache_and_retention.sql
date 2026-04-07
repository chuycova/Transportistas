-- ─── Migration: route_cache + tracking_events retention ─────────────────────
-- Ejecutar en Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Fecha: 2026-04-06

-- ────────────────────────────────────────────────────────────────
-- 1. Tabla route_cache
--    Almacena rutas calculadas por Google Routes API para reutilización.
--    Un cache hit = $0 en vez de $0.005 por request.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.route_cache (
  cache_key        TEXT        PRIMARY KEY,
  polyline_encoded TEXT        NOT NULL,
  distance_m       INTEGER     NOT NULL,
  duration_s       INTEGER     NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para expirar cache viejo eficientemente
CREATE INDEX IF NOT EXISTS idx_route_cache_created
  ON public.route_cache (created_at);

-- Sin RLS en route_cache — son datos geométricos no sensibles
-- (solo polylines de calles, sin identificadores de tenant/usuario)
-- El acceso se controla solo por el service role key del backend.
ALTER TABLE public.route_cache DISABLE ROW LEVEL SECURITY;

-- Expiración automática del cache (rutas > 30 días pueden tener cambios viales)
-- Ejecutar semanalmente (configurar como pg_cron job en Supabase)
-- SELECT cron.schedule('expire_route_cache', '0 3 * * 0',
--   $$DELETE FROM public.route_cache WHERE created_at < NOW() - INTERVAL '30 days'$$);


-- ────────────────────────────────────────────────────────────────
-- 2. Política de retención de tracking_events
--    Sin esto, tracking_events crece indefinidamente.
--    Con 1 ping cada 60s (sampling 1/6) = 4,800 filas/día por tenant.
--    Retención 90 días = máx ~432,000 filas/tenant → dentro de Supabase Free.
-- ────────────────────────────────────────────────────────────────

-- Verificar que la columna recorded_at tiene índice (obligatorio para purge eficiente)
CREATE INDEX IF NOT EXISTS idx_tracking_events_recorded_at
  ON public.tracking_events (recorded_at);

-- Purge manual (ejecutar hasta configurar cron):
-- DELETE FROM public.tracking_events
-- WHERE recorded_at < NOW() - INTERVAL '90 days';

-- Purge automático con pg_cron (habilitar extensión en Supabase Dashboard primero):
-- SELECT cron.schedule('purge_old_tracking', '0 2 * * 1',
--   $$DELETE FROM public.tracking_events WHERE recorded_at < NOW() - INTERVAL '90 days'$$);


-- ────────────────────────────────────────────────────────────────
-- 3. Verificar RLS en tablas sensibles (REVISAR Y ACTIVAR)
-- ────────────────────────────────────────────────────────────────
-- Ejecutar estas queries para verificar el estado actual de RLS:

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('vehicles', 'routes', 'tracking_events', 'alerts', 'tenants', 'profiles')
ORDER BY tablename;

-- Si alguna tabla muestra rls_enabled = false y contiene datos sensibles,
-- activar con: ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;
-- Y crear las políticas apropiadas de tenant isolation.
