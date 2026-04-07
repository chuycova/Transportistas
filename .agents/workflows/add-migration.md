---
description: Crear y aplicar una migración de base de datos en Supabase
---

# Agregar Migración de Supabase

Usar este workflow cada vez que se modifique el schema de la base de datos (nueva tabla, columna, índice, política RLS, etc.).

## Pasos

1. Asegurarse de que Supabase local esté corriendo:
```bash
supabase status
```
Si no está activo:
```bash
supabase start
```

// turbo
2. Crear el archivo de migración con nombre descriptivo (snake_case):
```bash
supabase migration new <nombre_descriptivo>
# Ejemplos:
# supabase migration new add_driver_sessions_table
# supabase migration new add_rls_policy_routes
# supabase migration new add_spatial_index_locations
```
→ Se crea en `supabase/migrations/<timestamp>_<nombre>.sql`

3. Editar el archivo SQL generado con los cambios deseados.

Plantillas de referencia:

**Nueva tabla:**
```sql
CREATE TABLE IF NOT EXISTS public.mi_tabla (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS obligatorio en todas las tablas
ALTER TABLE public.mi_tabla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.mi_tabla
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

**Nueva columna:**
```sql
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS last_ping_at timestamptz;
```

**Índice espacial (PostGIS):**
```sql
CREATE INDEX IF NOT EXISTS idx_locations_geom
  ON public.locations USING GIST (geom);
```

4. Aplicar la migración en local:
```bash
supabase db reset
```
→ Aplica TODAS las migraciones + seed.sql desde cero.

Si solo quieres aplicar la nueva sin resetear:
```bash
supabase migration up
```

5. Verificar en Supabase Studio local que el schema es correcto:
→ http://localhost:54323

6. Aplicar en producción (hacer solo cuando el PR esté mergeado en main):
```bash
supabase db push
```
→ Requiere estar autenticado: `supabase login`
→ ⚠️ Revisar el diff antes de confirmar.

## Convenciones de Nombres

| Tipo | Prefijo | Ejemplo |
|---|---|---|
| Nueva tabla | `add_` | `add_driver_sessions_table` |
| Nueva columna | `add_column_` | `add_column_vehicles_last_ping` |
| Eliminar | `drop_` | `drop_column_old_status` |
| Índice | `add_index_` | `add_index_locations_geom` |
| RLS Policy | `add_rls_` | `add_rls_policy_alerts` |
| Datos/seed | `seed_` | `seed_default_tenants` |

## Checklist

- [ ] Nombre de migración es descriptivo
- [ ] RLS habilitado si se crea nueva tabla
- [ ] Índices creados para columnas de búsqueda frecuente
- [ ] `IF NOT EXISTS` / `IF EXISTS` para idempotencia
- [ ] Probado con `supabase db reset` en local
- [ ] Schema verificado en Studio (http://localhost:54323)
