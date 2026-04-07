'use client';
// ─── features/dashboard/traffic-layer.tsx ────────────────────────────────────
// Activa la capa de tráfico de Google Maps en tiempo real.
// No tiene costo adicional — está incluida en Maps JavaScript API.
// Usa useMap() de @vis.gl/react-google-maps para acceder al mapa nativo.

import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

export function TrafficLayer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // google.maps.TrafficLayer es la API nativa de Google Maps JS
    // Se renderiza encima del mapa base automáticamente
    const traffic = new google.maps.TrafficLayer();
    traffic.setMap(map);

    return () => {
      // Cleanup: quitar la capa del mapa al desmontar el componente
      traffic.setMap(null);
    };
  }, [map]);

  return null; // Sin UI propia — efecto en el mapa nativo
}
