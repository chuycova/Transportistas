// ─── useInitialPosition.ts ────────────────────────────────────────────────────
// Obtiene un fix GPS al montar para que el marcador del conductor sea visible
// desde el primer momento, antes de iniciar tracking.

import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export function useInitialPosition(): { lat: number; lng: number } | null {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          setPosition({ lat: last.coords.latitude, lng: last.coords.longitude });
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setPosition({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {
        // Sin posicion inicial — el mapa mostrará la region default
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return position;
}
