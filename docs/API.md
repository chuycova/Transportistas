# 📡 API Reference — ZonaZero

> Base URL local: `http://localhost:3001`  
> Base URL producción: `https://api.zonazeromx.com`

---

## 🔐 Autenticación

Todos los endpoints (excepto `/health` y `/auth/login`) requieren un **JWT de Supabase** en el header:

```
Authorization: Bearer <supabase-access-token>
```

El token se obtiene al hacer login con Supabase Auth (desde web o mobile). El backend valida el JWT y extrae el `tenant_id` del claim para aplicar multitenencia.

---

## 🩺 Health Check

### `GET /health`

Sin autenticación.

**Response `200`**
```json
{
  "status": "ok",
  "timestamp": "2026-04-07T06:00:00.000Z",
  "version": "1.0.0"
}
```

---

## 🚗 Vehículos

### `GET /vehicles`

Lista todos los vehículos del tenant autenticado.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "plate": "ABC-1234",
    "name": "Camión Norte 1",
    "status": "active",          // "active" | "inactive" | "offline"
    "currentLocation": {
      "lat": 25.6866,
      "lng": -100.3161,
      "updatedAt": "2026-04-07T05:58:00.000Z"
    },
    "assignedRouteId": "uuid | null"
  }
]
```

### `GET /vehicles/:id`

**Response `200`** — mismo shape que el objeto individual de arriba.  
**Response `404`** — vehículo no encontrado o no pertenece al tenant.

### `POST /vehicles`

**Body**
```json
{
  "plate": "DEF-5678",
  "name": "Camión Sur 2",
  "driverEmail": "conductor@empresa.com"   // opcional
}
```

**Response `201`**
```json
{ "id": "nuevo-uuid", "plate": "DEF-5678", ... }
```

### `PATCH /vehicles/:id`

**Body** (campos opcionales)
```json
{
  "name": "Nuevo nombre",
  "status": "inactive"
}
```

**Response `200`** — vehículo actualizado.

### `DELETE /vehicles/:id`

**Response `204`** — sin body.

---

## 🗺️ Rutas

### `GET /routes`

Lista todas las rutas del tenant.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "name": "Ruta Centro-Norte",
    "status": "pending",    // "pending" | "active" | "completed" | "cancelled"
    "waypoints": [
      { "order": 0, "lat": 25.6866, "lng": -100.3161, "label": "Origen" },
      { "order": 1, "lat": 25.7500, "lng": -100.3400, "label": "Parada 1" },
      { "order": 2, "lat": 25.8000, "lng": -100.3700, "label": "Destino" }
    ],
    "estimatedDurationMinutes": 45,
    "assignedVehicleId": "uuid | null",
    "createdAt": "2026-04-07T00:00:00.000Z"
  }
]
```

### `POST /routes`

**Body**
```json
{
  "name": "Ruta Monterrey - Saltillo",
  "waypoints": [
    { "order": 0, "lat": 25.6866, "lng": -100.3161, "label": "Origen" },
    { "order": 1, "lat": 25.4270, "lng": -101.0030, "label": "Destino" }
  ],
  "estimatedDurationMinutes": 90
}
```

**Response `201`** — ruta creada con `id` generado.

### `PATCH /routes/:id/assign`

Asigna un vehículo a una ruta y activa el tracking.

**Body**
```json
{
  "vehicleId": "uuid"
}
```

**Response `200`**
```json
{
  "routeId": "uuid",
  "vehicleId": "uuid",
  "status": "active",
  "startedAt": "2026-04-07T06:00:00.000Z"
}
```

### `PATCH /routes/:id/complete`

Marca la ruta como completada.

**Response `200`**
```json
{
  "routeId": "uuid",
  "status": "completed",
  "completedAt": "2026-04-07T08:30:00.000Z"
}
```

---

## 📍 Tracking

### `POST /tracking/ping`

Endpoint HTTP para enviar una posición GPS (alternativa al Socket.io cuando no hay WebSocket disponible).

**Body**
```json
{
  "vehicleId": "uuid",
  "routeId": "uuid",
  "lat": 25.6866,
  "lng": -100.3161,
  "accuracy": 5.2,
  "timestamp": "2026-04-07T06:00:00.000Z"
}
```

**Response `201`**
```json
{
  "locationId": "uuid",
  "deviationDetected": false,
  "distanceFromRoute": 12.4    // metros
}
```

Si `deviationDetected: true`, el backend además emite un evento Socket.io y envía Push Notification.

### `GET /tracking/:vehicleId/history`

**Query params**

| Param | Tipo | Default | Descripción |
|---|---|---|---|
| `from` | ISO datetime | últimas 24h | Inicio del rango |
| `to` | ISO datetime | now | Fin del rango |
| `limit` | number | 1000 | Máximo de puntos |

**Response `200`**
```json
{
  "vehicleId": "uuid",
  "totalPoints": 342,
  "locations": [
    {
      "lat": 25.6866,
      "lng": -100.3161,
      "accuracy": 5.2,
      "timestamp": "2026-04-07T06:00:00.000Z"
    }
  ]
}
```

---

## 🚨 Alertas

### `GET /alerts`

**Query params**

| Param | Tipo | Descripción |
|---|---|---|
| `vehicleId` | uuid | Filtrar por vehículo |
| `routeId` | uuid | Filtrar por ruta |
| `type` | string | `DEVIATION` \| `OFFLINE` \| `DELAY` |
| `from` | ISO datetime | Desde fecha |
| `to` | ISO datetime | Hasta fecha |
| `limit` | number | Default 50, máx 200 |

**Response `200`**
```json
[
  {
    "id": "uuid",
    "type": "DEVIATION",
    "vehicleId": "uuid",
    "routeId": "uuid",
    "lat": 25.7000,
    "lng": -100.3500,
    "distanceFromRoute": 78.4,
    "severity": "high",          // "low" | "medium" | "high"
    "resolvedAt": null,
    "createdAt": "2026-04-07T06:15:00.000Z"
  }
]
```

### `PATCH /alerts/:id/resolve`

Marca una alerta como resuelta.

**Response `200`**
```json
{
  "id": "uuid",
  "resolvedAt": "2026-04-07T06:20:00.000Z"
}
```

---

## 🔌 Socket.io — Eventos en Tiempo Real

### Conexión

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: supabaseAccessToken  // JWT de Supabase Auth
  }
});
```

---

### Eventos de Cliente → Servidor

#### `vehicle:ping`

El conductor envía su posición GPS en tiempo real.

```typescript
socket.emit('vehicle:ping', {
  vehicleId: 'uuid',
  routeId: 'uuid',
  lat: 25.6866,
  lng: -100.3161,
  accuracy: 5.2,              // metros
  timestamp: new Date().toISOString()
});
```

#### `driver:connect`

El conductor registra su sesión al conectar.

```typescript
socket.emit('driver:connect', {
  driverId: 'uuid',     // auth.uid() de Supabase
  vehicleId: 'uuid'
});
```

#### `dashboard:subscribe`

El dashboard web se suscribe a actualizaciones de vehículos específicos.

```typescript
socket.emit('dashboard:subscribe', {
  vehicleIds: ['uuid1', 'uuid2']   // vacío = todos del tenant
});
```

---

### Eventos de Servidor → Cliente

#### `vehicle:update`

Broadcast de posición de un vehículo (recibido por el dashboard).

```typescript
socket.on('vehicle:update', (data: {
  vehicleId: string;
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
  status: 'on_route' | 'deviated' | 'stopped';
}) => {
  // Actualizar marcador en el mapa
});
```

#### `alert:deviation`

Alerta de desvío detectada por el backend.

```typescript
socket.on('alert:deviation', (data: {
  alertId: string;
  vehicleId: string;
  routeId: string;
  lat: number;
  lng: number;
  distanceFromRoute: number;   // metros
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}) => {
  // Mostrar notificación en dashboard
});
```

#### `vehicle:offline`

Un vehículo no envía pings por más de N segundos (configurable).

```typescript
socket.on('vehicle:offline', (data: {
  vehicleId: string;
  lastSeen: string;    // ISO timestamp del último ping
}) => {
  // Marcar vehículo como offline en el mapa
});
```

---

## ⚠️ Códigos de Error

| Código | Descripción |
|---|---|
| `400` | Body inválido o parámetros faltantes |
| `401` | JWT ausente, expirado o inválido |
| `403` | El recurso no pertenece al tenant del usuario |
| `404` | Recurso no encontrado |
| `409` | Conflicto (ej: vehículo ya tiene ruta activa) |
| `422` | Validación de negocio fallida (ej: ruta sin waypoints) |
| `500` | Error interno del servidor |

**Formato de error estándar:**
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Vehicle does not belong to your tenant"
}
```
