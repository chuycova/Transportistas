-- ─────────────────────────────────────────────────────────────────────────────
-- Permite a los conductores crear sus propios viajes desde la app móvil.
-- Necesario porque el viaje se crea en el dispositivo al iniciar una ruta
-- (hotpath: RoutesScreen → handleStartRoute → supabase.from('trips').insert).
--
-- Restricciones:
--   - Solo pueden insertar viajes donde driver_id = su propio auth.uid()
--   - tenant_id debe coincidir con su tenant (via auth_tenant_id())
--
-- Nota: tenant_id obtiene DEFAULT public.auth_tenant_id() via la migración
--       trips_tenant_id_default_and_driver_rls, por lo que el cliente móvil
--       no necesita enviar ese campo.
-- ─────────────────────────────────────────────────────────────────────────────

-- tenant_id se auto-rellena con el tenant del JWT como fallback,
-- pero el cliente móvil lo envía explícitamente desde session.user_metadata.
alter table public.trips
  alter column tenant_id set default public.auth_tenant_id();

drop policy if exists "trips: driver insert own" on public.trips;

-- No se verifica tenant_id en el WITH CHECK porque auth_tenant_id() puede
-- devolver NULL si el JWT del driver es antiguo (anterior a que se seteara
-- user_metadata.tenant_id). La guarda driver_id = auth.uid() es suficiente.
create policy "trips: driver insert own"
  on public.trips for insert
  with check (
    public.auth_role() = 'driver'
    and driver_id = auth.uid()
  );
