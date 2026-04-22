// ─── MapScreen.tsx ────────────────────────────────────────────────────────────
// Mapa Google Maps centrado en la ubicación actual del conductor.
// Solo vista — el tracking activo ocurre en TrackingScreen.

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useTheme, darkMapStyle, lightMapStyle } from '@lib/ThemeContext';
import { ThemedStatusBar } from '@components/ui/ThemedStatusBar';

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
  const { isDark, colors } = useTheme();

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
      <ThemedStatusBar />
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        region={hasLocation ? region : undefined}
        showsUserLocation
        showsMyLocationButton={false}
        showsBuildings={false}
        customMapStyle={isDark ? darkMapStyle : lightMapStyle}
      >
        {hasLocation ? (
          <Marker
            coordinate={{ latitude: region.latitude, longitude: region.longitude }}
            title="Tu posición"
            pinColor={colors.accent}
          />
        ) : null}
      </MapView>

      {/* Botón centrar */}
      {hasLocation && (
        <TouchableOpacity
          style={[styles.centerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={centerOnMe}
          accessibilityLabel="Centrar en mi posición"
          accessibilityRole="button"
        >
          <Text style={[styles.centerBtnText, { color: colors.accent }]}>⊙</Text>
        </TouchableOpacity>
      )}

      {/* Aviso sin permisos */}
      {permissionDenied && (
        <View style={[styles.permBanner, { backgroundColor: colors.warning + '22', borderColor: colors.warning + '44' }]}>
          <Text style={[styles.permText, { color: colors.warning }]}>
            Activa los permisos de ubicación para ver tu posición.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centerBtn: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  centerBtnText: { fontSize: 22, fontWeight: '700' },
  permBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  permText: { fontSize: 13, textAlign: 'center' },
});
