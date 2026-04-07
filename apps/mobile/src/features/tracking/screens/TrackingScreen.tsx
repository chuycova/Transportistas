// ─── TrackingScreen.tsx ───────────────────────────────────────────────────────
// Pantalla principal del conductor durante el tracking.
// Muestra el mapa con su posición actual y botón Start/Stop.

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Vibration,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { usePingSync } from '../hooks/usePingSync';
import { connectSocket, disconnectSocket, onDeviationAlert } from '@lib/socket';
import { saveLocalAlert } from '@lib/database';
import { getStr } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';
import { getAccessToken } from '@lib/supabase';
import type { RootStackParamList } from '@navigation/RootNavigator';

// Configurar cómo se presentan las notificaciones en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type TrackingRouteProp = RouteProp<RootStackParamList, 'Tracking'>;

export function TrackingScreen() {
  const route = useRoute<TrackingRouteProp>();
  const { routeId, routeName } = route.params;
  const mapRef = useRef<MapView>(null);

  const vehicleId = getStr(MMKV_KEYS.ACTIVE_VEHICLE_ID) ?? '';
  const tenantId  = getStr('tenantId') ?? '';

  const { isTracking, lastCoordinate, permissionStatus, error, startTracking, stopTracking } =
    useGpsTracking({ vehicleId, tenantId, routeId });

  // Sync de cola offline al reconectarse
  usePingSync();

  // ─── Conectar socket al montar ──────────────────────────────────────────
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    void (async () => {
      const token = await getAccessToken();
      if (!token) return;

      connectSocket(token);

      // Escuchar alertas de desvío desde el backend
      cleanup = onDeviationAlert(async (alert) => {
        Vibration.vibrate([0, 300, 100, 300]);

        // Guardar alerta local en WatermelonDB
        await saveLocalAlert({
          type: 'off_route',
          message: `Desvío detectado: ${Math.round(alert.deviationM)}m fuera de ruta`,
        });

        // Mostrar notificación local
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Desvío detectado',
            body: `Estás ${Math.round(alert.deviationM)}m fuera de la ruta. Regresa al trayecto.`,
            data: { type: 'deviation', ...alert },
          },
          trigger: null, // Mostrar inmediatamente
        });
      });
    })();

    return () => {
      cleanup?.();
      disconnectSocket();
    };
  }, []);

  // ─── Centrar mapa en nueva posición ────────────────────────────────────
  useEffect(() => {
    if (!lastCoordinate || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude:  lastCoordinate.lat,
        longitude: lastCoordinate.lng,
        latitudeDelta:  0.005,
        longitudeDelta: 0.005,
      } as Region,
      500,
    );
  }, [lastCoordinate]);

  const handleToggle = useCallback(async () => {
    if (isTracking) {
      Alert.alert(
        'Detener tracking',
        '¿Confirmas que quieres detener el seguimiento de ruta?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Detener', style: 'destructive', onPress: () => void stopTracking() },
        ],
      );
    } else {
      await startTracking();
    }
  }, [isTracking, startTracking, stopTracking]);

  const DEFAULT_REGION: Region = {
    latitude: 20.6597, // Centro de México como fallback
    longitude: -103.3496,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Mapa */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={
          lastCoordinate
            ? {
                latitude: lastCoordinate.lat,
                longitude: lastCoordinate.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }
            : DEFAULT_REGION
        }
        showsUserLocation={false}
        showsMyLocationButton={false}
        customMapStyle={darkMapStyle}
      >
        {lastCoordinate ? (
          <Marker
            coordinate={{ latitude: lastCoordinate.lat, longitude: lastCoordinate.lng }}
            title="Tu posición"
            pinColor="#6C63FF"
          />
        ) : null}
      </MapView>

      {/* Panel inferior */}
      <View style={styles.panel}>
        {/* Ruta activa */}
        <View style={styles.routeInfo}>
          <Text style={styles.routeLabel}>RUTA ACTIVA</Text>
          <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>
        </View>

        {/* Coordenadas */}
        {lastCoordinate ? (
          <Text style={styles.coords}>
            {lastCoordinate.lat.toFixed(6)}, {lastCoordinate.lng.toFixed(6)}
          </Text>
        ) : null}

        {/* Error */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Indicador de estado */}
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, isTracking ? styles.dotActive : styles.dotInactive]} />
          <Text style={styles.statusText}>
            {isTracking ? 'Tracking activo — enviando posición' : 'Tracking detenido'}
          </Text>
        </View>

        {/* Botón Start/Stop */}
        <TouchableOpacity
          style={[styles.trackingBtn, isTracking ? styles.btnStop : styles.btnStart]}
          onPress={handleToggle}
          accessibilityLabel={isTracking ? 'Detener tracking' : 'Iniciar tracking'}
          accessibilityRole="button"
        >
          <Text style={styles.trackingBtnText}>
            {isTracking ? '⏹  Detener tracking' : '▶  Iniciar tracking'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Estilo oscuro para Google Maps (compatible con el tema de la app)
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
  panel: {
    backgroundColor: '#12121C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#2A2A3F',
    gap: 12,
  },
  routeInfo: { gap: 2 },
  routeLabel: { color: '#6C63FF', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  routeName: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  coords: { color: '#4A4A6A', fontSize: 11, fontFamily: 'monospace' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#22C55E' },
  dotInactive: { backgroundColor: '#4A4A6A' },
  statusText: { color: '#8888AA', fontSize: 13 },
  trackingBtn: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 4,
  },
  btnStart: {
    backgroundColor: '#6C63FF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  btnStop: { backgroundColor: '#FF4444' },
  trackingBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  errorText: { color: '#FF6B6B', fontSize: 13 },
});
