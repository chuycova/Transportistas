# Code Quality — Analisis de Redundancia

> Ultima actualizacion: 2026-04-07
> Scope: `apps/api/src/`

El codebase esta arquitectonicamente correcto (hexagonal, domain separado, ports & adapters).
Las redundancias son de implementacion, no de diseno.

---

## Problemas identificados

### ~~1. `adminClient` duplicado~~ — RESUELTO

~~**Afectaba:** `modules/drivers/drivers.controller.ts`, `modules/driver/driver-assignment.controller.ts`,
`modules/routing/routing.controller.ts` (inline dentro del metodo `assignDriver`)~~

**Implementacion:** `src/infrastructure/supabase-admin.provider.ts`

Se creo un provider de NestJS con token simbolico `SUPABASE_ADMIN_CLIENT`.
El cliente se construye una sola vez via `useFactory` (singleton administrado por NestJS)
y se registra con `@Global()` en `AppModule` — disponible en todos los modulos sin que
cada uno lo importe explicitamente.

```typescript
// src/infrastructure/supabase-admin.provider.ts
export const SUPABASE_ADMIN_CLIENT = Symbol('SUPABASE_ADMIN_CLIENT');

export const supabaseAdminProvider = {
  provide: SUPABASE_ADMIN_CLIENT,
  useFactory: (): SupabaseAdminClient => createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  }),
};
```

**Decision de diseno — por que `infrastructure/` y no `common/`:**
En Screaming Architecture los modulos de dominio (`drivers/`, `routing/`) deben
comunicar su responsabilidad de negocio, no su dependencia tecnica. Colocar el
provider en `src/infrastructure/` separa claramente la capa de adaptadores de
infraestructura compartida. `@Global()` en `AppModule` evita que cada feature module
deba importar un `InfrastructureModule` contaminando su declaracion.

**Archivos modificados:**
- `src/infrastructure/supabase-admin.provider.ts` — nuevo
- `src/app.module.ts` — `@Global()` + registra y exporta `supabaseAdminProvider`
- `modules/drivers/drivers.controller.ts` — `@Inject(SUPABASE_ADMIN_CLIENT)` en constructor
- `modules/driver/driver-assignment.controller.ts` — `@Inject(SUPABASE_ADMIN_CLIENT)` en constructor
- `modules/routing/routing.controller.ts` — `@Inject(SUPABASE_ADMIN_CLIENT)` en constructor

---

### ~~2. `mapRow` local en cada repository~~ — RESUELTO
### ~~3. Manejo de error `PGRST116` inconsistente~~ — RESUELTO

~~Todos los repositories definian una `function mapRow(row: Record<string, unknown>)` local
con campos repetidos, y el chequeo `PGRST116` con dos estilos distintos.~~

**Implementacion:** `src/infrastructure/supabase.helpers.ts`

Dos helpers exportados que reemplazaron el codigo duplicado en los 4 repositories:

```typescript
// src/infrastructure/supabase.helpers.ts

// Extrae campos de auditoria comunes (tenantId, createdAt).
// id queda fuera — en locations es number, en el resto es string.
export function mapBaseFields(row: Record<string, unknown>) {
  return {
    tenantId: row['tenant_id'] as string,
    createdAt: new Date(row['created_at'] as string),
  };
}

// Estandariza el chequeo de fila no encontrada en Supabase.
export function isNotFound(error: { code: string } | null | undefined): boolean {
  return error?.code === 'PGRST116';
}
```

**Uso en cada repository:**

```typescript
// Antes — en cada archivo
tenantId: row['tenant_id'] as string,
createdAt: new Date(row['created_at'] as string),
if (error?.code === 'PGRST116') return null;      // o: error && error.code === ...

// Despues
...mapBaseFields(row),
if (isNotFound(error)) return null;
```

**Decision de diseno — por que `id` no esta en `mapBaseFields`:**
`Location.id` es `number` (clave primaria serial de la tabla de timeseries),
mientras que el resto usan `string` (UUID). Incluir `id` en la funcion base
requeriria generics o un union type que oscurecen el codigo sin ganancia real.
Cada repository castea `id` segun su tipo de dominio.

**Archivos modificados:**
- `src/infrastructure/supabase.helpers.ts` — nuevo
- `modules/routing/infrastructure/supabase-route.repository.ts`
- `modules/vehicles/infrastructure/supabase-vehicle.repository.ts`
- `modules/alerts/infrastructure/supabase-alert.repository.ts`
- `modules/tracking/infrastructure/supabase-location.repository.ts`

---

### 4. Naming `driver/` vs `drivers/` — Prioridad baja

| Modulo | Ruta | Proposito |
|--------|------|-----------|
| `DriversModule` | `modules/drivers/` | Monitor gestiona conductores (listar, invitar) |
| `DriverModule` | `modules/driver/` | Conductor consulta su propia asignacion |

El mismo sustantivo con distinto numero para conceptos distintos genera confusion
al navegar el repo. Un nuevo colaborador no sabe cual es cual sin abrir los archivos.

**Fix propuesto — renombrar:**
- `modules/drivers/` → `modules/fleet/` (gestion de flota desde el monitor)
- `modules/driver/` → `modules/driver-portal/` (perspectiva del conductor)

---

### 5. `throw new Error` sin tipo HTTP — Prioridad baja

En varios controllers se lanza `Error` generico ante fallos de Supabase:

```typescript
if (error) throw new Error(error.message); // → siempre HTTP 500
```

Si el error es del cliente (ej. email ya registrado, validacion de Supabase),
NestJS devuelve 500 en lugar del codigo correcto (400, 409, etc.).

**Fix:** Mapear codigos de error de Supabase a excepciones de NestJS
(`BadRequestException`, `ConflictException`, `InternalServerErrorException`).

---

## Lo que esta bien — no tocar

| Patron | Motivo |
|--------|--------|
| Repositorios separados por modulo | Correcto per arquitectura hexagonal |
| `detectDeviation` en `packages/domain` | Logica pura aislada, sin infraestructura |
| `ProcessLocationUseCase` en `tracking/application/` | Orquestacion correcta, distinta del dominio |
| Tokens de DI en `common/tokens.ts` centralizados | Bien factorizado, unico punto de verdad |
| `packages/domain` con ports como interfaces | Inversion de dependencias correcta |

---

## Resumen de acciones

| # | Accion | Archivos | Estado |
|---|--------|----------|--------|
| 1 | Provider `SUPABASE_ADMIN_CLIENT` global, reemplazar 3 `createClient` inline | 5 | **Resuelto** |
| 2+3 | Helpers `mapBaseFields` + `isNotFound` en `infrastructure/supabase.helpers.ts` | 5 | **Resuelto** |
| 4 | Renombrar modulos `driver/` → `driver-portal/` y `drivers/` → `fleet/` | 2 + app.module | Pendiente |
| 5 | Mapear errores Supabase a excepciones NestJS tipadas | 3 controllers | Pendiente |
