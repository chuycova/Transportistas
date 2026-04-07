---
description: Levantar el stack completo de ZonaZero en modo desarrollo
---

# Levantar Stack Completo

Opciones ordenadas de menor a mayor complejidad.

## Opción A — Solo API + Web (lo más común)

// turbo
```bash
pnpm dev
```
→ Turborepo levanta `api` y `web` en paralelo.
→ API: http://localhost:3001
→ Web: http://localhost:5173

## Opción B — Con Supabase local (aislamiento total)

1. Asegurarse de que Docker Desktop esté corriendo.

// turbo
2. Levantar Supabase:
```bash
supabase start
```
→ Tomar nota del `anon key` y `service_role key` del output.
→ Actualizar `apps/api/.env` y `apps/web/.env` con las keys locales.

// turbo
3. Levantar el resto:
```bash
pnpm dev
```

## Opción C — Servicios individuales en terminales separadas

Terminal 1 — Backend API:
```bash
pnpm --filter api dev
```

Terminal 2 — Web Dashboard:
```bash
pnpm --filter web dev
```

Terminal 3 — App Mobile:
```bash
pnpm --filter mobile start
```

## Verificación rápida

```bash
# Health del backend
curl http://localhost:3001/health

# Debería responder:
# {"status":"ok","timestamp":"...","version":"1.0.0"}
```

## Puertos por servicio

| Servicio | Puerto |
|---|---|
| API NestJS | `3001` |
| Web Vite | `5173` |
| Supabase API (local) | `54321` |
| Supabase Studio (local) | `54323` |
| PostgreSQL (local) | `54322` |
| Metro (Expo) | `8081` |

## Liberar puertos si están ocupados

```bash
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```
