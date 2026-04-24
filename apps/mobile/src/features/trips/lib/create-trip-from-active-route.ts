// ─── create-trip-from-active-route.ts ────────────────────────────────────────
// Crea un registro en trips a partir del estado actual de MMKV.
// Unifica la lógica duplicada entre RoutesScreen y TrackingScreen.

import { supabase } from '@lib/supabase';
import { getStr, setStr } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';

interface CreateTripResult {
  tripId: string | null;
  error:  string | null;
}

export async function createTripFromActiveRoute(
  fallbackTenantId?: string,
): Promise<CreateTripResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const user    = session?.user;
  const tid     = (user?.user_metadata?.tenant_id as string | undefined) ?? fallbackTenantId ?? null;
  const rid     = getStr(MMKV_KEYS.ACTIVE_ROUTE_ID) ?? '';
  const vid     = getStr(MMKV_KEYS.ACTIVE_VEHICLE_ID) ?? '';
  const rName   = getStr(MMKV_KEYS.ACTIVE_ROUTE_NAME) ?? 'Ruta';

  if (!user || !tid || !rid) {
    const reason = !user ? 'sin sesión' : !tid ? 'sin tenant_id' : 'sin route_id';
    return { tripId: null, error: `Datos insuficientes para crear viaje (${reason})` };
  }

  let originLat = 0, originLng = 0, destLat = 0, destLng = 0;
  const wpRaw = getStr(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS);
  if (wpRaw) {
    const wps = JSON.parse(wpRaw) as Array<{ lat: number; lng: number }>;
    if (wps.length >= 2) {
      originLat = wps[0].lat; originLng = wps[0].lng;
      destLat   = wps[wps.length - 1].lat; destLng = wps[wps.length - 1].lng;
    }
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      driver_id:   user.id,
      vehicle_id:  vid || null,
      route_id:    rid,
      tenant_id:   tid,
      origin_name: rName.split('→')[0]?.trim() || rName,
      origin_lat:  originLat, origin_lng: originLng,
      dest_name:   rName.split('→')[1]?.trim() || rName,
      dest_lat:    destLat,   dest_lng:   destLng,
      status:      'in_transit',
      started_at:  new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    return { tripId: null, error: error?.message ?? 'error desconocido' };
  }

  setStr(MMKV_KEYS.ACTIVE_TRIP_ID, data.id);
  return { tripId: data.id, error: null };
}
