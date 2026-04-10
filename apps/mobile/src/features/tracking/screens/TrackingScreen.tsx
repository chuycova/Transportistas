// ─── TrackingScreen.tsx ───────────────────────────────────────────────────────
// Pantalla principal del conductor durante el tracking.

import React, {
  useEffect, useRef, useCallback, useMemo, useState,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Vibration, Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Region, LatLng } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { usePingSync } from '../hooks/usePingSync';
import {
  connectSocket, disconnectSocket, onDeviationAlert, emitPanicAlert,
} from '@lib/socket';
import { API_URL, GOOGLE_MAPS_API_KEY, MMKV_KEYS } from '@lib/constants';
import { saveLocalAlert } from '@lib/database';
import { getStr } from '@lib/mmkv';
import { getAccessToken } from '@lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, b: number;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20);
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

async function fetchDirectionsToStart(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
): Promise<LatLng[]> {
  if (!GOOGLE_MAPS_API_KEY) return [];
  try {
    const url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin.lat},${origin.lng}` +
      `&destination=${dest.lat},${dest.lng}` +
      `&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      routes?: Array<{ overview_polyline: { points: string } }>;
    };
    if (data.status !== 'OK' || !data.routes?.[0]) return [];
    return decodePolyline(data.routes[0].overview_polyline.points);
  } catch { return []; }
}

// ─── Marcador del conductor ────────────────────────────────────────────────────
// Un único componente con dos estados visuales para evitar que React Native Maps
// pierda el marcador al cambiar entre un custom-view marker y un pinColor marker.
function DriverMarker({ active }: { active: boolean }) {
  return active ? (
    // Tracking activo: flecha direccional (estilo Waze)
    <View style={markerStyles.arrowWrapper}>
      <View style={markerStyles.halo} />
      <View style={markerStyles.tip} />
      <View style={markerStyles.body} />
    </View>
  ) : (
    // Tracking detenido: pin estático
    <View style={markerStyles.pinWrapper}>
      <View style={markerStyles.pinCircle} />
      <View style={markerStyles.pinTail} />
    </View>
  );
}

const markerStyles = StyleSheet.create({
  // Flecha
  arrowWrapper: { alignItems: 'center', width: 32, height: 44 },
  halo:         { position: 'absolute', width: 36, height: 36, borderRadius: 18, backgroundColor: '#6C63FF33', top: 8 },
  tip:          { width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 22, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#6C63FF' },
  body:         { width: 14, height: 14, borderRadius: 7, backgroundColor: '#6C63FF', borderWidth: 2, borderColor: '#fff', marginTop: -5 },
  // Pin estático
  pinWrapper:   { alignItems: 'center', width: 24, height: 36 },
  pinCircle:    { width: 20, height: 20, borderRadius: 10, backgroundColor: '#6C63FF', borderWidth: 2.5, borderColor: '#fff', shadowColor: '#6C63FF', shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  pinTail:      { width: 3, height: 12, backgroundColor: '#6C63FF', borderBottomLeftRadius: 2, borderBottomRightRadius: 2, marginTop: -1 },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
const PANIC_HOLD_MS = 5000;

export function TrackingScreen() {
  // Leer contexto de ruta desde MMKV (guardado por RoutesScreen al iniciar)
  const routeId   = getStr(MMKV_KEYS.ACTIVE_ROUTE_ID)   ?? '';
  const routeName = getStr(MMKV_KEYS.ACTIVE_ROUTE_NAME)  ?? 'Ruta activa';
  const mapRef       = useRef<MapView>(null);
  const navFetchedRef = useRef(false);

  // ── Panic hold state ───────────────────────────────────────────────────────
  const [panicHolding, setPanicHolding]     = useState(false);
  const [panicCountdown, setPanicCountdown] = useState(5);
  const panicTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panicIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panicScale       = useRef(new Animated.Value(1)).current;
  const panicAnim        = useRef<Animated.CompositeAnimation | null>(null);

  // ── Panel height (para posicionar el FAB de ubicación) ────────────────────
  const [panelHeight, setPanelHeight] = useState(230);

  const vehicleId = getStr(MMKV_KEYS.ACTIVE_VEHICLE_ID) ?? '';
  const tenantId  = getStr('tenantId') ?? '';

  const routeWaypoints = useMemo<LatLng[]>(() => {
    try {
      const raw = getStr(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS);
      if (!raw) return [];
      return (JSON.parse(raw) as Array<{ lat: number; lng: number }>)
        .map((p) => ({ latitude: p.lat, longitude: p.lng }));
    } catch { return []; }
  }, []);

  const routeStops = useMemo<Array<{ name: string; lat: number; lng: number; order: number }>>(() => {
    try {
      const raw = getStr(MMKV_KEYS.ACTIVE_ROUTE_STOPS);
      if (!raw) return [];
      return JSON.parse(raw) as Array<{ name: string; lat: number; lng: number; order: number }>;
    } catch { return []; }
  }, []);

  const { isTracking, lastCoordinate, heading, error, startTracking, stopTracking } =
    useGpsTracking({ vehicleId, tenantId, routeId });

  const [navToStartPath, setNavToStartPath] = useState<LatLng[]>([]);

  usePingSync();

  // ─── Socket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void (async () => {
      const token = await getAccessToken();
      if (!token) return;
      connectSocket(token);
      cleanup = onDeviationAlert(async (alert) => {
        Vibration.vibrate([0, 300, 100, 300]);
        await saveLocalAlert({ type: 'off_route', message: `Desvío detectado: ${Math.round(alert.deviationM)}m fuera de ruta` });
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⚠️ Desvío detectado',
            body: `Estás ${Math.round(alert.deviationM)}m fuera de la ruta. Regresa al trayecto.`,
            data: { type: 'deviation', ...alert },
          },
          trigger: null,
        });
      });
    })();
    return () => { cleanup?.(); disconnectSocket(); };
  }, []);

  // ─── Fit al montar ────────────────────────────────────────────────────────
  const handleMapReady = useCallback(() => {
    if (!mapRef.current || routeWaypoints.length < 2) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(routeWaypoints, {
        edgePadding: { top: 60, right: 40, bottom: 220, left: 40 },
        animated: true,
      });
    }, 300);
  }, [routeWaypoints]);

  // ─── Ruta de navegación al inicio ─────────────────────────────────────────
  useEffect(() => {
    if (!isTracking) { navFetchedRef.current = false; setNavToStartPath([]); return; }
    if (!lastCoordinate || routeWaypoints.length === 0) return;
    const startPoint = routeWaypoints[0]!;
    const dist = haversineDistance(
      { lat: lastCoordinate.lat, lng: lastCoordinate.lng },
      { lat: startPoint.latitude, lng: startPoint.longitude },
    );
    if (dist < 50) { setNavToStartPath([]); navFetchedRef.current = false; return; }
    if (navFetchedRef.current) return;
    navFetchedRef.current = true;
    void fetchDirectionsToStart(
      { lat: lastCoordinate.lat, lng: lastCoordinate.lng },
      { lat: startPoint.latitude, lng: startPoint.longitude },
    ).then(setNavToStartPath);
  }, [isTracking, lastCoordinate, routeWaypoints]);

  // ─── Centrar en posición del conductor ────────────────────────────────────
  useEffect(() => {
    if (!lastCoordinate || !mapRef.current || !isTracking) return;
    mapRef.current.animateToRegion(
      { latitude: lastCoordinate.lat, longitude: lastCoordinate.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 } as Region,
      500,
    );
  }, [lastCoordinate, isTracking]);

  // ─── Centrar en mi posición (botón FAB) ───────────────────────────────────
  const handleCenterOnMe = useCallback(() => {
    if (!lastCoordinate || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { latitude: lastCoordinate.lat, longitude: lastCoordinate.lng, latitudeDelta: 0.003, longitudeDelta: 0.003 } as Region,
      400,
    );
  }, [lastCoordinate]);

  // ─── Pánico: envío real ───────────────────────────────────────────────────
  const triggerPanic = useCallback(async () => {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
    const payload = {
      vehicleId,
      coordinate: lastCoordinate ? { lat: lastCoordinate.lat, lng: lastCoordinate.lng } : undefined,
    };
    const sent = emitPanicAlert(payload);
    if (!sent) {
      try {
        const token = await getAccessToken();
        await fetch(`${API_URL}/api/v1/tracking/panic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(payload),
        });
      } catch { /* fallback silencioso */ }
    }
    await saveLocalAlert({ type: 'off_route', message: 'SOS enviado — se ha notificado al centro de control' });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🆘 SOS Enviado',
        body: 'Centro de control notificado. Mantén la calma.',
        data: { type: 'panic' },
      },
      trigger: null,
    });
    Alert.alert('🆘 SOS Enviado', 'Centro de control notificado. Mantén la calma.');
  }, [vehicleId, lastCoordinate]);

  // ─── Pánico: iniciar hold ─────────────────────────────────────────────────
  const handlePanicPressIn = useCallback(() => {
    if (!isTracking) return;
    setPanicHolding(true);
    setPanicCountdown(5);
    Vibration.vibrate(40);

    // Animación de pulso
    panicAnim.current = Animated.loop(
      Animated.sequence([
        Animated.timing(panicScale, { toValue: 1.15, duration: 250, useNativeDriver: true }),
        Animated.timing(panicScale, { toValue: 1.0,  duration: 250, useNativeDriver: true }),
      ]),
    );
    panicAnim.current.start();

    // Countdown cada segundo
    let count = 5;
    panicIntervalRef.current = setInterval(() => {
      count -= 1;
      setPanicCountdown(count);
      Vibration.vibrate(30);
    }, 1000);

    // Disparo a los 5s
    panicTimerRef.current = setTimeout(() => {
      cancelPanicHold();
      void triggerPanic();
    }, PANIC_HOLD_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking, triggerPanic, panicScale]);

  const cancelPanicHold = useCallback(() => {
    if (panicTimerRef.current)    { clearTimeout(panicTimerRef.current);     panicTimerRef.current    = null; }
    if (panicIntervalRef.current) { clearInterval(panicIntervalRef.current); panicIntervalRef.current = null; }
    panicAnim.current?.stop();
    Animated.timing(panicScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setPanicHolding(false);
    setPanicCountdown(5);
  }, [panicScale]);

  const handlePanicPressOut = useCallback(() => {
    cancelPanicHold();
  }, [cancelPanicHold]);

  // ─── Toggle tracking ──────────────────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    if (isTracking) {
      Alert.alert('Detener tracking', '¿Confirmas que quieres detener el seguimiento?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Detener', style: 'destructive', onPress: () => void stopTracking() },
      ]);
    } else {
      await startTracking();
    }
  }, [isTracking, startTracking, stopTracking]);

  const DEFAULT_REGION: Region = { latitude: 20.6597, longitude: -103.3496, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Mapa ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        onMapReady={handleMapReady}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsTraffic={true}
        customMapStyle={darkMapStyle}
      >
        {/* Ruta planificada (morada) */}
        {routeWaypoints.length >= 2 && (
          <Polyline coordinates={routeWaypoints} strokeColor="#6C63FF" strokeWidth={5} />
        )}

        {/* Ruta de navegación al inicio (azul punteada) */}
        {navToStartPath.length >= 2 && (
          <Polyline coordinates={navToStartPath} strokeColor="#38BDF8" strokeWidth={4} lineDashPattern={[12, 8]} />
        )}

        {/* Origen */}
        {routeWaypoints.length > 0 && (
          <Marker coordinate={routeWaypoints[0]!} title="Inicio de ruta" pinColor="#22C55E" />
        )}
        {/* Destino */}
        {routeWaypoints.length > 1 && (
          <Marker coordinate={routeWaypoints[routeWaypoints.length - 1]!} title="Destino" pinColor="#EF4444" />
        )}
        {/* Paradas */}
        {routeStops.map((stop, i) => (
          <Marker
            key={`stop-${i}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            title={`${stop.order}. ${stop.name}`}
            pinColor="#F59E0B"
          />
        ))}

        {/* Marcador del conductor — siempre el mismo Marker para evitar drops al cambiar estado */}
        {lastCoordinate ? (
          <Marker
            coordinate={{ latitude: lastCoordinate.lat, longitude: lastCoordinate.lng }}
            anchor={{ x: 0.5, y: isTracking ? 0.5 : 0.8 }}
            flat={isTracking}
            rotation={isTracking ? (heading ?? 0) : 0}
            zIndex={10}
            tracksViewChanges={false}
          >
            <DriverMarker active={isTracking} />
          </Marker>
        ) : null}
      </MapView>

      {/* ── FAB Pánico (top-right, solo durante tracking) ── */}
      {isTracking && (
        <Animated.View style={[styles.panicFab, { transform: [{ scale: panicScale }] }]}>
          <TouchableOpacity
            onPressIn={handlePanicPressIn}
            onPressOut={handlePanicPressOut}
            activeOpacity={0.85}
            style={[styles.panicFabInner, panicHolding && styles.panicFabHolding]}
            accessibilityLabel="Botón de pánico — mantén 5 segundos"
            accessibilityRole="button"
          >
            {panicHolding ? (
              <Text style={styles.panicFabCountdown}>{panicCountdown}</Text>
            ) : (
              <Text style={styles.panicFabIcon}>🆘</Text>
            )}
            <Text style={styles.panicFabLabel}>{panicHolding ? 'SOS...' : 'SOS'}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── FAB Mi ubicación (bottom-right, sobre el panel) ── */}
      {lastCoordinate && (
        <TouchableOpacity
          style={[styles.locationFab, { bottom: panelHeight + 16 }]}
          onPress={handleCenterOnMe}
          accessibilityLabel="Centrar en mi posición"
          accessibilityRole="button"
        >
          <Text style={styles.locationFabIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {/* ── Panel inferior ── */}
      <View
        style={styles.panel}
        onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.panelHandle} />

        <View style={styles.routeInfo}>
          <Text style={styles.routeLabel}>RUTA ACTIVA</Text>
          <Text style={styles.routeName} numberOfLines={1}>{routeName}</Text>
        </View>

        {isTracking && navToStartPath.length > 0 && (
          <View style={styles.navHint}>
            <View style={styles.navHintDot} />
            <Text style={styles.navHintText}>Navega al inicio de la ruta</Text>
          </View>
        )}

        {lastCoordinate ? (
          <Text style={styles.coords}>
            {lastCoordinate.lat.toFixed(6)}, {lastCoordinate.lng.toFixed(6)}
            {heading != null ? `  •  ${Math.round(heading)}°` : ''}
          </Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, isTracking ? styles.dotActive : styles.dotInactive]} />
          <Text style={styles.statusText}>
            {isTracking ? 'Tracking activo — enviando posición' : 'Tracking detenido'}
          </Text>
        </View>

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

// Estilo oscuro para Google Maps
const darkMapStyle = [
  { elementType: 'geometry',          stylers: [{ color: '#0A0A0F' }] },
  { elementType: 'labels.text.fill',  stylers: [{ color: '#8888AA' }] },
  { elementType: 'labels.text.stroke',stylers: [{ color: '#0A0A0F' }] },
  { featureType: 'road',              elementType: 'geometry', stylers: [{ color: '#1C1C2E' }] },
  { featureType: 'road.arterial',     elementType: 'geometry', stylers: [{ color: '#2A2A3F' }] },
  { featureType: 'road.highway',      elementType: 'geometry', stylers: [{ color: '#3A3A5C' }] },
  { featureType: 'water',             elementType: 'geometry', stylers: [{ color: '#060610' }] },
  { featureType: 'poi',               stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',           stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  map: { flex: 1 },

  // ── FAB Pánico ──────────────────────────────────────────────────────────────
  panicFab: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 20,
  },
  panicFabInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#7F0000',
    borderWidth: 2.5,
    borderColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 12,
  },
  panicFabHolding: {
    backgroundColor: '#CC0000',
    borderColor: '#FF4444',
  },
  panicFabIcon:       { fontSize: 22 },
  panicFabCountdown:  { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 28 },
  panicFabLabel:      { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 1 },

  // ── FAB Mi ubicación ────────────────────────────────────────────────────────
  locationFab: {
    position: 'absolute',
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#12121C',
    borderWidth: 1.5,
    borderColor: '#3A3A5C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 20,
  },
  locationFabIcon: { color: '#6C63FF', fontSize: 22 },

  // ── Panel ───────────────────────────────────────────────────────────────────
  panel: {
    backgroundColor: '#12121C',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
    gap: 12,
  },
  panelHandle: {
    width: 48, height: 5, borderRadius: 3,
    backgroundColor: '#2A2A3F', alignSelf: 'center', marginBottom: 4,
  },
  routeInfo:    { gap: 2 },
  routeLabel:   { color: '#6C63FF', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  routeName:    { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  navHint:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navHintDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: '#38BDF8' },
  navHintText:  { color: '#38BDF8', fontSize: 13, fontWeight: '600' },
  coords:       { color: '#4A4A6A', fontSize: 11, fontFamily: 'monospace' },
  statusRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  dotActive:    { backgroundColor: '#22C55E' },
  dotInactive:  { backgroundColor: '#4A4A6A' },
  statusText:   { color: '#8888AA', fontSize: 13 },
  trackingBtn:  { borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 4 },
  btnStart: {
    backgroundColor: '#6C63FF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  btnStop:         { backgroundColor: '#FF4444' },
  trackingBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  errorText:       { color: '#FF6B6B', fontSize: 13 },
});
