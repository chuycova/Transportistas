// ─── MapScreen.tsx ────────────────────────────────────────────────────────────
// Mapa Google Maps centrado en la ubicación actual del conductor.
// Solo vista — el tracking activo ocurre en TrackingScreen.

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';

const DEFAULT_REGION: Region = {
  latitude: 20.6597,
  longitude: -103.3496,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [hasLocation, setHasLocation] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const r: Region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setRegion(r);
      setHasLocation(true);
    })();
  }, []);

  const centerOnMe = () => {
    if (hasLocation) mapRef.current?.animateToRegion(region, 500);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        region={hasLocation ? region : undefined}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={darkMapStyle}
      >
        {hasLocation ? (
          <Marker
            coordinate={{ latitude: region.latitude, longitude: region.longitude }}
            title="Tu posición"
            pinColor="#6C63FF"
          />
        ) : null}
      </MapView>

      {/* Botón centrar */}
      {hasLocation && (
        <TouchableOpacity
          style={styles.centerBtn}
          onPress={centerOnMe}
          accessibilityLabel="Centrar en mi posición"
          accessibilityRole="button"
        >
          <Text style={styles.centerBtnText}>⊙</Text>
        </TouchableOpacity>
      )}

      {/* Aviso sin permisos */}
      {permissionDenied && (
        <View style={styles.permBanner}>
          <Text style={styles.permText}>
            Activa los permisos de ubicación para ver tu posición.
          </Text>
        </View>
      )}
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0A0A0F' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8888AA' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1C1C2E' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2A2A3F' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A3A5C' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060610' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  map: { flex: 1 },
  centerBtn: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    backgroundColor: '#12121C',
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  centerBtnText: { color: '#6C63FF', fontSize: 22, fontWeight: '700' },
  permBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C1410',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#FF9F4444',
  },
  permText: { color: '#FFBB55', fontSize: 13, textAlign: 'center' },
});
