---
description: Setup completo del entorno de desarrollo local desde cero
---

# Setup Local — ZonaZero

Ejecutar en orden. Cada paso depende del anterior.

## Pre-requisitos

1. Verificar versiones mínimas:

```bash
node --version   # debe ser >=22.14.0
pnpm --version   # debe ser >=9.0.0
```

Si Node no cumple la versión:
```bash
nvm install 22 && nvm use 22
```

2. Instalar Supabase CLI (requiere Docker Desktop corriendo):
```bash
brew install supabase/tap/supabase
```

## Pasos

// turbo-all
1. Instalar dependencias del monorepo:
```bash
pnpm install
```

2. Crear archivos de entorno por app:
```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env
cp .env.example apps/mobile/.env
```
→ Editar cada `.env` con las credenciales reales de Supabase y Google Maps.
→ Credenciales en: https://app.supabase.com → Settings → API

3. (Opcional) Levantar Supabase local con Docker:
```bash
supabase start
supabase db reset
```
→ Si se usa Supabase local, actualizar `SUPABASE_URL` y `SUPABASE_ANON_KEY` en los `.env` con los valores del output.

4. Levantar el stack completo:
```bash
pnpm dev
```
→ API disponible en: http://localhost:3001
→ Web disponible en: http://localhost:5173

5. Verificar que todo funciona:
```bash
pnpm type-check
pnpm check
pnpm test
```
→ Abrir http://localhost:3001/health — debe responder `{ "status": "ok" }`
→ Abrir http://localhost:5173 — debe mostrar la pantalla de login

## Mobile (opcional)

6. Levantar el dev server de Expo:
```bash
pnpm --filter mobile start
```
→ Presionar `i` para simulador iOS o `a` para Android.
→ Para módulos nativos usar EAS dev client (ver workflow `eas-build.md`).
