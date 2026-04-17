// ─── TrackingScreen.tsx ───────────────────────────────────────────────────────
// Pantalla principal del conductor durante el tracking.
// Panel inferior implementado con @gorhom/bottom-sheet:
//   - Antes de iniciar: snap al 40 % (panel completo con botón "Iniciar")
//   - Durante tracking: colapsa a ~15 % (strip minimalista con Stop + velocidad)
//   - Al deslizar hacia arriba: expande a 65 % con info completa + adjuntar imágenes

import React, {
  useEffect, useRef, useCallback, useMemo, useState,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Vibration, Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Region, LatLng } from 'react-native-maps';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import BottomSheet, {
  BottomSheetView, BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { usePingSync } from '../hooks/usePingSync';
import { useCheckpoints } from '../hooks/useCheckpoints';
import { ReportIncidentModal } from '@features/incidents/components/ReportIncidentModal';
import {
  connectSocket, disconnectSocket, onDeviationAlert, emitPanicAlert,
} from '@lib/socket';
import { API_URL, GOOGLE_MAPS_API_KEY, MMKV_KEYS } from '@lib/constants';
import { saveLocalAlert } from '@lib/database';
import { getStr } from '@lib/mmkv';
import { getAccessToken } from '@lib/supabase';
import { usePermissions } from '@lib/usePermissions';
import { PermissionsGateScreen } from '@components/ui/PermissionsGateScreen';
import Animated, {
  useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';

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

// ─── Marcador del conductor ───────────────────────────────────────────────────
// En Android, <Marker flat rotation> con children View requiere dimensiones
// EXPLÍCITAS en el wrapper, de lo contrario el renderizado falla y usa el
// pin nativo por defecto. Nunca dejar width/height como 'auto' o sin definir.
function DriverMarker({ active }: { active: boolean }) {
  if (active) {
    return (
      <View style={markerStyles.arrowWrapper}>
        <View style={markerStyles.halo} />
        <View style={markerStyles.tip} />
        <View style={markerStyles.body} />
      </View>
    );
  }
  return (
    <View style={markerStyles.pinWrapper}>
      <View style={markerStyles.pinCircle} />
      <View style={markerStyles.pinTail} />
    </View>
  );
}

const markerStyles = StyleSheet.create({
  // ── activo: flecha
  arrowWrapper: {
    width: 32, height: 44, alignItems: 'center',
    // Android necesita overflow visible para que el halo no se corte
    overflow: Platform.OS === 'android' ? 'visible' : 'visible',
  },
  halo: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#6C63FF33', top: 8,
  },
  tip: {
    width: 0, height: 0,
    borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 22,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#6C63FF',
  },
  body: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#6C63FF', borderWidth: 2, borderColor: '#fff',
    marginTop: -5,
  },
  // ── inactivo: pin
  pinWrapper: { width: 24, height: 36, alignItems: 'center' },
  pinCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#6C63FF', borderWidth: 2.5, borderColor: '#fff',
    elevation: 6,
  },
  pinTail: {
    width: 3, height: 12, backgroundColor: '#6C63FF',
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2, marginTop: -1,
  },
});


// ─── Constantes del panel ─────────────────────────────────────────────────────
//   Índices de snap:  0 = colapsado  |  1 = medio  |  2 = expandido
const SNAP_IDLE        = ['40%'];             // Sin tracking: solo punto de snap
const SNAP_TRACKING    = ['15%', '42%', '68%']; // Tracking: mini | medio | expandido

const PANIC_HOLD_MS = 5000;

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export function TrackingScreen() {
  const {
    allRequiredGranted,
    permissions,
    loading: permLoading,
    requestAll,
    refresh: refreshPerms,
  } = usePermissions();
  const routeId   = getStr(MMKV_KEYS.ACTIVE_ROUTE_ID)   ?? '';
  const routeName = getStr(MMKV_KEYS.ACTIVE_ROUTE_NAME)  ?? 'Ruta activa';

  const mapRef        = useRef<MapView>(null);
  const navFetchedRef = useRef(false);
  const sheetRef      = useRef<BottomSheet>(null);

  // ── Panic ─────────────────────────────────────────────────────────────────
  const [panicHolding, setPanicHolding]     = useState(false);
  const [panicCountdown, setPanicCountdown] = useState(5);
  const panicTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panicIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const panicPulse       = useSharedValue(1);

  const panicStyle = useAnimatedStyle(() => ({
    transform: [{ scale: panicPulse.value }],
  }));

  // ── Incidentes ────────────────────────────────────────────────────────────
  const [incidentModalVisible, setIncidentModalVisible] = useState(false);

  // ── Tracking ──────────────────────────────────────────────────────────────
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

  const tripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID) ?? undefined;

  const { isTracking, lastCoordinate, heading, error, startTracking, stopTracking } =
    useGpsTracking({ vehicleId, tenantId, routeId, tripId });

  const { statuses: checkpointStatuses, nextCheckpoint, mandatoryTotal, mandatoryVisited } =
    useCheckpoints({
      routeId:      routeId || undefined,
      tripId,
      currentCoord: lastCoordinate ? { lat: lastCoordinate.lat, lng: lastCoordinate.lng } : null,
      enabled:      isTracking,
    });

  const [navToStartPath, setNavToStartPath] = useState<LatLng[]>([]);

  usePingSync();

  // ── Sheet: ajustar snap al cambiar estado de tracking ────────────────────
  useEffect(() => {
    if (isTracking) {
      sheetRef.current?.snapToIndex(0); // colapsa a mini
    } else {
      sheetRef.current?.snapToIndex(0); // vuelve al único snap "idle"
    }
  }, [isTracking]);

  // ── Socket ────────────────────────────────────────────────────────────────
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

  // ── Fit al mapa ───────────────────────────────────────────────────────────
  const handleMapReady = useCallback(() => {
    if (!mapRef.current || routeWaypoints.length < 2) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(routeWaypoints, {
        edgePadding: { top: 60, right: 40, bottom: 220, left: 40 },
        animated: true,
      });
    }, 300);
  }, [routeWaypoints]);

  // ── Ruta de navegación al inicio ─────────────────────────────────────────
  // Effect 1: reset al parar tracking (no incluye lastCoordinate para evitar
  // que se dispare con cada ping GPS cuando isTracking=false)
  useEffect(() => {
    if (!isTracking) {
      navFetchedRef.current = false;
      setNavToStartPath([]);
    }
  }, [isTracking]);

  // Effect 2: fetch de la ruta al primer punto.
  // Separado para que reaccione cuando lastCoordinate llega (Android tarda ~2-3 s
  // en dar el primer fix después de startTracking, por lo que el effect combinado
  // salía con lastCoordinate=null y no volvía a ejecutar el fetch).
  useEffect(() => {
    if (!isTracking || !lastCoordinate || routeWaypoints.length === 0) return;
    if (navFetchedRef.current) return;
    const startPoint = routeWaypoints[0]!;
    const dist = haversineDistance(
      { lat: lastCoordinate.lat, lng: lastCoordinate.lng },
      { lat: startPoint.latitude, lng: startPoint.longitude },
    );
    // Ya estamos cerca del inicio — no necesitamos navegar
    if (dist < 50) { navFetchedRef.current = true; return; }
    navFetchedRef.current = true;
    void fetchDirectionsToStart(
      { lat: lastCoordinate.lat, lng: lastCoordinate.lng },
      { lat: startPoint.latitude, lng: startPoint.longitude },
    ).then(setNavToStartPath);
  }, [isTracking, lastCoordinate, routeWaypoints]);

  // ── Centrar conductor ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastCoordinate || !mapRef.current || !isTracking) return;
    mapRef.current.animateToRegion(
      { latitude: lastCoordinate.lat, longitude: lastCoordinate.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 } as Region,
      500,
    );
  }, [lastCoordinate, isTracking]);

  const handleCenterOnMe = useCallback(() => {
    if (!lastCoordinate || !mapRef.current) return;
    mapRef.current.animateToRegion(
      { latitude: lastCoordinate.lat, longitude: lastCoordinate.lng, latitudeDelta: 0.003, longitudeDelta: 0.003 } as Region,
      400,
    );
  }, [lastCoordinate]);

  // ── Pánico ────────────────────────────────────────────────────────────────
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
      content: { title: '🆘 SOS Enviado', body: 'Centro de control notificado. Mantén la calma.', data: { type: 'panic' } },
      trigger: null,
    });
    Alert.alert('🆘 SOS Enviado', 'Centro de control notificado. Mantén la calma.');
  }, [vehicleId, lastCoordinate]);

  const cancelPanicHold = useCallback(() => {
    if (panicTimerRef.current)    { clearTimeout(panicTimerRef.current);     panicTimerRef.current    = null; }
    if (panicIntervalRef.current) { clearInterval(panicIntervalRef.current); panicIntervalRef.current = null; }
    panicPulse.value = withTiming(1, { duration: 200 });
    setPanicHolding(false);
    setPanicCountdown(5);
  }, [panicPulse]);

  const handlePanicPressIn = useCallback(() => {
    if (!isTracking) return;
    setPanicHolding(true);
    setPanicCountdown(5);
    Vibration.vibrate(40);

    // Pulso reanimated
    const pulse = () => {
      panicPulse.value = withTiming(1.18, { duration: 250 }, (done) => {
        if (done) panicPulse.value = withTiming(1.0, { duration: 250 }, (d) => { if (d) pulse(); });
      });
    };
    pulse();

    let count = 5;
    panicIntervalRef.current = setInterval(() => {
      count -= 1;
      setPanicCountdown(count);
      Vibration.vibrate(30);
    }, 1000);

    panicTimerRef.current = setTimeout(() => {
      cancelPanicHold();
      void triggerPanic();
    }, PANIC_HOLD_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking, triggerPanic]);

  const handlePanicPressOut = useCallback(() => cancelPanicHold(), [cancelPanicHold]);

  // ── Toggle tracking ───────────────────────────────────────────────────────
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

  // ─── Render ──────────────────────────────────────────────────────────────
  // Si los permisos requeridos no están concedidos, mostrar pantalla de guía
  if (!permLoading && !allRequiredGranted) {
    return (
      <PermissionsGateScreen
        permissions={permissions}
        loading={permLoading}
        onRequestAll={requestAll}
        onRefresh={refreshPerms}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Mapa (fondo completo) ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        onMapReady={handleMapReady}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsTraffic={true}
        showsBuildings={false}
        customMapStyle={darkMapStyle}
      >
        {routeWaypoints.length >= 2 && (
          <Polyline coordinates={routeWaypoints} strokeColor="#6C63FF" strokeWidth={5} />
        )}
        {navToStartPath.length >= 2 && (
          <Polyline coordinates={navToStartPath} strokeColor="#38BDF8" strokeWidth={4} lineDashPattern={[12, 8]} />
        )}
        {routeWaypoints.length > 0 && (
          <Marker coordinate={routeWaypoints[0]!} title="Inicio de ruta" pinColor="#22C55E" />
        )}
        {routeWaypoints.length > 1 && (
          <Marker coordinate={routeWaypoints[routeWaypoints.length - 1]!} title="Destino" pinColor="#EF4444" />
        )}
        {routeStops.map((stop, i) => (
          <Marker
            key={`stop-${i}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            title={`${stop.order}. ${stop.name}`}
            pinColor="#F59E0B"
          />
        ))}
        {checkpointStatuses.map(({ checkpoint: cp, visited }) => {
          const isNext   = nextCheckpoint?.id === cp.id;
          const bgColor  = visited ? '#10B981' : isNext ? '#F59E0B' : cp.is_mandatory ? '#6C63FF' : '#4A4A6A';
          return (
            <Marker
              key={`cp-${cp.id}`}
              coordinate={{ latitude: cp.lat, longitude: cp.lng }}
              title={`${cp.order_index}. ${cp.name}`}
              description={visited ? 'Visitado ✓' : cp.is_mandatory ? 'Obligatorio' : 'Opcional'}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View style={[cpMarkerStyles.badge, { backgroundColor: bgColor, borderColor: visited ? '#10B98166' : isNext ? '#F59E0B99' : '#6C63FF66' }]}>
                {visited
                  ? <Text style={cpMarkerStyles.tick}>✓</Text>
                  : <Text style={cpMarkerStyles.num}>{cp.order_index}</Text>
                }
              </View>
            </Marker>
          );
        })}
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
        <Animated.View style={[styles.panicFab, panicStyle]}>
          <TouchableOpacity
            onPressIn={handlePanicPressIn}
            onPressOut={handlePanicPressOut}
            activeOpacity={0.85}
            style={[styles.panicFabInner, panicHolding && styles.panicFabHolding]}
            accessibilityLabel="Botón de pánico — mantén 5 segundos"
            accessibilityRole="button"
          >
            {panicHolding
              ? <Text style={styles.panicFabCountdown}>{panicCountdown}</Text>
              : <Text style={styles.panicFabIcon}>🆘</Text>
            }
            <Text style={styles.panicFabLabel}>{panicHolding ? 'SOS...' : 'SOS'}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── FAB Mi ubicación ── */}
      {lastCoordinate && (
        <TouchableOpacity
          style={styles.locationFab}
          onPress={handleCenterOnMe}
          accessibilityLabel="Centrar en mi posición"
          accessibilityRole="button"
        >
          <Text style={styles.locationFabIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {/* ── Bottom Sheet ── */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={isTracking ? SNAP_TRACKING : SNAP_IDLE}
        index={0}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
        enablePanDownToClose={false}
      >
        {isTracking ? (
          // ─── Contenido TRACKING: scrolleable para el snap expandido ────
          <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
            {/* Strip superior siempre visible */}
            <View style={styles.trackingStrip}>
              <View style={styles.stripLeft}>
                <View style={styles.activeDot} />
                <View>
                  <Text style={styles.stripRouteName} numberOfLines={1}>{routeName}</Text>
                  {lastCoordinate?.speed != null && (
                    <Text style={styles.stripSpeed}>
                      {Math.round((lastCoordinate.speed ?? 0) * 3.6)} km/h
                    </Text>
                  )}
                </View>
              </View>

              {/* Botón Stop minimalista */}
              <TouchableOpacity
                style={styles.stopBtn}
                onPress={() => void handleToggle()}
                accessibilityLabel="Detener tracking"
                accessibilityRole="button"
              >
                <View style={styles.stopBtnSquare} />
                <Text style={styles.stopBtnLabel}>Parar</Text>
              </TouchableOpacity>
            </View>

            {/* ─── Contenido expandido (scroll) ─────────────────────────── */}
            <View style={styles.expandedSection}>

              {/* Hint de navegación */}
              {navToStartPath.length > 0 && (
                <View style={styles.navHint}>
                  <View style={styles.navHintDot} />
                  <Text style={styles.navHintText}>Navega al inicio de la ruta</Text>
                </View>
              )}

              {/* Coordenadas */}
              {lastCoordinate && (
                <Text style={styles.coords}>
                  {lastCoordinate.lat.toFixed(6)}, {lastCoordinate.lng.toFixed(6)}
                  {heading != null ? `  •  ${Math.round(heading)}°` : ''}
                </Text>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* ── Sección: Checkpoints ── */}
              {checkpointStatuses.length > 0 && (
                <View style={styles.checkpointsSection}>
                  <View style={styles.cpHeader}>
                    <Text style={styles.cpTitle}>Checkpoints</Text>
                    {mandatoryTotal > 0 && (
                      <View style={[styles.cpProgressBadge, mandatoryVisited === mandatoryTotal && styles.cpProgressComplete]}>
                        <Text style={[styles.cpProgressText, mandatoryVisited === mandatoryTotal && styles.cpProgressTextComplete]}>
                          {mandatoryVisited}/{mandatoryTotal}
                        </Text>
                      </View>
                    )}
                  </View>
                  {checkpointStatuses.map(({ checkpoint: cp, visited }) => {
                    const isNext = nextCheckpoint?.id === cp.id;
                    return (
                      <View key={cp.id} style={[styles.cpRow, visited && styles.cpRowVisited]}>
                        <View style={[styles.cpBadge,
                          visited  && styles.cpBadgeVisited,
                          isNext   && styles.cpBadgeNext,
                          !cp.is_mandatory && !visited && styles.cpBadgeOptional,
                        ]}>
                          <Text style={[styles.cpBadgeText, visited && styles.cpBadgeTextVisited]}>
                            {visited ? '✓' : String(cp.order_index)}
                          </Text>
                        </View>
                        <View style={styles.cpRowContent}>
                          <Text style={[styles.cpName, visited && styles.cpNameVisited]}
                            numberOfLines={1}>{cp.name}</Text>
                          {!cp.is_mandatory && (
                            <Text style={styles.cpOptionalLabel}>opcional</Text>
                          )}
                        </View>
                        {isNext && !visited && (
                          <View style={styles.cpNextBadge}>
                            <Text style={styles.cpNextText}>PRÓXIMO</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* ── Sección: Reportar incidente ── */}
              <TouchableOpacity
                style={styles.incidentBtn}
                onPress={() => setIncidentModalVisible(true)}
                accessibilityLabel="Reportar incidente"
                accessibilityRole="button"
              >
                <Text style={styles.incidentBtnIcon}>⚠️</Text>
                <Text style={styles.incidentBtnText}>Reportar incidente</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetScrollView>
        ) : (
          // ─── Contenido IDLE (sin tracking) ───────────────────────────
          <BottomSheetView style={styles.sheetContent}>
            <View style={styles.idleContent}>
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>RUTA ASIGNADA</Text>
                <Text style={styles.routeName} numberOfLines={2}>{routeName}</Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.startBtn}
                onPress={() => void handleToggle()}
                accessibilityLabel="Iniciar tracking"
                accessibilityRole="button"
              >
                <View style={styles.startBtnDot} />
                <Text style={styles.startBtnText}>Iniciar ruta</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetView>
        )}
      </BottomSheet>

      {/* ── Modal de incidente ── */}
      <ReportIncidentModal
        visible={incidentModalVisible}
        onClose={() => setIncidentModalVisible(false)}
        tripId={tripId}
        vehicleId={vehicleId}
        lat={lastCoordinate?.lat}
        lng={lastCoordinate?.lng}
      />
    </View>
  );
}

// ─── Estilos oscuros para Google Maps ─────────────────────────────────────────
const darkMapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#0A0A0F' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8888AA' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0F' }] },
  { featureType: 'road',               elementType: 'geometry', stylers: [{ color: '#1C1C2E' }] },
  { featureType: 'road.arterial',      elementType: 'geometry', stylers: [{ color: '#2A2A3F' }] },
  { featureType: 'road.highway',       elementType: 'geometry', stylers: [{ color: '#3A3A5C' }] },
  { featureType: 'water',              elementType: 'geometry', stylers: [{ color: '#060610' }] },
  { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
];

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  map:       { flex: 1 },

  // ── FAB Pánico ──────────────────────────────────────────────────────────────
  panicFab: {
    position: 'absolute', top: 56, right: 20, zIndex: 20,
  },
  panicFabInner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#7F0000', borderWidth: 2.5, borderColor: '#FF0000',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF0000', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 12, elevation: 12,
  },
  panicFabHolding:   { backgroundColor: '#CC0000', borderColor: '#FF4444' },
  panicFabIcon:      { fontSize: 20 },
  panicFabCountdown: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 26 },
  panicFabLabel:     { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginTop: 1 },

  // ── FAB Mi ubicación ────────────────────────────────────────────────────────
  locationFab: {
    position: 'absolute', bottom: '20%', right: 20,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#12121C', borderWidth: 1.5, borderColor: '#3A3A5C',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 8, zIndex: 20,
  },
  locationFabIcon: { color: '#6C63FF', fontSize: 22 },

  // ── Bottom Sheet ────────────────────────────────────────────────────────────
  sheetBg:     { backgroundColor: '#12121C', borderRadius: 28 },
  sheetHandle: { backgroundColor: '#3A3A5C', width: 40 },
  sheetContent:{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },

  // ── Strip de tracking (siempre visible cuando tracking) ─────────────────────
  trackingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  stripLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1,
  },
  activeDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E',
    shadowColor: '#22C55E', shadowOpacity: 0.8, shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  stripRouteName: {
    color: '#FFFFFF', fontSize: 14, fontWeight: '600',
    maxWidth: 200,
  },
  stripSpeed: {
    color: '#8888AA', fontSize: 12, marginTop: 1,
  },

  // Botón Stop minimalista
  stopBtn: {
    alignItems: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, backgroundColor: '#FF444420',
    borderWidth: 1, borderColor: '#FF444460',
  },
  stopBtnSquare: {
    width: 14, height: 14, borderRadius: 3, backgroundColor: '#FF4444',
  },
  stopBtnLabel: {
    color: '#FF4444', fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
  },

  // ── Contenido expandido ──────────────────────────────────────────────────────
  expandedSection: {
    gap: 14,
    paddingTop: 4,
    borderTopWidth: 1, borderTopColor: '#1E1E2E',
  },
  navHint:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navHintDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#38BDF8' },
  navHintText: { color: '#38BDF8', fontSize: 13, fontWeight: '600' },
  coords:      { color: '#4A4A6A', fontSize: 11, fontFamily: 'monospace' },
  errorText:   { color: '#FF6B6B', fontSize: 13 },

  // ── Botón de reportar incidente (en sheet expandido) ─────────────────────────
  incidentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F9731620',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F9731640',
  },
  incidentBtnIcon: { fontSize: 18 },
  incidentBtnText: { color: '#F97316', fontSize: 14, fontWeight: '700' },

  // ── (unused placeholder — cpMarkerStyles defined separately below) ──────────

  // ── Checkpoints ─────────────────────────────────────────────────────────────
  checkpointsSection: {
    backgroundColor: '#0A0A0F', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#2A2A3F', gap: 8,
  },
  cpHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  cpTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cpProgressBadge: {
    backgroundColor: '#6C63FF22', borderRadius: 20, borderWidth: 1, borderColor: '#6C63FF44',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  cpProgressComplete: { backgroundColor: '#10B98122', borderColor: '#10B98144' },
  cpProgressText: { color: '#6C63FF', fontSize: 11, fontWeight: '700' },
  cpProgressTextComplete: { color: '#10B981' },
  cpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#1A1A2E',
  },
  cpRowVisited: { opacity: 0.55 },
  cpBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#6C63FF22',
    borderWidth: 1, borderColor: '#6C63FF44', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cpBadgeVisited:  { backgroundColor: '#10B98122', borderColor: '#10B98144' },
  cpBadgeNext:     { backgroundColor: '#F59E0B22', borderColor: '#F59E0B44' },
  cpBadgeOptional: { backgroundColor: '#2A2A3F',   borderColor: '#3A3A5C' },
  cpBadgeText:        { color: '#6C63FF', fontSize: 11, fontWeight: '700' },
  cpBadgeTextVisited: { color: '#10B981' },
  cpRowContent: { flex: 1 },
  cpName:        { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  cpNameVisited: { color: '#4A4A6A' },
  cpOptionalLabel: { color: '#4A4A6A', fontSize: 10, marginTop: 1 },
  cpNextBadge: {
    backgroundColor: '#F59E0B22', borderRadius: 20, borderWidth: 1, borderColor: '#F59E0B44',
    paddingHorizontal: 7, paddingVertical: 2,
  },
  cpNextText: { color: '#F59E0B', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  // ── Contenido IDLE ──────────────────────────────────────────────────────────
  idleContent: { gap: 16, paddingTop: 8 },
  routeInfo:   { gap: 4 },
  routeLabel:  { color: '#6C63FF', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  routeName:   { color: '#FFFFFF', fontSize: 18, fontWeight: '600', lineHeight: 24 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 16,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
  startBtnDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF',
  },
  startBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});

// Estilos del marcador de checkpoint (separados para no mezclar con el StyleSheet principal)
const cpMarkerStyles = StyleSheet.create({
  badge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
  },
  num:  { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  tick: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
