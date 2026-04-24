// Mini-mapa Google Maps para el modal de detalle de ruta.
// Calcula la region inicial a partir del bounding-box de los waypoints.

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface RouteMapPreviewProps {
  waypoints: Array<{ lat: number; lng: number }>;
  stops?: Array<{ lat: number; lng: number; name: string }>;
  accentColor: string;
  height?: number;
}

export function RouteMapPreview({
  waypoints,
  stops = [],
  accentColor,
  height = 220,
}: RouteMapPreviewProps) {
  if (waypoints.length < 2) return null;

  const lats = waypoints.map((p) => p.lat);
  const lngs = waypoints.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const latDelta = (maxLat - minLat) * 1.35 || 0.01;
  const lngDelta = (maxLng - minLng) * 1.35 || 0.01;

  const region = {
    latitude:      (minLat + maxLat) / 2,
    longitude:     (minLng + maxLng) / 2,
    latitudeDelta:  latDelta,
    longitudeDelta: lngDelta,
  };

  const coords = waypoints.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={{ width: '100%', height }}
      initialRegion={region}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      mapType="standard"
      liteMode={Platform.OS === 'android'}
    >
      <Polyline
        coordinates={coords}
        strokeColor={accentColor}
        strokeWidth={3}
      />
      {/* Inicio */}
      <Marker coordinate={coords[0]!} anchor={{ x: 0.5, y: 0.5 }} flat>
        <View style={styles.dot} />
      </Marker>
      {/* Destino */}
      <Marker coordinate={coords[coords.length - 1]!} anchor={{ x: 0.5, y: 0.5 }} flat>
        <View style={[styles.dot, { backgroundColor: '#EF4444', width: 12, height: 12, borderRadius: 6 }]} />
      </Marker>
      {/* Paradas */}
      {stops.map((s, i) => (
        <Marker key={i} coordinate={{ latitude: s.lat, longitude: s.lng }} anchor={{ x: 0.5, y: 0.5 }} flat>
          <View style={[styles.dot, { backgroundColor: '#F59E0B', width: 8, height: 8, borderRadius: 4 }]} />
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', borderWidth: 1.5, borderColor: '#fff' },
});
