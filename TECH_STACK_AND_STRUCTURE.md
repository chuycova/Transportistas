# 🏗️ Stack Tecnológico, Estructura de Directorios y Orden de Arranque

> **Contexto:** Monorepo con Screaming Architecture + Hexagonal (Monolito Modular). Compartir al máximo la lógica de dominio entre Web y Móvil (TypeScript puro en `packages/`).

---

## 📦 Stack Tecnológico (Versiones Fijadas)

### 🔧 Base del Monorepo
| Herramienta          | Versión    | Rol                                              |
|----------------------|------------|--------------------------------------------------|
| **Turborepo**        | `^2.9.1`   | Orquestador del monorepo, caché de builds        |
| **TypeScript**       | `^6.0.0`   | Lenguaje base de todo el proyecto                |
| **Node.js**          | `>=22.x`   | Runtime del backend y tooling                    |
| **pnpm**             | `^9.x`     | Gestor de paquetes (workspaces nativos)          |

### 🖥️ Frontend Web (`apps/web`)
| Herramienta               | Versión    | Rol                                              |
|---------------------------|------------|--------------------------------------------------|
| **React**                 | `^19.2`    | UI Framework                                     |
| **Vite**                  | `^8.0.3`   | Bundler y dev server                             |
| **shadcn/ui**             | CLI `^4.1` | Componentes UI (Radix UI + Tailwind)             |
| **Tailwind CSS**          | `^4.0`     | Utility-first CSS (requerido por shadcn)         |
| **React Router**          | `^7.x`     | Enrutamiento SPA                                 |
| **TanStack Query**        | `^5.x`     | Estado asíncrono / cache de datos HTTP           |
| **Zustand**               | `^5.x`     | Estado global liviano (ej: vehículos en mapa)    |
| **Socket.io-client**      | `^4.8.3`   | Canal WebSocket hacia backend                    |
| **Google Maps JS API**    | `latest`   | Mapa principal, visualización de rutas           |
| **@react-google-maps/api**| `^2.x`     | Wrapper React de Google Maps                     |

### ⚙️ Backend (`apps/api`)
| Herramienta               | Versión    | Rol                                              |
|---------------------------|------------|--------------------------------------------------|
| **NestJS**                | `^11.1`    | Framework HTTP + Modular                         |
| **Socket.io**             | `^4.8.3`   | Servidor WebSocket para tiempo real              |
| **@supabase/supabase-js** | `^2.101`   | Cliente para Supabase (PostGIS / Auth / RLS)     |
| **Zod**                   | `^3.x`     | Validación de esquemas en entradas               |
| **Passport.js**           | `^0.7.x`   | Estrategias de autenticación (JWT via Supabase)  |
| **Firebase Admin SDK**    | `^12.x`    | Envío de Push Notifications (FCM)                |
| **Vitest**                | `^3.x`     | Tests unitarios (default en NestJS 11)           |

### 📱 Móvil (`apps/mobile`)
| Herramienta                           | Versión    | Rol                                              |
|---------------------------------------|------------|--------------------------------------------------|
| **Expo SDK**                          | `~55.0`    | Base del proyecto React Native                   |
| **expo-dev-client**                   | `~5.x`     | Dev client para módulos nativos (en vez de Expo Go) |
| **React Native**                      | `0.79.x`   | Framework móvil                                  |
| **React**                             | `^19.0`    | Compartido con Web                               |
| **react-native-mmkv**                 | `^3.x`     | ⚡ KV storage: sesión JWT, vehicleId, routeId    |
| **@nozbe/watermelondb**               | `^0.27.x`  | 🗄️ DB offline: cola GPS + historial alertas       |
| **expo-location**                     | `~55.x`    | GPS foreground + background geolocation          |
| **expo-task-manager**                 | `~12.x`    | Daemon en segundo plano para tracking            |
| **expo-notifications**                | `~0.30.x`  | Recepción de Push Notifications (FCM)            |
| **expo-sqlite**                       | `~15.x`    | Usado internamente por WatermelonDB              |
| **@react-navigation/native**          | `^7.x`     | Navegación entre pantallas                       |
| **react-native-maps**                 | `^1.x`     | Visualización de posición en móvil (Google Maps) |
| **Socket.io-client**                  | `^4.8.3`   | Mismo canal que la Web — emite pings GPS         |

### 🗄️ Base de Datos e Infraestructura
| Servicio                  | Versión / Tier  | Rol                                              |
|---------------------------|-----------------|--------------------------------------------------|
| **Supabase**              | `Free → Pro`    | PostgreSQL + PostGIS + Auth + RLS + Storage      |
| **PostGIS**               | `^3.4`          | Extensión geoespacial (ST_Distance, ST_DWithin)  |
| **Firebase (FCM)**        | `Free`          | Push Notifications a iOS y Android               |
| **Railway / Render**      | `Hobby → Pro`   | Hosting del backend NestJS                       |
| **Vercel**                | `Hobby → Pro`   | Hosting de la Web (Vite + React)                 |

---

## 📁 Estructura de Directorios del Monorepo

```
zona-zero/                          ← Raíz del monorepo (Turborepo)
│
├── apps/
│   ├── web/                        ← Dashboard Web de Monitoreo
│   │   ├── public/
│   │   └── src/
│   │       ├── features/           ← Screaming Architecture por dominio
│   │       │   ├── tracking/       ← Mapa en tiempo real, marcadores
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   └── pages/
│   │       │   ├── routes/         ← Crear, editar, ver rutas
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   └── pages/
│   │       │   ├── vehicles/       ← CRUD de vehículos, estado
│   │       │   │   ├── components/
│   │       │   │   └── pages/
│   │       │   ├── alerts/         ← Historial de desvíos, notificaciones
│   │       │   │   ├── components/
│   │       │   │   └── pages/
│   │       │   └── auth/           ← Login, gestión de sesión
│   │       │       ├── components/
│   │       │       └── pages/
│   │       ├── components/         ← Componentes globales de la app web
│   │       │   └── layout/         ← Sidebar, Header, Shell
│   │       ├── lib/                ← Config de TanStack Query, Socket.io
│   │       ├── router/             ← Rutas React Router
│   │       └── main.tsx
│   │
│   ├── api/                        ← Backend NestJS (Monolito Modular Hexagonal)
│   │   └── src/
│   │       ├── modules/            ← Un módulo por dominio (Screaming)
│   │       │   ├── tracking/
│   │       │   │   ├── domain/              ← Entidades, Puertos (Interfaces)
│   │       │   │   │   ├── entities/
│   │       │   │   │   └── ports/
│   │       │   │   ├── application/         ← Casos de Uso (UseCase classes)
│   │       │   │   ├── infrastructure/      ← Adaptadores: Supabase, Socket.io
│   │       │   │   │   ├── repositories/
│   │       │   │   │   └── gateways/
│   │       │   │   └── tracking.module.ts
│   │       │   ├── routing/
│   │       │   │   ├── domain/
│   │       │   │   ├── application/
│   │       │   │   ├── infrastructure/
│   │       │   │   └── routing.module.ts
│   │       │   ├── vehicles/
│   │       │   │   ├── domain/
│   │       │   │   ├── application/
│   │       │   │   ├── infrastructure/
│   │       │   │   └── vehicles.module.ts
│   │       │   ├── alerts/
│   │       │   │   ├── domain/
│   │       │   │   ├── application/
│   │       │   │   ├── infrastructure/
│   │       │   │   └── alerts.module.ts
│   │       │   └── auth/
│   │       │       ├── domain/
│   │       │       ├── application/
│   │       │       ├── infrastructure/
│   │       │       └── auth.module.ts
│   │       └── app.module.ts
│   │
│   └── mobile/                     ← App React Native (Expo SDK 55)
│       └── src/
│           ├── features/           ← Misma convención Screaming que Web
│           │   ├── tracking/
│           │   │   ├── components/
│           │   │   └── screens/
│           │   ├── routes/
│           │   │   ├── components/
│           │   │   └── screens/
│           │   └── auth/
│           │       └── screens/
│           ├── navigation/         ← React Navigation stacks
│           ├── lib/                ← Config Expo, SQLite, Socket.io
│           └── App.tsx
│
├── packages/                       ← Código compartido entre apps
│   ├── domain/                     ← ⭐ NÚCLEO: Lógica pura sin dependencias
│   │   ├── src/
│   │   │   ├── entities/           ← Vehicle, Route, Location, Alert, Tenant
│   │   │   ├── value-objects/      ← Coordinate, Deviation, RouteStatus
│   │   │   ├── ports/              ← IVehicleRepository, IRouteRepository (interfaces)
│   │   │   └── use-cases/          ← calculateDeviation(), estimateArrival()
│   │   └── package.json
│   │
│   ├── infrastructure/             ← Implementaciones concretas reutilizables
│   │   ├── src/
│   │   │   ├── supabase/           ← Cliente Supabase singleton
│   │   │   └── http/               ← fetch wrapper, manejo de errores
│   │   └── package.json
│   │
│   └── ui/                         ← Primitivos de UI compartibles
│       ├── src/
│       │   ├── tokens/             ← Colores, tipografía, spacing (Design Tokens)
│       │   └── components/         ← Solo componentes 100% neutrales (ej: Spinner)
│       └── package.json
│
├── supabase/                       ← Configuración y migraciones de la DB
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_postgis_extension.sql
│   │   ├── 003_rls_policies.sql
│   │   └── 004_spatial_indexes.sql
│   └── seed.sql                    ← Datos de prueba para desarrollo
│
├── .github/
│   └── workflows/                  ← CI/CD (lint, test, deploy)
│
├── turbo.json                      ← Config Turborepo
├── pnpm-workspace.yaml             ← Declaración de workspaces
├── package.json
└── tsconfig.base.json              ← Config TypeScript base compartida
```

---

## 🚦 Orden de Arranque Recomendado

Coincido completamente con tu propuesta. El orden lógico es:

### ✅ Fase A  —  Base de Datos + Dominio Puro (Semana 1)
> *La razón: sin el schema definido no puedo construir nada. Sin las entidades del dominio no tienen forma de compartirse.*

1. Configurar Supabase (activar PostGIS, crear proyecto).
2. Escribir las migraciones SQL (`supabase/migrations/`).
3. Crear las entidades y puertos en `packages/domain` (solo TypeScript, sin frameworks).
4. Verificar RLS básico con tenant de prueba.

### ✅ Fase B  —  Backend API (`apps/api`) (Semanas 2-3)
> *Empezamos por el backend porque la Web depende de él. El backend local (localhost) ya es suficiente; Supabase está en la nube.*

1. Inicializar NestJS 11 con soporte ESM y SWC.
2. Crear los módulos: `auth`, `vehicles`, `routing`, `tracking`, `alerts`.
3. Implementar la lógica de desvíos usando `ST_DWithin` de PostGIS.
4. Levantar el servidor WebSocket (Socket.io) para difundir posiciones.
5. Conectar Firebase Admin para enviar Push Notifications de alerta.

### ✅ Fase C  —  Web Dashboard (`apps/web`) (Semanas 3-4)
> *Ya tienes el backend corriendo localmente. El frontend simplemente consume los endpoints.*

1. Inicializar Vite + React 19 + shadcn/ui + Tailwind 4.
2. Construcción feature por feature:
   - **Login / Auth** (Supabase Auth + JWT)
   - **Vehículos** (CRUD básico)
   - **Creación de Ruta** (dibujar en Google Maps, guardar Polyline)
   - **Mapa en Tiempo Real** (Socket.io → markers animados)
   - **Historial y Alertas** (filtros, replay de ruta)

### ✅ Fase D  —  Multitenencia Estricta (Semana 5)
> *Una vez que fluye la lógica principal, instalamos el "sistema inmune" del SaaS.*

1. Revisar y fortalecer las RLS Policies en Supabase.
2. Implementar la selección de `tenant` en el JWT de Supabase Auth.
3. Pruebas de aislamiento: 2 tenants distintos, verificar que no se filtran datos.
4. Crear un panel de administración mínimo para crear y gestionar tenants.

### ✅ Fase E  —  App Móvil (`apps/mobile`) (Semanas 6-7)
> *El móvil es el "cliente más sencillo": solo envía GPS y recibe notificaciones. Con el backend robusto esta fase se reduce a semanas.*

1. Scaffold de Expo SDK 55 en el monorepo (`apps/mobile/`).
2. **MMKV** como storage de sesión Supabase Auth (reemplaza AsyncStorage — 30-50x más rápido, API síncrona).
3. **WatermelonDB** (sobre expo-sqlite) para la cola offline de pings GPS y historial de alertas.
4. Login del conductor → selección de ruta asignada → TrackingScreen.
5. GPS foreground (`watchPositionAsync`) + background (`expo-task-manager`) con daemon.
6. Sync automático al reconectarse: drena cola WatermelonDB vía socket o HTTP batch.
7. Recepción de alertas de desvío: Push Notifications FCM + notificación local + vibración.
8. Build local (`expo run:ios/android`) y distribución vía EAS Build.

### ✅ Fase F  —  QA y Campo (Semana 8)
1. Prueba física: conducir la ruta con el móvil, verificar desvíos en la Web.
2. Simular pérdida de señal y validar que se recuperan las coordenadas.
3. Despliegue en Railway (API) + Vercel (Web).

---

## 💬 Notas y Aclaraciones

| Decisión | Razonamiento |
|----------|--------------|
| **Supabase como DB Principal** | No hay razón para tener una DB local separada. Supabase es PostgreSQL full. Se puede usar `supabase CLI` para correrlo localmente en Docker durante desarrollo si se requiere aislamiento total. |
| **Monolito Modular en vez de Microservicios** | La arquitectura Hexagonal en `apps/api` lo hace extraíble a microservicio en cualquier momento. Primero validamos, luego separamos si el volumen lo exige. |
| **Google Maps (no Mapbox)** | Dado que el usuario prefiere Google por fiabilidad en México. Se gestiona el costo controlando la frecuencia de carga del mapa (estático vs dinámico) y cacheando polylines localmente. |
| **pnpm en vez de npm/yarn** | pnpm es más rápido y tiene soporte nativo de workspaces que Turborepo aprovecha mejor. |
