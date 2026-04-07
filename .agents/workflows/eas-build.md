---
description: Build y distribución de la app móvil de ZonaZero via EAS Build
---

# EAS Build — App Mobile

## Pre-requisitos

```bash
# Instalar EAS CLI si no está instalado
npm install -g eas-cli

# Autenticarse en Expo
eas login
```

## Perfiles disponibles

Definidos en `apps/mobile/eas.json`:

| Perfil | Plataforma | Uso |
|---|---|---|
| `development` | iOS / Android | Dev client con módulos nativos para desarrollo |
| `preview` | iOS / Android | Distribución interna para QA (sin store) |
| `production` | iOS / Android | Distribución en App Store / Google Play |

---

## Dev Client (desarrollo con módulos nativos)

Necesario cuando se agregan módulos nativos nuevos (react-native-maps, expo-location, etc.).

1. Build del dev client:
```bash
# iOS
eas build --profile development --platform ios --local
# o en la nube de Expo:
eas build --profile development --platform ios
```

2. Instalar en simulador:
```bash
# El build genera un .tar.gz con el .app
# Extraer y arrastrar al simulador, o:
xcrun simctl install booted ZonaZero.app
```

3. Levantar el Metro bundler:
```bash
pnpm --filter mobile start
```

---

## Build de Preview (distribución interna)

Para compartir con el equipo o clientes sin pasar por las stores.

```bash
# iOS (requiere cuenta de desarrollador Apple)
eas build --profile preview --platform ios

# Android (genera .apk directamente)
eas build --profile preview --platform android
```

→ EAS genera un link de descarga. Compartir via TestFlight (iOS) o instalar .apk directamente (Android).

---

## Build de Producción

```bash
# iOS — genera .ipa para App Store
eas build --profile production --platform ios

# Android — genera .aab para Google Play
eas build --profile production --platform android

# Ambas plataformas a la vez
eas build --profile production --platform all
```

---

## Submit a las Stores

```bash
# App Store Connect
eas submit --platform ios

# Google Play
eas submit --platform android
```

---

## OTA Updates (sin pasar por stores)

Para actualizar solo el bundle JS (sin cambios nativos):

```bash
eas update --branch production --message "fix: correct deviation threshold"
```

→ Los usuarios reciben la actualización automáticamente al abrir la app.
→ Solo funciona para cambios en JS/TS, assets. No para módulos nativos.

---

## Checklist antes de un build de producción

- [ ] `app.json` tiene la versión correcta (`version` y `buildNumber`/`versionCode`)
- [ ] Variables de entorno de producción configuradas en EAS Secrets:
  ```bash
  eas secret:create --scope project --name SUPABASE_URL --value "..."
  eas secret:create --scope project --name SUPABASE_ANON_KEY --value "..."
  eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value "..."
  ```
- [ ] Google Maps API Key restringida por Bundle ID (`com.zonazeromx.driver`) en Google Cloud Console
- [ ] `GoogleService-Info.plist` actualizado en el repo de EAS (no en git)
- [ ] Certificado de firma de iOS válido (EAS lo gestiona automáticamente con `credentialsSource: remote`)

---

## Troubleshooting

**Build falla con "missing credentials":**
```bash
eas credentials
```

**Metro bundler no encuentra módulo después de instalar paquete nativo:**
```bash
pnpm --filter mobile start -- --clear
# Si persiste, rebuildar dev client
```

**OTA update no se aplica:**
→ Verificar que el `runtimeVersion` del bundle coincide con el del build instalado.
→ Revisar `expo-updates` logs en la app.
