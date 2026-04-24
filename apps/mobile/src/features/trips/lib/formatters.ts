// ─── formatters.ts ────────────────────────────────────────────────────────────
// Helpers de formato para la pantalla de viajes.

export function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtDistance(km: number | null): string | null {
  if (!km) return null;
  return `${km.toFixed(0)} km`;
}

export function fmtDuration(min: number | null): string | null {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
