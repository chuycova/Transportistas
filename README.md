# 🚛 ZonaZero — Plataforma de Logística y Rastreo GPS

Sistema de monitoreo de flota vehicular en tiempo real con alertas de desvío de ruta, multitenencia y app móvil para conductores.

## 🗂️ Estructura del Monorepo

```
zona-zero/
├── apps/
│   ├── api/        ← Backend NestJS 11 (Hexagonal + Módulos)
│   ├── web/        ← Dashboard React 19 + Vite (monitoreo en tiempo real)
│   └── mobile/     ← App Expo 55 para conductores (GPS + notificaciones)
├── packages/
│   ├── domain/     ← Lógica de negocio pura (sin frameworks)
│   ├── infrastructure/ ← Supabase client compartido
│   └── ui/         ← Design tokens y componentes compartidos
└── supabase/       ← Migraciones SQL y seed de desarrollo
```

## ⚡ Quick Start

### Pre-requisitos

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| Node.js | `>=22.14.0` | [nodejs.org](https://nodejs.org) |
| pnpm | `>=9.0.0` | `npm i -g pnpm` |
| Supabase CLI | latest | `brew install supabase/tap/supabase` |

### 1. Clonar e instalar dependencias

```bash
git clone git@github.com:TU_USUARIO/zona-zero.git
cd zona-zero
pnpm install
```

### 2. Configurar variables de entorno

```bash
# Copia el ejemplo y edita con tus credenciales
cp .env.example apps/api/.env
cp .env.example apps/web/.env
cp .env.example apps/mobile/.env
```

> ⚠️ Nunca commitear archivos `.env` con valores reales. Ver [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).

### 3. Iniciar servicios

```bash
# Levantar todo el stack (API + Web)
pnpm dev

# O por separado:
pnpm --filter api dev
pnpm --filter web dev
```

### 4. Setup completo

Para una guía detallada paso a paso, ver [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md).

## 🧱 Stack Principal

- **Backend**: NestJS 11 + Socket.io + Supabase (PostgreSQL + PostGIS)
- **Web**: React 19 + Vite + Tailwind CSS 4 + @react-google-maps/api
- **Mobile**: Expo SDK 55 + React Native + react-native-maps + WatermelonDB
- **Monorepo**: Turborepo + pnpm workspaces
- **Auth**: Supabase Auth (JWT)

Ver stack completo en [TECH_STACK_AND_STRUCTURE.md](./TECH_STACK_AND_STRUCTURE.md).

## 📚 Documentación

| Doc | Descripción |
|---|---|
| [TECH_STACK_AND_STRUCTURE.md](./TECH_STACK_AND_STRUCTURE.md) | Stack, estructura y fases de desarrollo |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Flujo de datos, decisiones de arquitectura |
| [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md) | Guía de setup local paso a paso |
| [docs/API.md](./docs/API.md) | Endpoints REST y eventos Socket.io |
| [CONTRIBUTING.md](./.github/CONTRIBUTING.md) | Convenciones de código y PRs |
| [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) | Auditoría de seguridad y checklist pre-push |
| [COSTS_AND_SECURITY.md](./COSTS_AND_SECURITY.md) | Costos estimados por servicio |

## 🔐 Seguridad

- Todas las credenciales se manejan vía variables de entorno
- `.env` está en `.gitignore` — **nunca se commitea**
- Supabase RLS activo en todas las tablas
- Ver [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) antes de hacer push

## 📄 Licencia

Privado — © ZonaZero MX. Todos los derechos reservados.
