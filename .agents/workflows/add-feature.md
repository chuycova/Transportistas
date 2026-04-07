---
description: Convención para agregar un nuevo dominio o feature al monorepo (módulo API + feature Web + screen Mobile)
---

# Agregar Nueva Feature

Seguir esta convención para mantener la consistencia de la arquitectura Hexagonal + Screaming en todo el monorepo.

Ejemplo: agregar el dominio `fuel` (gestión de combustible).

---

## Paso 1 — Dominio puro (`packages/domain`)

Crear las entidades y value-objects sin dependencias de frameworks:

```
packages/domain/src/
├── entities/
│   └── fuel-log.entity.ts       ← nueva entidad
├── value-objects/
│   └── fuel-amount.value-object.ts
├── ports/
│   └── fuel-log.repository.port.ts   ← interface del repositorio
└── use-cases/
    └── register-fuel-log.use-case.ts
```

**Regla:** ningún import de NestJS, React, Expo, Supabase en este directorio.

---

## Paso 2 — Migración de base de datos

```bash
supabase migration new add_fuel_logs_table
```

Editar la migración con la nueva tabla, RLS y los índices necesarios.
Ver workflow `add-migration.md` para la plantilla completa.

---

## Paso 3 — Módulo en el Backend (`apps/api`)

Crear la estructura del módulo siguiendo la arquitectura hexagonal:

```
apps/api/src/modules/fuel/
├── domain/
│   ├── entities/          ← puede re-exportar de packages/domain
│   └── ports/             ← re-exporta IFuelLogRepository
├── application/
│   └── use-cases/
│       └── register-fuel-log.use-case.ts
├── infrastructure/
│   ├── repositories/
│   │   └── supabase-fuel-log.repository.ts   ← implementa el port
│   └── controllers/
│       └── fuel.controller.ts
└── fuel.module.ts
```

Registrar el módulo en `apps/api/src/app.module.ts`:
```typescript
@Module({
  imports: [
    // ... módulos existentes
    FuelModule,
  ],
})
export class AppModule {}
```

---

## Paso 4 — Feature en el Web Dashboard (`apps/web`)

```
apps/web/src/features/fuel/
├── components/
│   ├── FuelLogTable.tsx
│   └── FuelLogForm.tsx
├── hooks/
│   ├── useFuelLogs.ts         ← TanStack Query
│   └── useRegisterFuel.ts
└── pages/
    └── FuelPage.tsx
```

Agregar la ruta en `apps/web/src/router/`:
```typescript
{ path: '/fuel', element: <FuelPage /> }
```

Agregar link en el Sidebar de `apps/web/src/components/layout/`.

---

## Paso 5 — Screen en Mobile (`apps/mobile`) — solo si aplica

```
apps/mobile/src/features/fuel/
├── components/
│   └── FuelFormSheet.tsx
└── screens/
    └── FuelScreen.tsx
```

Agregar la screen al stack de navegación correspondiente en `apps/mobile/src/navigation/`.

---

## Paso 6 — Documentar en `docs/API.md`

Agregar la sección con los nuevos endpoints REST y/o eventos Socket.io. Ver formato en [docs/API.md](../../docs/API.md).

---

## Paso 7 — Tests

Crear tests unitarios para los use-cases del dominio:

```
packages/domain/src/use-cases/
└── register-fuel-log.use-case.spec.ts
```

```bash
pnpm test
pnpm type-check
```

---

## Checklist

- [ ] Entidad creada en `packages/domain`
- [ ] Port (interface de repositorio) definido en `packages/domain/ports/`
- [ ] Migración SQL creada y probada con `supabase db reset`
- [ ] RLS habilitado en nueva(s) tabla(s)
- [ ] Módulo NestJS con domain/application/infrastructure separados
- [ ] Módulo registrado en `app.module.ts`
- [ ] Feature web con componentes, hooks y página
- [ ] Ruta web agregada al router y al sidebar
- [ ] Screen mobile (si aplica)
- [ ] Endpoint documentado en `docs/API.md`
- [ ] Tests unitarios del use-case
- [ ] `pnpm type-check` pasa sin errores
- [ ] Branch sigue convención: `feature/<nombre-del-dominio>`
- [ ] Commit sigue Conventional Commits: `feat(<scope>): ...`
