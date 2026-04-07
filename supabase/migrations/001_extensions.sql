-- ─────────────────────────────────────────────────────────────
-- Migración 001: Extensiones requeridas
-- Ejecutar primero. Requiere rol de superusuario en Supabase.
-- ─────────────────────────────────────────────────────────────

-- Identificadores únicos globales (UUIDs)
create extension if not exists "uuid-ossp" schema extensions;

-- Capacidades geoespaciales (polígonos, puntos, distancias, etc.)
create extension if not exists "postgis" schema extensions;

-- Búsquedas de texto completo en español (opcional, útil para filtros de nombre/placa)
create extension if not exists "unaccent" schema extensions;
