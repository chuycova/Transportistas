---
description: Escanear el repositorio antes de un push para detectar secretos o credenciales expuestas
---

# Security Scan — Pre-Push

Ejecutar este workflow **antes de cualquier push a GitHub**, especialmente antes del primer push o al agregar nuevas credenciales.

## Pasos

// turbo
1. Verificar que ningún `.env` con valores reales está en staging:
```bash
git ls-files --cached | grep "\.env"
```
→ El output debe estar **vacío**. Si aparece algún `.env`, removerlo:
```bash
git rm --cached apps/api/.env
```

// turbo
2. Escanear código fuente en busca de credenciales hardcodeadas:
```bash
# Google Maps API Keys (patrón AIzaSy...)
grep -rn "AIzaSy" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=".next"

# JWTs hardcodeados (eyJhbGci...)
grep -rn "eyJhbGci" apps/ packages/ --include="*.ts" --include="*.tsx" --exclude-dir=node_modules

# Claves privadas
grep -rn "BEGIN PRIVATE KEY" apps/ packages/ --exclude-dir=node_modules

# URLs de Supabase hardcodeadas con key
grep -rn "supabase_service_role\|sb_secret" apps/ packages/ --exclude-dir=node_modules

# Firebase private key
grep -rn "FIREBASE_PRIVATE_KEY\s*=" apps/ packages/ --include="*.ts" --exclude-dir=node_modules
```
→ Cualquier resultado que no sea en archivos `.env` o `.env.example` debe investigarse.

// turbo
3. Verificar que archivos críticos están ignorados por git:
```bash
git check-ignore -v apps/api/.env
git check-ignore -v apps/web/.env
git check-ignore -v apps/mobile/.env
git check-ignore -v apps/mobile/ios/GoogleService-Info.plist
git check-ignore -v apps/mobile/android/app/google-services.json
```
→ Cada línea debe mostrar la regla del `.gitignore` que la cubre.

// turbo
4. Ver exactamente qué archivos serán commiteados (dry run):
```bash
git add -A
git status
```
→ Revisar la lista de "Changes to be committed". No debe haber:
  - Archivos `.env`
  - Archivos `*.p12`, `*.p8`, `*.mobileprovision`
  - Archivos `GoogleService-Info.plist` o `google-services.json`
  - Directorios `dist/`, `.next/`, `build/`

5. Si se encontró algún secreto en el historial de git (commits anteriores):
```bash
# CUIDADO: esto reescribe el historial
git filter-repo --path apps/api/.env --invert-paths

# Después de limpiar, rotar TODAS las credenciales expuestas inmediatamente
```

## Checklist Pre-Push

- [ ] `git ls-files --cached | grep ".env"` → vacío
- [ ] Sin `AIzaSy...` en código fuente
- [ ] Sin `eyJhbGci...` (JWTs) en código fuente
- [ ] Sin `BEGIN PRIVATE KEY` en código fuente
- [ ] Google Maps API Key restringida en Google Cloud Console
- [ ] RLS activo en todas las tablas de Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en `apps/api/.env` (nunca en frontend)

## Referencia

Ver [SECURITY_AUDIT.md](../../SECURITY_AUDIT.md) para el inventario completo de credenciales y estado de gitignore.
