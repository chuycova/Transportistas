# 🤝 Guía de Contribución — ZonaZero

## 📋 Tabla de Contenidos

- [Convenciones de Branches](#convenciones-de-branches)
- [Conventional Commits](#conventional-commits)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Pull Requests](#pull-requests)
- [Estándares de Código](#estándares-de-código)
- [Tests](#tests)

---

## 🌿 Convenciones de Branches

```
<tipo>/<descripción-corta-en-kebab-case>
```

| Tipo | Cuándo usarlo | Ejemplo |
|---|---|---|
| `feature/` | Nueva funcionalidad | `feature/vehicle-deviation-alert` |
| `fix/` | Corrección de bug | `fix/socket-reconnection-loop` |
| `chore/` | Configs, deps, refactor menor | `chore/update-expo-sdk-55` |
| `docs/` | Solo documentación | `docs/add-api-reference` |
| `hotfix/` | Arreglo urgente en producción | `hotfix/rls-policy-bypass` |
| `test/` | Solo tests | `test/tracking-use-case-unit` |

**Reglas:**
- Siempre derivar de `main` (excepto `hotfix/` que puede derivar de una tag)
- Nombre en minúsculas, sin espacios, máximo 50 caracteres
- Un branch = un propósito

---

## 📝 Conventional Commits

Sigue el estándar [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>[scope opcional]: <descripción en imperativo>

[cuerpo opcional]

[footer opcional: BREAKING CHANGE, closes #issue]
```

### Tipos permitidos

| Tipo | Descripción |
|---|---|
| `feat` | Nueva funcionalidad (incrementa MINOR en semver) |
| `fix` | Corrección de bug (incrementa PATCH) |
| `docs` | Solo documentación |
| `style` | Formato, punto y coma, sin cambio de lógica |
| `refactor` | Refactor que no es feat ni fix |
| `test` | Agregar o corregir tests |
| `chore` | Cambios de tooling, deps, config |
| `perf` | Mejora de performance |
| `ci` | Cambios en CI/CD |
| `revert` | Revierte un commit anterior |

### Scopes por app/paquete

`api` · `web` · `mobile` · `domain` · `infra` · `ui` · `supabase` · `ci`

### Ejemplos

```bash
# Feature
feat(api): add deviation detection via ST_DWithin PostGIS

# Fix con scope
fix(mobile): resolve WatermelonDB sync on reconnect

# Breaking change
feat(api)!: change tracking WebSocket event schema

BREAKING CHANGE: `vehicle:ping` payload now requires `routeId`

# Closes issue
fix(web): correct marker position after route update

Closes #42
```

---

## 🔄 Flujo de Trabajo

```bash
# 1. Asegúrate de estar en main actualizado
git checkout main
git pull origin main

# 2. Crea tu branch
git checkout -b feature/mi-nueva-feature

# 3. Trabaja, haz commits pequeños y frecuentes
git add -p   # Siempre revisar qué se agrega
git commit -m "feat(api): add route assignment endpoint"

# 4. Mantén el branch actualizado con main
git fetch origin
git rebase origin/main

# 5. Push y abre PR
git push origin feature/mi-nueva-feature
```

---

## 🔀 Pull Requests

### Antes de abrir un PR

- [ ] El código compila sin errores: `pnpm type-check`
- [ ] Lint pasa: `pnpm check`
- [ ] Tests pasan: `pnpm test`
- [ ] No hay archivos `.env` en el diff
- [ ] Se actualizó documentación relevante si aplica

### Título del PR

Mismo formato que Conventional Commits:

```
feat(web): add real-time vehicle markers to tracking map
```

### Descripción del PR

```markdown
## ¿Qué hace este PR?
Breve descripción del cambio.

## ¿Por qué?
Contexto y motivación.

## Cambios principales
- Archivo A: ...
- Archivo B: ...

## Testing
Cómo probar manualmente o qué tests se agregaron.

## Screenshots (si aplica)
```

### Revisión

- Mínimo **1 aprobación** para mergear a `main`
- Resolver todos los comentarios antes de mergear
- Usar **Squash & Merge** para mantener el historial limpio

---

## 🧹 Estándares de Código

### Formatter y Linter

Usamos [Biome](https://biomejs.dev/) para formato y lint en todo el monorepo:

```bash
# Revisar y auto-corregir
pnpm check

# Solo lint
pnpm lint

# Solo format
pnpm format
```

> Biome se ejecuta como pre-commit hook. Si falla, el commit se bloquea.

### TypeScript

- **Strict mode** activado — no usar `any` salvo casos muy justificados con comentario
- Preferir `type` sobre `interface` en domain/value-objects
- Los casos de uso en `packages/domain` no deben importar nada de `apps/`

### Arquitectura Hexagonal (en `apps/api`)

```
domain/         ← Solo TypeScript puro, sin imports de frameworks
application/    ← Use cases, solo depende de domain/
infrastructure/ ← NestJS, Supabase, Socket.io
```

No importar desde infrastructure hacia domain. La dependencia fluye hacia adentro.

---

## 🧪 Tests

### Correr tests

```bash
# Todos
pnpm test

# Solo un paquete
pnpm --filter api test
pnpm --filter domain test
```

### Convenciones

- Tests unitarios en `*.spec.ts` junto al archivo que prueban
- Tests de integración en `src/__tests__/`
- Nombrar los tests en español o inglés, ser descriptivos:
  ```ts
  it('should emit deviation alert when vehicle is 60m off route', () => {})
  ```

---

## 🚨 Seguridad

- **Nunca** commitear archivos `.env`, `.p12`, `.plist` con secretos
- Si accidentalmente commiteaste un secreto: rotar la credencial inmediatamente y notificar
- Ante dudas, revisar [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)
