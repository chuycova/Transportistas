# 💰🔐 Costos y Seguridad — ZonaZero

> **Propósito:** Documento vivo. Define las metas de costo, los vectores de ataque conocidos y las mitigaciones pendientes. Se actualiza conforme avanza el proyecto.
> **Última actualización:** 2026-04-06

---

## Índice

1. [Presupuesto Google Maps APIs](#1-presupuesto-google-maps-apis)
2. [Costos de Supabase / Base de datos](#2-costos-de-supabase--base-de-datos)
3. [Vectores de Ataque — API (NestJS)](#3-vectores-de-ataque--api-nestjs)
4. [Vectores de Ataque — Web (Next.js)](#4-vectores-de-ataque--web-nextjs)
5. [Vectores de Ataque — Mobile (React Native / Expo)](#5-vectores-de-ataque--mobile-react-native--expo)
6. [Vectores de Ataque — Supabase / Auth](#6-vectores-de-ataque--supabase--auth)
7. [Vectores de Ataque — Infraestructura y Claves](#7-vectores-de-ataque--infraestructura-y-claves)
8. [Checklist de Producción](#8-checklist-de-producción)

---

## 1. Presupuesto Google Maps APIs

### Separación de claves (arquitectura de seguridad de costos)

| Clave | Workspace | Restricción | APIs permitidas |
|---|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `apps/web/.env` | Referrer HTTP: `zonazero.com/*` | Maps JavaScript API |
| `GOOGLE_MAPS_BACKEND_KEY` | `apps/api/.env` | IP del servidor de producción | Roads API · Directions API · Geocoding API |

> ⚠️ **Nunca** habilitar Roads API o Directions API en la clave pública del browser.
> ⚠️ **Nunca** añadir `NEXT_PUBLIC_` a la clave backend.

---

### 1.1 Google Maps JavaScript API (render del mapa)

| Plan | Precio | Incluido gratis |
|---|---|---|
| Maps JS | $7 USD / 1,000 loads | 28,500 loads/mes gratis (~950/día) |

**Proyección** (dev + staging, antes de producción): $0 — dentro del free tier.

**Producción** (10 operadores activos, 8h/día):
- ~80 page loads/día (operadores abriendo el dashboard)
- **Costo estimado: $0** (muy por debajo del free tier)

**Ley:** La clave está restringida por dominio. Si alguien la extrae e intenta usarla desde otro origen, Google rechaza el request. Riesgo de abuso: **Bajo**.

---

### 1.2 Google Roads API (road snapping de GPS)

**Precio:** $10 USD / 1,000 requests (no hay free tier después de los primeros $200 de crédito mensual de Google).

#### Optimizaciones implementadas (plan)

| Optimización | Reducción | Estado |
|---|---|---|
| **Batch buffer** (10 pings = 1 request) | 10x | 🔲 Pendiente |
| **Delta mínimo 15m** (ignorar quieto) | ~2.5x | 🔲 Pendiente |
| **Fallback graceful** (si key no configurada) | N/A | 🔲 Pendiente |

#### Proyección de costo con optimizaciones

| Escenario | Pings/día | Requests/día | Costo/día | Costo/mes |
|---|---|---|---|---|
| 10 vehículos, 8h, 1 ping/10s (sin optimizar) | 28,800 | 28,800 | $288 | $8,640 ❌ |
| + Batch x10 | 28,800 | 2,880 | $28.8 | $864 |
| + Delta 15m (40% quieto) | ~17,280 | 1,728 | $17.3 | $519 |
| + **Batch x10 + Delta** | ~17,280 | **172** | **$1.72** | **~$52** ✅ |

**Meta de costo Roads API:** < $60 USD/mes para 10 vehículos activos.

---

### 1.3 Google Routes API v2 (cálculo de rutas por calles)

**Precio:** $5 USD / 1,000 requests (Routes API v2 es ~50% más barata que Directions v1).

| Escenario | Requests/mes | Costo/mes |
|---|---|---|
| 50 rutas nuevas/mes (sin cache) | 50 | $0.25 |
| 500 rutas nuevas/mes (sin cache) | 500 | $2.50 |
| Con cache (rutas repetidas = $0) | <50 nuevas | < $0.25 |

**Optimización clave:** `X-Goog-FieldMask: routes.polyline,routes.distanceMeters,routes.duration`
Solo pagar por los campos que se consumen. No pedir `steps`, `legs`, `travelAdvisory`.

**Meta de costo Routes API:** < $5 USD/mes.

---

### 1.4 Costo Total Estimado Google Maps

| API | Costo/mes estimado |
|---|---|
| Maps JS (render) | $0 (free tier) |
| Roads API (snapping optimizado) | ~$52 |
| Routes API v2 (rutas, con cache) | ~$3 |
| **Total** | **~$55 USD/mes** |

**Crédito gratuito de Google:** $200 USD/mes para nuevas cuentas. Los primeros 3-4 meses son gratuitos.

---

## 2. Costos de Supabase / Base de datos

### Plan Free (actual)

| Límite | Valor | Proyección actual |
|---|---|---|
| Filas totales | 500,000 | ~por definir |
| Almacenamiento | 500 MB | Bajo |
| Bandwidth | 5 GB/mes | Bajo |
| Edge Functions | 500,000 invocaciones | No usadas |
| Realtime connections | 200 simultáneas | 10-15 activas |

### Reducción de filas — `tracking_events`

Sin control, `tracking_events` crece a:
- 1 ping/10s × 10 vehículos × 8h/día = **28,800 filas/día = 864,000/mes** ❌

Con `PERSIST_EVERY_N = 6` (guardar 1 de cada 6 pings = cada 60 segundos):
- **4,800 filas/día = 144,000/mes** ✅

**Política de retención:**
```sql
-- Cron semanal — eliminar eventos > 90 días
DELETE FROM tracking_events
WHERE recorded_at < NOW() - INTERVAL '90 days';
```

### Tabla `route_cache` (nueva)

| Campo | Tipo | Descripción |
|---|---|---|
| `cache_key` | `text` PRIMARY KEY | SHA-256 de origin+waypoints+destination (redondeados a 4 dec) |
| `polyline_encoded` | `text` | Polyline comprimida de Google |
| `distance_m` | `integer` | Distancia en metros |
| `duration_s` | `integer` | Duración estimada en segundos |
| `created_at` | `timestamptz` | Para expirar cache antigua (> 30 días) |

**Meta:** Supabase Free tier indefinidamente durante desarrollo. Pro tier ($25/mes) solo cuando se acerque a los límites en producción.

---

## 3. Vectores de Ataque — API (NestJS)

### 3.1 Inyección / RCE

| Vector | Riesgo | Mitigación | Estado |
|---|---|---|---|
| SQL injection (queries directas) | Alto | Supabase SDK usa queries parametrizadas | ✅ Mitigado |
| Prototype pollution (`lodash` devDep) | Nulo | Solo en devDependencies NestJS CLI | ✅ Confirmado |
| `path-to-regexp` ReDoS (CVE-2026-4926) | Medio | `pnpm.overrides` fuerza `≥8.4.0` | ✅ Mitigado |
| Deserialización insegura (body parsing) | Medio | NestJS usa `class-validator` + `ValidationPipe` | 🔲 Verificar que esté habilitado globalmente |

### 3.2 Autenticación / Autorización

| Vector | Riesgo | Mitigación | Estado |
|---|---|---|---|
| JWT forgery (AL3None) | Alto | Supabase valida firma con secret del proyecto | ✅ Mitigado |
| Token en headers expuesto en logs | Medio | No loggear `Authorization` header | 🔲 Verificar middleware de logging |
| Endpoints sin guard | Alto | Todos los endpoints con `@UseGuards(AuthGuard)` | 🔲 Auditar routes de `tracking.module` |
| IDOR (acceso a datos de otro tenant) | Alto | Row Level Security (RLS) en Supabase | 🔲 Verificar RLS en `tracking_events`, `routes`, `vehicles` |

### 3.3 Rate Limiting / DoS

| Vector | Riesgo | Mitigación | Estado |
|---|---|---|---|
| Flood de pings GPS falsos | Alto | Rate limit por vehicleId (throttle) | 🔲 Pendiente — añadir `@nestjs/throttler` |
| Solicitudes masivas a `/routes` (cache miss → $$) | Alto | Rate limit + cache obligatorio antes de llamar a Google | 🔲 Pendiente |
| HTTP/2 DoS (CVE-2025-59465 y similares) | Alto | Node.js `≥22.14.0` (`.nvmrc` configurado) | ✅ Mitigado |
| Payload oversized (body bombing) | Medio | `app.use(express.json({ limit: '10kb' }))` en `main.ts` | 🔲 Verificar límite |

### 3.4 Exposición de datos

| Vector | Riesgo | Mitigación | Estado |
|---|---|---|---|
| `GOOGLE_MAPS_BACKEND_KEY` en respuestas de API | Crítico | Nunca retornar env vars en responses | 🔲 Auditar responses |
| Stack traces en producción | Medio | `app.useGlobalFilters(new HttpExceptionFilter())` | 🔲 Verificar filter global |
| Coordenadas GPS de rutas privadas sin auth | Alto | RLS en Supabase + AuthGuard API | 🔲 Verificar |

---

## 4. Vectores de Ataque — Web (Next.js)

### 4.1 XSS / Inyección de Scripts

| Vector | Riesgo | Mitigación | Estado |
|---|---|---|---|
| XSS vía datos de Supabase en DOM | Alto | React escapa por defecto; no usar `dangerouslySetInnerHTML` | ✅ Mitigado (no se usa) |
| XSS via Google Maps InfoWindow con datos de usuario | Medio | No renderizar texto de usuario sin sanitizar en InfoWindows | 🔲 Verificar si se usan InfoWindows con datos externos |
| CSP bypass | Medio | CSP configurado en `next.config.ts` | ✅ Mitigado |
| `unsafe-eval` en CSP (requerido por algunos mapas) | Bajo | Evitar si es posible | 🔲 Revisar si Maps JS lo requiere |

### 4.2 Autenticación

| Vector | Riesgo | Mitigación | Estado |
|---|---|---|---|
| JWT en `localStorage` (XSS-accesible) | Crítico | Migrado a cookies HttpOnly via `@supabase/ssr` | ✅ **Resuelto en migración** |
| Bypass de auth dev hardcodeado | Crítico | `admin@zonazero.com/admin` eliminado | ✅ **Resuelto en migración** |
| Session fixation | Medio | `supabase.auth.signOut()` invalida token en servidor | ✅ Mitigado |
| Logout sin full-reload (sesión persiste en middleware) | Medio | `window.location.href` fuerza HTTP fresh request | ✅ **Resuelto** |

### 4.3 Headers de Seguridad

| Header | Valor | Estado |
|---|---|---|
| `X-Frame-Options` | `DENY` | ✅ Activo |
| `X-Content-Type-Options` | `nosniff` | ✅ Activo |
| `Strict-Transport-Security` | 2 años + subdomains | ✅ Activo |
| `Content-Security-Policy` | Configurado | ✅ Activo |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ Activo |
| `Permissions-Policy` | camera, mic, geo restringidos | ✅ Activo |

### 4.4 Next.js Específico

| CVE / Vector | Riesgo | Estado |
|---|---|---|
| CVE-2025-55182 (RCE en RSC deserialización) | Crítico | ✅ `next@15.5.14` — parcheado |
| CVE-2025-55183 (source leak en Server Functions) | Alto | ✅ Misma versión |
| Open redirect en middleware | Medio | 🔲 Verificar que solo se redirige a rutas internas |

---

## 5. Vectores de Ataque — Mobile (React Native / Expo)

### 5.1 Almacenamiento local

| Vector | Riesgo | Mitigación | Estado |
|---|---|---|---|
| JWT en AsyncStorage (texto plano) | Alto | Migrar a `expo-secure-store` (Keychain/Keystore) | 🔲 **Pendiente** |
| Coordenadas GPS en cache local sin cifrar | Medio | WatermelonDB usa SQLCipher? Verificar | 🔲 Verificar |

### 5.2 Comunicación de red

| Vector | Riesgo | Mitigación | Estado |
|---|---|---|---|
| Certificate pinning ausente | Medio | Opcional para MVP; considerar en producción | 🔲 Roadmap futuro |
| WebSocket sin autenticación inicial | Alto | Token JWT en handshake del socket | 🔲 Verificar `socket.ts` en mobile |
| Exposición de URLs de Supabase en el bundle | Bajo | `EXPO_PUBLIC_*` es visible en el bundle compilado — OK para URLs, no para secrets | ✅ Solo URLs públicas en env |

### 5.3 Permisos

| Permiso | Uso | Estado |
|---|---|---|
| `ACCESS_FINE_LOCATION` | Background tracking | 🔲 Solicitar solo cuando está en primer plano primero |
| `ACCESS_BACKGROUND_LOCATION` | Tracking continuo | 🔲 Explicar al usuario antes de solicitar (Play Store lo exige) |

---

## 6. Vectores de Ataque — Supabase / Auth

### 6.1 Row Level Security (RLS)

| Tabla | RLS activo | Política | Estado |
|---|---|---|---|
| `vehicles` | — | Solo el tenant propietario puede leer/escribir | 🔲 Verificar |
| `routes` | — | Solo el tenant propietario puede leer/escribir | 🔲 Verificar |
| `tracking_events` | — | Solo el tenant del vehículo puede leer | 🔲 Verificar |
| `route_cache` | — | Sin RLS (datos no sensibles, solo polylines) | 🔲 Confirmar |

> **Nota crítica:** Si RLS no está activo, cualquier usuario autenticado puede leer los datos de otros tenants. Verificar en el Supabase Dashboard antes del deploy.

### 6.2 Autenticación Supabase

| Vector | Riesgo | Mitigación | Estado |
|---|---|---|---|
| Brute force en login | Medio | Supabase tiene rate limiting nativo por defecto | ✅ Supabase lo maneja |
| Cuentas de prueba activas en producción | Medio | Eliminar usuarios de prueba del proyecto Supabase antes de deploy | 🔲 Pendiente pre-deploy |
| `anon` key expuesta permite queries a tablas sin RLS | Crítico | Activar RLS en todas las tablas | 🔲 **Pendiente — alta prioridad** |

---

## 7. Vectores de Ataque — Infraestructura y Claves

### 7.1 Gestión de API Keys

| Clave | Ubicación actual | Meta |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `apps/web/.env` | ✅ Correcto — restringir por dominio en Google Cloud |
| `GOOGLE_MAPS_BACKEND_KEY` | No existe aún | 🔲 **Crear antes de implementar Roads/Directions** |
| `SUPABASE_SERVICE_ROLE_KEY` | No en web | ✅ Solo en API si se necesita |
| `SUPABASE_ANON_KEY` | `apps/web/.env` y `apps/mobile` | ✅ Es pública por diseño, pero RLS debe estar activo |

### 7.2 .gitignore

```bash
# Verificar que estos patrones estén en .gitignore raíz y por workspace:
.env
.env.local
.env.production
.env.*.local
apps/**/.env
apps/**/.env.local
```

**Estado:** 🔲 Verificar que ningún `.env` haya entrado al historial de git.

### 7.3 Secretos en código

| Búsqueda | Resultado | Estado |
|---|---|---|
| Claves hardcoded en código fuente | No encontradas | ✅ |
| `console.log` de tokens/coords en producción | Por verificar | 🔲 Audit de logs |

### 7.4 ⚠️ Dependencias con historial de compromiso

#### `axios` — ELIMINADO / PROHIBIDO

| Evento | Fecha | Impacto |
|---|---|---|
| **Supply chain attack** (RAT dropper) | 31 Mar 2026 | Versiones `1.14.1` y `0.30.4` comprometidas |
| CVE-2025-58754 (DoS via data: URI) | 2025 | Afecta `< 1.12.0` |
| CVE-2024-39338 (SSRF) | 2024 | Afecta `1.3.2 – 1.7.3` |

**Decisión:** `axios` fue removido del proyecto y reemplazado por **`fetch` nativo de Node.js** (disponible desde Node 18+, estable en Node 22+). Cero dependencias externas para HTTP — sin riesgo de supply chain.

**Política:** No instalar `axios` en ningún workspace del monorepo. Usar siempre `fetch` nativo o el SDK oficial de la plataforma (ej. `@supabase/ssr`).

```bash
# Si alguien intenta añadirlo, el CI debe rechazarlo:
# .npmrc o biome.json: listar axios como paquete prohibido
```

---

## 8. Checklist de Producción

### Seguridad — Obligatorios antes de deploy

- [ ] **RLS activo** en todas las tablas de Supabase (`vehicles`, `routes`, `tracking_events`)
- [ ] **`GOOGLE_MAPS_BACKEND_KEY` creada** y restringida por IP en Google Cloud
- [ ] **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`** restringida por dominio (`zonazero.com`) en Google Cloud
- [ ] **Mobile:** JWT migrado de AsyncStorage a `expo-secure-store`
- [ ] **API:** `ValidationPipe` global activado en `main.ts` (`whitelist: true, forbidNonWhitelisted: true`)
- [ ] **API:** Rate limiting con `@nestjs/throttler` en endpoints de tracking y routing
- [ ] **API:** Body size limit configurado (`express.json({ limit: '10kb' })`)
- [ ] **Web:** No hay `dangerouslySetInnerHTML` con datos de usuario
- [ ] **Logs:** Sin coordenadas exactas ni tokens en logs de producción
- [ ] Eliminar usuarios de prueba del proyecto Supabase de producción

### Costos — Obligatorios antes de deploy

- [ ] **Roads API batch buffer** implementado en `process-location.use-case.ts`
- [ ] **Delta mínimo 15m** implementado (ignorar vehículo quieto)
- [ ] **Sampling 1/6** para escritura en `tracking_events`
- [ ] **`route_cache` table** creada en Supabase
- [ ] **`FieldMask`** configurado en llamadas a Routes API v2
- [ ] **Alerta de billing** configurada en Google Cloud Console (límite $100/mes)
- [ ] **Política de retención** (`DELETE ... WHERE ... < NOW() - INTERVAL '90 days'`) en `tracking_events`

### Funcionalidad — Para versión estable

- [ ] Road snapping activo (GPS no vuela por casas)
- [ ] Route consumption visual (ruta se consume conforme avanza)
- [ ] Alerta visual de desvío en el mapa (no solo el badge del sidebar)
- [ ] Routing por calles al crear rutas (Directions API)
- [ ] Capa de tráfico (`<TrafficLayer />`)
- [ ] Notificaciones browser para desvíos críticos
- [ ] Mobile: JWT en `expo-secure-store`
- [ ] Mobile: Permiso de background location correctamente solicitado

---

> **Cómo usar este documento:**
> Marcar ítems con `[x]` conforme se van completando. Abrir issues/PR para cada bloque antes del deploy.
