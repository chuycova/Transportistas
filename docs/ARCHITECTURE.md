# 🏛️ Arquitectura — ZonaZero

> **Patrón:** Monolito Modular con Arquitectura Hexagonal (Ports & Adapters) + Screaming Architecture por dominio.

---

## 📊 Flujo de Datos Principal

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CONDUCTORES (Mobile)                        │
│                     Expo 55 · React Native 0.79                     │
│                                                                     │
│  GPS Foreground/Background (expo-location + expo-task-manager)      │
│  WatermelonDB ← cola offline → drena al reconectarse                │
│  MMKV ← sesión JWT + vehicleId + routeId                            │
└────────────────────────┬────────────────────────────────────────────┘
                         │  Socket.io  emit('vehicle:ping', payload)
                         │  HTTP POST  /api/tracking/ping  (fallback)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND API (NestJS 11)                        │
│               Railway · Node.js >=22 · ESM + SWC                    │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐    │
│  │  TrackingMod│  │  RoutingMod  │  │ VehiclesMod│  │ AlertsMod│    │
│  │             │  │              │  │            │  │          │    │
│  │ domain/     │  │ domain/      │  │ domain/    │  │ domain/  │    │
│  │ application/│  │ application/ │  │ application│  │ applicat.│    │
│  │ infra/      │  │ infra/       │  │ infra/     │  │ infra/   │    │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  └────┬─────┘    │
│         │                │                 │               │        │
│         └────────────────┴─────────────────┴───────────────┘        │
│                                   │                                 │
│              Socket.io Gateway ←──┘──→ broadcast('vehicle:update')  │
│              Supabase Client ←────────→ INSERT + ST_DWithin check   │
│              Firebase Admin ←─────────→ FCM Push Notification       │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          │  Supabase SDK / REST API
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL + PostGIS)                  │
│                                                                     │
│  Tables:  vehicles · routes · route_waypoints · locations           │
│           alerts · tenants · driver_sessions                        │
│                                                                     │
│  PostGIS: ST_DWithin(location, route_geom, threshold)  ← desvíos    │
│  RLS:     tenant_id = auth.jwt() → claim 'tenant_id'                │
│  Realtime: no usado (websocket propio via Socket.io en API)         │
└─────────────────────────────────────────────────────────────────────┘
          │
          │  Socket.io  on('vehicle:update', handler)
          │  TanStack Query ← REST calls
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD WEB (React 19 + Vite)                  │
│                           Vercel                                    │
│                                                                     │
│  ├── /tracking    ← Mapa Google Maps en tiempo real                 │
│  ├── /routes      ← CRUD de rutas, dibujar polylines                │
│  ├── /vehicles    ← Estado de flota                                 │
│  ├── /alerts      ← Historial de desvíos                            │
│  └── /auth        ← Login Supabase Auth                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Capas de la Arquitectura Hexagonal (por módulo en `apps/api`)

```
┌──────────────────────────────────────────────────────┐
│                    INFRAESTRUCTURA                   │
│  NestJS Controllers · Socket.io Gateways             │
│  Supabase Repositories · Firebase Push               │
│                                                      │
│   ┌──────────────────────────────────────────────┐   │
│   │               APLICACIÓN                     │   │
│   │   Use Cases (orquestan el dominio)           │   │
│   │   DetectDeviationUseCase                     │   │
│   │   AssignRouteUseCase                         │   │
│   │   SendAlertUseCase                           │   │
│   │                                              │   │
│   │   ┌──────────────────────────────────────┐   │   │
│   │   │              DOMINIO                 │   │   │
│   │   │  Entities: Vehicle, Route, Alert     │   │   │
│   │   │  Value Objects: Coordinate, Deviation│   │   │
│   │   │  Ports: IVehicleRepository           │   │   │
│   │   │    (interfaces puras, sin deps)      │   │   │
│   │   └──────────────────────────────────────┘   │   │
│   └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**Regla de dependencia:** Las flechas solo apuntan hacia adentro.
`Infraestructura → Aplicación → Dominio` ✅  
`Dominio → Infraestructura` ❌ (nunca)

---

## 📦 Paquetes Compartidos (`packages/`)

```
packages/
├── domain/         ← Lógica pura: entidades, value-objects, use-cases
│                     Sin imports de NestJS, React, Expo, Supabase
│                     Usable en API + Web + Mobile
│
├── infrastructure/ ← Supabase client singleton + fetch wrapper
│                     Importado por api/ y web/ (no mobile, usa MMKV)
│
└── ui/             ← Design tokens + Spinner, LoadingOverlay, etc.
                      Importado por web/ y mobile/
```

---

## 🔐 Modelo de Multitenencia

```
JWT Claim: { "tenant_id": "uuid-del-tenant" }
         ↓
Supabase RLS Policy:
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
         ↓
Todas las queries en Supabase filtran automáticamente por tenant.
El backend valida el claim antes de cualquier operación.
```

**Aislamiento garantizado:** Ningún tenant puede ver datos de otro. El `SUPABASE_SERVICE_ROLE_KEY` (que bypassea RLS) **solo existe en el backend**, nunca en frontend ni mobile.

---

## ⚡ Flujo de Alerta de Desvío en Tiempo Real

```
1. Mobile emite: socket.emit('vehicle:ping', { lat, lng, vehicleId, routeId })
       ↓
2. API TrackingGateway recibe el ping
       ↓
3. DetectDeviationUseCase ejecuta en Supabase:
   SELECT ST_DWithin(
     ST_MakePoint($lng, $lat)::geography,
     route_geom,
     $threshold_meters   ← DEVIATION_THRESHOLD_METERS env var
   ) FROM routes WHERE id = $routeId
       ↓
4a. Dentro del umbral → INSERT en locations, broadcast position update
4b. Fuera del umbral →
     a. INSERT en alerts (tipo: 'DEVIATION')
     b. Firebase Admin SDK → FCM → Push Notification al conductor
     c. Socket.io broadcast → Dashboard Web recibe alerta en tiempo real
```

---

## 🌐 URLs por Entorno

| Servicio | Desarrollo | Producción |
|---|---|---|
| API | `http://localhost:3001` | `https://api.zonazeromx.com` |
| Web | `http://localhost:5173` | `https://app.zonazeromx.com` |
| Supabase | `http://localhost:54321` (CLI) | `https://oyrbtimpnbvuaoxolqaz.supabase.co` |

---

## 🔌 Eventos Socket.io

### Cliente → Servidor

| Evento | Payload | Descripción |
|---|---|---|
| `vehicle:ping` | `{ vehicleId, routeId, lat, lng, accuracy, timestamp }` | Ping GPS del conductor |
| `driver:connect` | `{ driverId, vehicleId }` | Conductor conecta sesión |

### Servidor → Clientes (broadcast)

| Evento | Payload | Suscriptores |
|---|---|---|
| `vehicle:update` | `{ vehicleId, lat, lng, timestamp, status }` | Dashboard Web |
| `alert:deviation` | `{ vehicleId, lat, lng, routeId, severity }` | Dashboard Web + Driver Mobile |
| `vehicle:offline` | `{ vehicleId, lastSeen }` | Dashboard Web |

---

## 💡 Decisiones de Diseño

| Decisión | Alternativa considerada | Razón |
|---|---|---|
| Socket.io propio (no Supabase Realtime) | Supabase Realtime Channels | Control total del protocolo; necesitamos lógica de desvío en el gateway antes de broadcast |
| PostGIS para desvíos | Calcular en TypeScript | Una sola query geoespacial indexada es órdenes de magnitud más eficiente que traer coords al backend |
| WatermelonDB en Mobile | Expo SQLite directo | ORM reactivo, cola offline lista para sync, manejo de conflictos incluido |
| MMKV para sesión | AsyncStorage | 30-50x más rápido, API síncrona, sin riesgo de carrera en background tasks |
| Turborepo | Nx | Más simple, zero-config para pnpm workspaces, suficiente para este tamaño |
