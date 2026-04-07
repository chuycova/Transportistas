# 🛠️ Setup Local — ZonaZero

Guía paso a paso para levantar el stack completo en tu máquina.

---

## 📋 Pre-requisitos

### Herramientas requeridas

```bash
# Verificar versiones
node --version    # >=22.14.0
pnpm --version    # >=9.0.0
git --version
```

### Instalación de herramientas

```bash
# Node.js (via nvm recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22

# pnpm
npm install -g pnpm

# Supabase CLI (para desarrollo local con Docker)
brew install supabase/tap/supabase

# Expo CLI (solo si trabajas en mobile)
npm install -g @expo/cli eas-cli
```

### Opcional pero recomendado

```bash
# Biome (linter/formatter — también disponible via pnpm)
brew install biome

# Docker Desktop (requerido por Supabase CLI local)
# Descargar de: https://www.docker.com/products/docker-desktop
```

---

## 🚀 Setup Paso a Paso

### Paso 1 — Clonar el repositorio

```bash
git clone git@github.com:TU_USUARIO/zona-zero.git
cd zona-zero
```

### Paso 2 — Instalar dependencias del monorepo

```bash
pnpm install
```

Esto instala **todas** las dependencias de `apps/` y `packages/` en un solo paso gracias a pnpm workspaces.

### Paso 3 — Configurar variables de entorno

```bash
# Crear archivos .env por app (nunca editar .env.example directamente)
cp .env.example apps/api/.env
cp .env.example apps/web/.env
cp .env.example apps/mobile/.env
```

Editar cada `.env` con los valores reales. Para obtener las credenciales de Supabase:
1. Ir a [app.supabase.com](https://app.supabase.com)
2. Seleccionar el proyecto `oyrbtimpnbvuaoxolqaz`
3. **Settings → API** → copiar URL, anon key y service role key

#### Variables mínimas para desarrollo

**`apps/api/.env`**
```env
SUPABASE_URL=https://oyrbtimpnbvuaoxolqaz.supabase.co
SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
API_PORT=3001
API_JWT_SECRET=<string-random-min-32-chars>
NODE_ENV=development
DEVIATION_THRESHOLD_METERS=50
```

**`apps/web/.env`**
```env
VITE_SUPABASE_URL=https://oyrbtimpnbvuaoxolqaz.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
VITE_GOOGLE_MAPS_API_KEY=<tu-google-maps-api-key>
VITE_API_URL=http://localhost:3001
```

**`apps/mobile/.env`**
```env
EXPO_PUBLIC_SUPABASE_URL=https://oyrbtimpnbvuaoxolqaz.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<tu-google-maps-api-key>
EXPO_PUBLIC_API_URL=http://localhost:3001
```

> ⚠️ Para Firebase (FCM), descarga el `google-services.json` y `GoogleService-Info.plist` desde la consola de Firebase. Están en `.gitignore`.

### Paso 4 — (Opcional) Levantar Supabase localmente

Si prefieres una base de datos local en vez de conectarte al proyecto cloud:

```bash
# Requiere Docker Desktop corriendo
supabase start

# Aplica todas las migraciones
supabase db reset

# URLs locales:
# API Supabase: http://localhost:54321
# Studio:       http://localhost:54323
# DB:           postgresql://postgres:postgres@localhost:54322/postgres
```

Para usar el Supabase local, cambia en tus `.env`:
```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon-key-del-output-de-supabase-start>
```

### Paso 5 — Levantar el stack de desarrollo

#### Opción A: Todo a la vez (recomendado)

```bash
pnpm dev
```

Turborepo levanta `api` y `web` en paralelo con sus dependencias correctas.

#### Opción B: Por separado

```bash
# Terminal 1 — Backend
pnpm --filter api dev
# Disponible en: http://localhost:3001

# Terminal 2 — Web Dashboard
pnpm --filter web dev
# Disponible en: http://localhost:5173
```

#### App Mobile (Expo)

```bash
# Terminal 3 — Mobile
pnpm --filter mobile start

# Luego elegir:
# i → Simulador iOS (requiere Xcode)
# a → Emulador Android (requiere Android Studio)
# s → Expo Go (limitado — no soporta módulos nativos)
```

Para usar el dev client (recomendado):
```bash
# Build del dev client (solo primera vez o al cambiar módulos nativos)
eas build --profile development --platform ios
# Instalar en el simulador y luego:
pnpm --filter mobile start
```

---

## ✅ Verificar que todo funciona

```bash
# Tipo-check todo el monorepo
pnpm type-check

# Lint
pnpm check

# Tests unitarios
pnpm test
```

### Verificación manual

1. **API**: Abrir `http://localhost:3001/health` — debe responder `{ "status": "ok" }`
2. **Web**: Abrir `http://localhost:5173` — debe mostrar la pantalla de login
3. **Supabase Studio** (si local): `http://localhost:54323` — explorar tablas

---

## 🗄️ Base de datos

### Crear una nueva migración

```bash
# Crear archivo de migración
supabase migration new nombre_descriptivo

# Editar el archivo generado en supabase/migrations/
# Aplicar:
supabase db reset   # local
# o
supabase db push    # producción (cuidado)
```

### Seed de datos de desarrollo

```bash
supabase db reset   # aplica migraciones + seed.sql automáticamente
```

El archivo `supabase/seed.sql` crea datos de prueba: 2 tenants, 3 vehículos, 2 rutas de ejemplo.

---

## 🐛 Troubleshooting

### `pnpm install` falla con errores de peer dependencies

```bash
# Forzar resolución
pnpm install --no-frozen-lockfile
```

### Puerto 3001 o 5173 ya en uso

```bash
# Encontrar y matar el proceso
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Supabase CLI: Docker no responde

```bash
supabase stop
supabase start
```

### Error de TypeScript en `packages/domain`

```bash
# Rebuild del paquete
pnpm --filter domain build
```

### Mobile: Metro bundler no encuentra módulo

```bash
# Limpiar caché
pnpm --filter mobile start -- --clear
```

---

## 📁 Scripts útiles del monorepo

```bash
pnpm dev          # Levantar todo en modo desarrollo
pnpm build        # Build de producción de todos los paquetes
pnpm test         # Correr todos los tests
pnpm lint         # Solo lint (Biome)
pnpm format       # Format automático
pnpm check        # Lint + format + fix automático
pnpm type-check   # TypeScript check sin build
pnpm clean        # Eliminar dist/ y node_modules
```
