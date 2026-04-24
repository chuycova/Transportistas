import type { LatLng } from 'react-native-maps';
import { GOOGLE_MAPS_API_KEY } from '@lib/constants';
import { decodePolyline } from './geo';

export async function fetchDirectionsToStart(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<LatLng[]> {
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${origin.lat},${origin.lng}` +
        `&destination=${dest.lat},${dest.lng}` +
        `&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      const res  = await fetch(url);
      const data = (await res.json()) as {
        status: string;
        routes?: Array<{ overview_polyline: { points: string } }>;
      };
      if (data.status === 'OK' && data.routes?.[0]) {
        return decodePolyline(data.routes[0].overview_polyline.points);
      }
    } catch { /* fallback below */ }
  }
  return [
    { latitude: origin.lat, longitude: origin.lng },
    { latitude: dest.lat,   longitude: dest.lng   },
  ];
}
