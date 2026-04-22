// ─── TrackingScreen.tsx ───────────────────────────────────────────────────────
// Pantalla principal del conductor durante el tracking.
// Panel inferior implementado con @gorhom/bottom-sheet:
//   - Antes de iniciar: snap al 40 % (panel completo con botón "Iniciar")
//   - Durante tracking: colapsa a ~15 % (strip minimalista con Stop + velocidad)
//   - Al deslizar hacia arriba: expande a 65 % con info completa + adjuntar imágenes

import React, {
  useEffect, useRef, useCallback, useState,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Vibration, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Region, LatLng } from 'react-native-maps';
import { useTheme, darkMapStyle, lightMapStyle } from '@lib/ThemeContext';
import { ThemedStatusBar } from '@components/ui/ThemedStatusBar';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import BottomSheet, {
  BottomSheetView, BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { usePingSync } from '../hooks/usePingSync';
import { useCheckpoints } from '../hooks/useCheckpoints';
import { useDevSimulator } from '../hooks/useDevSimulator';
import { ReportIncidentModal } from '@features/incidents/components/ReportIncidentModal';
import { updateTripStatus } from '@features/trips/hooks/useTrips';
import {
  connectSocket, disconnectSocket, onDeviationAlert, emitPanicAlert,
  emitLocationPing,
} from '@lib/socket';
import { API_URL, GOOGLE_MAPS_API_KEY, MMKV_KEYS } from '@lib/constants';
import { saveLocalAlert } from '@lib/database';
import { getStr, storage } from '@lib/mmkv';
import { getAccessToken, supabase } from '@lib/supabase';
import { usePermissions } from '@lib/usePermissions';
import { PermissionsGateScreen } from '@components/ui/PermissionsGateScreen';
import { useIsFocused } from '@react-navigation/native';
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
  // If we have an API key, fetch a routed path via Directions API
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
  // Fallback: straight line so the user always sees a guide
  return [
    { latitude: origin.lat, longitude: origin.lng },
    { latitude: dest.lat,   longitude: dest.lng   },
  ];
}

// ─── Marcador del conductor (Waze-style) ─────────────────────────────────────
// Siempre muestra la flecha direccional independientemente del estado.
// La rotación con el heading la controla el prop `rotation` del <Marker>.
// tracksViewChanges se activa solo durante tracking para reflejar el heading.
function DriverMarker() {
  return (
    <View style={markerStyles.arrowWrapper}>
      <View style={markerStyles.halo} />
      <View style={markerStyles.tip} />
      <View style={markerStyles.body} />
    </View>
  );
}

const markerStyles = StyleSheet.create({
  arrowWrapper: {
    width: 32, height: 44, alignItems: 'center',
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
});


// ─── Rutas de prueba (Dev) ────────────────────────────────────────────────────
// Datos reales de la DB — se usan para cargar rutas directamente desde el
// panel dev sin necesidad de pasar por RoutesScreen. Actualizar si cambian las
// rutas en Supabase.
const DEV_ROUTES: Array<{
  id: string;
  name: string;
  origin: string;
  dest: string;
  waypoints: Array<{ lat: number; lng: number }>;
  stops: Array<{ name: string; lat: number; lng: number; order: number }>;
}> = [
  {
    id: 'daf00603-dec8-4175-ae22-da4f1fc6f854',
    name: 'Test_003',
    origin: 'M-PinoSuarez',
    dest: 'M-Etiopia',
    waypoints: [
      {lat:19.42442,lng:-99.13324},{lat:19.42353,lng:-99.13338},{lat:19.42228,lng:-99.13364},
      {lat:19.42183,lng:-99.13372},{lat:19.42045,lng:-99.13394},{lat:19.41918,lng:-99.13415},
      {lat:19.41798,lng:-99.13434},{lat:19.41682,lng:-99.13452},{lat:19.41601,lng:-99.13466},
      {lat:19.41475,lng:-99.13482},{lat:19.41334,lng:-99.13505},{lat:19.41243,lng:-99.13521},
      {lat:19.41153,lng:-99.13535},{lat:19.41005,lng:-99.13559},{lat:19.40908,lng:-99.13581},
      {lat:19.40798,lng:-99.13591},{lat:19.40596,lng:-99.13620},{lat:19.40422,lng:-99.13648},
      {lat:19.40401,lng:-99.13669},{lat:19.40396,lng:-99.13691},{lat:19.40366,lng:-99.13718},
      {lat:19.40357,lng:-99.13806},{lat:19.40374,lng:-99.14116},{lat:19.40395,lng:-99.14505},
    ],
    stops: [],
  },
  {
    id: '6f4f5792-be3e-4370-b4d3-0ebf3ab767a9',
    name: 'Test_004',
    origin: 'Merced',
    dest: 'Chimalpopoca',
    waypoints: [
      {lat:19.42565,lng:-99.12563},{lat:19.42583,lng:-99.12683},{lat:19.42627,lng:-99.12980},
      {lat:19.42623,lng:-99.13035},{lat:19.42590,lng:-99.13097},{lat:19.42577,lng:-99.13132},
      {lat:19.42589,lng:-99.13306},{lat:19.42482,lng:-99.13320},{lat:19.42362,lng:-99.13336},
      {lat:19.42235,lng:-99.13364},{lat:19.42191,lng:-99.13371},{lat:19.42071,lng:-99.13390},
      {lat:19.41923,lng:-99.13414},{lat:19.41807,lng:-99.13432},{lat:19.41683,lng:-99.13451},
      {lat:19.41617,lng:-99.13463},{lat:19.41584,lng:-99.13647},{lat:19.41649,lng:-99.13850},
      {lat:19.41857,lng:-99.13826},{lat:19.42040,lng:-99.13803},{lat:19.42147,lng:-99.13791},
    ],
    stops: [],
  },
  {
    id: '3a3a4e04-13d5-4c33-88db-c70b2aa486d8',
    name: 'Napoleon-Playa',
    origin: 'Rubén Darío / Moderna',
    dest: 'Playa Caleta / Marte',
    waypoints: [
      {lat:19.39359,lng:-99.13591},{lat:19.39338,lng:-99.13438},{lat:19.39318,lng:-99.13272},
      {lat:19.39308,lng:-99.13224},{lat:19.39286,lng:-99.13211},{lat:19.39184,lng:-99.13234},
      {lat:19.39109,lng:-99.13255},{lat:19.39029,lng:-99.13281},{lat:19.38929,lng:-99.13302},
      {lat:19.38763,lng:-99.13339},{lat:19.38703,lng:-99.13352},{lat:19.38616,lng:-99.13372},
      {lat:19.38501,lng:-99.13398},{lat:19.38444,lng:-99.13326},{lat:19.38426,lng:-99.13225},
      {lat:19.38402,lng:-99.13091},
    ],
    stops: [],
  },
];

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

  const mapRef         = useRef<MapView>(null);
  const navFetchedRef  = useRef(false);
  const sheetRef       = useRef<BottomSheet>(null);
  const [sheetIndex, setSheetIndex] = useState(0);

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
  const [reportedIncidents, setReportedIncidents] = useState<
    Array<{ code: string; type: string; severity: string; time: string }>
  >([]);

   // ── Tracking ──────────────────────────────────────────────────────────────
  const vehicleId = getStr(MMKV_KEYS.ACTIVE_VEHICLE_ID) ?? '';
  // tenantId: prefer MMKV (written by useGpsTracking on first real tracking start);
  // fallback to JWT user_metadata so the dev simulator works before real tracking.
  const [resolvedTenantId, setResolvedTenantId] = useState<string>(() => getStr('tenantId') ?? '');
  const tenantIdRef = useRef(resolvedTenantId);
  useEffect(() => {
    if (resolvedTenantId) { tenantIdRef.current = resolvedTenantId; return; }
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const id = (session?.user?.user_metadata?.tenant_id as string | undefined) ?? '';
      if (id) { setResolvedTenantId(id); tenantIdRef.current = id; }
    });
  }, [resolvedTenantId]);
  const tenantId = resolvedTenantId;

   // ── Datos de ruta (se refrescan al volver al tab) ─────────────────────────
  // IMPORTANT: TrackingScreen permanece montado por el tab navigator entre
  // navegaciones. Por eso tripId y los datos de ruta deben leerse de MMKV
  // cuando el tab recupera el foco, no solo al montar — de lo contrario
  // completar un segundo viaje usaría el tripId del primero.
  const isFocused = useIsFocused();
  const [routeWaypoints, setRouteWaypoints] = useState<LatLng[]>([]);
  const [routeStops, setRouteStops] = useState<Array<{ name: string; lat: number; lng: number; order: number }>>([]); 
  const [tripId, setTripId] = useState<string | undefined>(() => getStr(MMKV_KEYS.ACTIVE_TRIP_ID));

  useEffect(() => {
    if (!isFocused) return;
    // Refrescar tripId cada vez que el tab obtiene el foco.
    // RoutesScreen escribe el nuevo tripId en MMKV antes de navegar al tab Mapa.
    const freshTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
    setTripId(freshTripId);
    console.log(`[TrackingScreen] tripId refrescado al ganar foco: ${freshTripId ?? 'none'}`);

    // Reset nav path state so it recalculates with fresh data
    navFetchedRef.current = false;
    setNavVersion((v) => v + 1);
    try {
      const raw = getStr(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS);
      console.log(`[TrackingScreen] MMKV waypoints raw: ${raw ? `${raw.length} chars` : 'null'}`);
      if (!raw) { setRouteWaypoints([]); return; }
      const parsed = (JSON.parse(raw) as Array<{ lat: number; lng: number }>)
        .map((p) => ({ latitude: p.lat, longitude: p.lng }));
      console.log(`[TrackingScreen] Parsed ${parsed.length} waypoints`);
      setRouteWaypoints(parsed);
    } catch (e) {
      console.warn('[TrackingScreen] Failed to parse waypoints:', e);
      setRouteWaypoints([]);
    }
    try {
      const raw = getStr(MMKV_KEYS.ACTIVE_ROUTE_STOPS);
      if (!raw) { setRouteStops([]); return; }
      setRouteStops(JSON.parse(raw) as Array<{ name: string; lat: number; lng: number; order: number }>);
    } catch { setRouteStops([]); }
  }, [isFocused]);

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
  const [navVersion, setNavVersion] = useState(0);

  // ── Ajustes del mapa ──────────────────────────────────────────────
  const [showTraffic,  setShowTraffic]  = useState(true);
  const [isSatellite,  setIsSatellite]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [mapTheme,     setMapTheme]     = useState<'auto' | 'light' | 'dark'>('auto');

  const effectiveDark =
    mapTheme === 'dark' ? true :
    mapTheme === 'light' ? false :
    isDark;

  // ── Simulador GPS (Dev) ────────────────────────────────────────
  // Callback que envía cada tick simulado al backend vía socket
  const handleSimTick = useCallback((pos: { lat: number; lng: number; speed?: number }, h: number) => {
    emitLocationPing({
      vehicleId,
      tenantId: tenantIdRef.current || tenantId,
      routeId,
      coordinate: { lat: pos.lat, lng: pos.lng },
      speedKmh:   pos.speed != null ? Number((pos.speed * 3.6).toFixed(1)) : undefined,
      headingDeg: Math.round(h),
      recordedAt: new Date().toISOString(),
    });
  }, [vehicleId, tenantId, routeId]);

  const sim = useDevSimulator(
    routeWaypoints.map((w) => ({ lat: w.latitude, lng: w.longitude })),
    { onTick: handleSimTick },
  );

  // Override de posicion/heading cuando el simulador está activo.
  const effectivePosition = sim.position ?? lastCoordinate ?? initialPosition;
  const effectiveHeading  = sim.position != null ? sim.heading : heading;

  // ── Detección de llegada al destino ───────────────────────────────────────────
  // Se activa cuando el simulador llega al 95% de la ruta, o cuando
  // el GPS real está a menos de 300 m del último waypoint.
  const lastWp = routeWaypoints[routeWaypoints.length - 1];

  const distToEnd = useCallback((pos: { lat: number; lng: number } | null): number => {
    if (!pos || !lastWp) return Infinity;
    const R = 6371000;
    const dLat = ((lastWp.latitude - pos.lat) * Math.PI) / 180;
    const dLng = ((lastWp.longitude - pos.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos((pos.lat * Math.PI) / 180) * Math.cos((lastWp.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [lastWp]);

  const [arrivalSuggested, setArrivalSuggested] = useState(false);
  const [arrivalDismissed, setArrivalDismissed] = useState(false);

  useEffect(() => {
    if (!isTracking || arrivalDismissed) return;
    const simNear    = sim.progress >= 0.95;
    const gpsNear    = distToEnd(lastCoordinate) <= 300;
    const nearEnd    = simNear || gpsNear;
    if (nearEnd && !arrivalSuggested) setArrivalSuggested(true);
  }, [sim.progress, lastCoordinate, isTracking, arrivalDismissed, arrivalSuggested, distToEnd]);

  // ── Posición inicial (antes de tracking) ──────────────────────────────────
  // Obtener un fix GPS al montar para que el marcador del conductor
  // sea visible desde el primer momento, no solo después de iniciar tracking.
  const [initialPosition, setInitialPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Intenta primero la última posición conocida (instantánea, sin esperar GPS)
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          console.log(`[TrackingScreen] Last known position: ${last.coords.latitude}, ${last.coords.longitude}`);
          setInitialPosition({ lat: last.coords.latitude, lng: last.coords.longitude });
        }
        // Luego obtiene una posición fresca
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          console.log(`[TrackingScreen] Current position: ${loc.coords.latitude}, ${loc.coords.longitude}`);
          setInitialPosition({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch (e) {
        console.warn('[TrackingScreen] Failed to get initial position:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Posición efectiva: sim override > tracking GPS > initial fix
  const driverPosition = effectivePosition;
  const driverHeading  = effectiveHeading;

  // tracksViewChanges: true en el primer render del marker para que la vista
  // personalizada se capture; false después para evitar redraws constantes.
  const [driverMarkerReady, setDriverMarkerReady] = useState(false);
  useEffect(() => { if (driverPosition) setDriverMarkerReady(false); }, [!!driverPosition]);
  console.log(`[TrackingScreen] driverPosition: ${driverPosition ? `${driverPosition.lat}, ${driverPosition.lng}` : 'null'}, isTracking: ${isTracking}, lastCoord: ${!!lastCoordinate}, initialPos: ${!!initialPosition}`);

  const { drainQueue } = usePingSync();

  // Drena pings offline acumulados en cuanto arranca el tracking
  useEffect(() => {
    if (isTracking) void drainQueue();
  }, [isTracking, drainQueue]);

  // ── Sheet: ajustar snap al cambiar estado de tracking ────────────────────
  useEffect(() => {
    setSheetIndex(0); // Reset: snap points change between idle/tracking
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
  // Se calcula en cuanto tenemos posición + waypoints, incluso antes de
  // iniciar tracking, para que el conductor vea la guía al primer punto.
  // Se re-calcula al arrancar tracking si la posición cambió.
  useEffect(() => {
    console.log(`[TrackingScreen] Nav effect: driverPos=${!!driverPosition}, waypoints=${routeWaypoints.length}, fetched=${navFetchedRef.current}`);
    if (!driverPosition || routeWaypoints.length === 0) return;
    if (navFetchedRef.current) return;
    const startPoint = routeWaypoints[0]!;
    const dist = haversineDistance(
      { lat: driverPosition.lat, lng: driverPosition.lng },
      { lat: startPoint.latitude, lng: startPoint.longitude },
    );
    console.log(`[TrackingScreen] Distance to route start: ${Math.round(dist)}m`);
    // Ya estamos cerca del inicio — no necesitamos guía
    if (dist < 50) {
      console.log('[TrackingScreen] Within 50m of start, skipping nav path');
      navFetchedRef.current = true;
      return;
    }
    navFetchedRef.current = true;
    console.log('[TrackingScreen] Fetching directions to start...');
    void fetchDirectionsToStart(
      { lat: driverPosition.lat, lng: driverPosition.lng },
      { lat: startPoint.latitude, lng: startPoint.longitude },
    ).then((path) => {
      console.log(`[TrackingScreen] Nav-to-start result: ${path.length} points`);
      setNavToStartPath(path);
    }).catch((e) => {
      console.warn('[TrackingScreen] Nav-to-start fetch error:', e);
    });
  }, [driverPosition, routeWaypoints, navVersion]);

  // Reset cuando se detiene el tracking para poder recalcular al re-iniciar
  useEffect(() => {
    if (!isTracking) {
      navFetchedRef.current = false;
      setNavToStartPath([]);
      // Incrementar navVersion para que el effect de nav-to-start se re-ejecute
      // aunque driverPosition y routeWaypoints no hayan cambiado
      setNavVersion((v) => v + 1);
    }
  }, [isTracking]);

  // ── Seguimiento Waze-style: cámara sigue posición + heading ──────────────
  // animateCamera se llama solo cuando la posición cambia (>0.5 m).
  // El heading va junto con la posición para no disparar animaciones extra.
  // tracksViewChanges=false en el Marker evita redraws constantes del mapa.
  const lastCameraPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!isTracking || !mapRef.current || !effectivePosition) return;
    const last = lastCameraPosRef.current;
    // Ignorar si la posición no cambió más de ~0.5 m (evita disparos por heading solo)
    if (
      last &&
      Math.abs(last.lat - effectivePosition.lat) < 0.000005 &&
      Math.abs(last.lng - effectivePosition.lng) < 0.000005
    ) return;
    lastCameraPosRef.current = { lat: effectivePosition.lat, lng: effectivePosition.lng };
    mapRef.current.animateCamera(
      {
        center:   { latitude: effectivePosition.lat, longitude: effectivePosition.lng },
        heading:  effectiveHeading ?? 0,
        pitch:    0,
        zoom:     17,
        altitude: 500,
      },
      { duration: 800 },
    );
  }, [effectivePosition, effectiveHeading, isTracking]);

  // Resetear el ref al detener tracking para re-centrar al reiniciar
  useEffect(() => {
    if (!isTracking) lastCameraPosRef.current = null;
  }, [isTracking]);

  const handleCenterOnMe = useCallback(() => {
    if (!driverPosition || !mapRef.current) return;
    lastCameraPosRef.current = null; // fuerza re-center en próximo update
    mapRef.current.animateCamera(
      {
        center:   { latitude: driverPosition.lat, longitude: driverPosition.lng },
        heading:  driverHeading ?? 0,
        pitch:    0,
        zoom:     17,
        altitude: 500,
      },
      { duration: 400 },
    );
  }, [driverPosition, driverHeading]);

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

  // ── Completar viaje (llegada al destino) ─────────────────────────────────
  const handleCompleteTrip = useCallback(async () => {
    // Leer el tripId actual desde MMKV en el momento de completar
    // para garantizar que usamos el ID del viaje en curso, no uno stale.
    const currentTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
    if (currentTripId) {
      try {
        await updateTripStatus(currentTripId, 'completed', {
          completed_at: new Date().toISOString(),
        });
        // Limpiar el tripId del MMKV para que el siguiente viaje empiece limpio
        storage.delete(MMKV_KEYS.ACTIVE_TRIP_ID);
        setTripId(undefined);
        console.log('[TrackingScreen] Viaje completado y ACTIVE_TRIP_ID limpiado:', currentTripId);
      } catch (e) {
        console.warn('[TrackingScreen] No se pudo marcar viaje como completado:', e);
      }
    }
    sim.pause();
    void stopTracking();
    setArrivalSuggested(false);
    setArrivalDismissed(false);
  }, [sim, stopTracking]);

  // ── Toggle tracking ───────────────────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    if (isTracking) {
      Alert.alert('Detener tracking', '¿Confirmas que quieres detener el seguimiento?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Detener', style: 'destructive', onPress: async () => {
            // Leer desde MMKV para evitar closures stale
            const currentTripId = getStr(MMKV_KEYS.ACTIVE_TRIP_ID);
            if (currentTripId) {
              try {
                await updateTripStatus(currentTripId, 'cancelled');
                storage.delete(MMKV_KEYS.ACTIVE_TRIP_ID);
                setTripId(undefined);
                console.log('[TrackingScreen] Viaje cancelado y ACTIVE_TRIP_ID limpiado:', currentTripId);
              } catch (e) {
                console.warn('[TrackingScreen] No se pudo cancelar viaje:', e);
              }
            }
            void stopTracking();
          },
        },
      ]);
    } else {
      setArrivalSuggested(false);
      setArrivalDismissed(false);
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

  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ThemedStatusBar />

      {/* ── Mapa (fondo completo) ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={DEFAULT_REGION}
        onMapReady={handleMapReady}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsTraffic={showTraffic && !isSatellite}
        showsBuildings={false}
        mapType={isSatellite ? 'satellite' : 'standard'}
        customMapStyle={isSatellite ? [] : (effectiveDark ? darkMapStyle : lightMapStyle)}
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
        {driverPosition ? (
          <Marker
            coordinate={{ latitude: driverPosition.lat, longitude: driverPosition.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={driverHeading ?? 0}
            zIndex={10}
            tracksViewChanges={!driverMarkerReady}
            onLayout={() => setDriverMarkerReady(true)}
          >
            <DriverMarker />
          </Marker>
        ) : null}
      </MapView>

      {/* ── Botón de ajustes del mapa (top-left, SVG icon) ── */}
      <View style={styles.settingsContainer}>
        <TouchableOpacity
          style={[styles.settingsBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)' }]}
          onPress={() => { setSettingsOpen((v) => !v); setDevPanelOpen(false); }}
          accessibilityLabel="Ajustes del mapa"
          accessibilityRole="button"
        >
          <Ionicons
            name="settings-outline"
            size={20}
            color={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)'}
          />
        </TouchableOpacity>

        {settingsOpen && (
          <View style={[styles.settingsPanel, {
            backgroundColor: isDark ? 'rgba(15,15,30,0.92)' : 'rgba(255,255,255,0.95)',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }]}>
            {/* Tráfico */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setShowTraffic((v) => !v)}
            >
              <Text style={[styles.settingsRowText, { color: isDark ? '#eee' : '#222' }]}>Tráfico</Text>
              <View style={[styles.toggle, showTraffic ? styles.toggleOn : styles.toggleOff]}>
                <View style={[styles.toggleThumb, showTraffic ? styles.toggleThumbOn : styles.toggleThumbOff]} />
              </View>
            </TouchableOpacity>

            {/* Satélite */}
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setIsSatellite((v) => !v)}
            >
              <Text style={[styles.settingsRowText, { color: isDark ? '#eee' : '#222' }]}>Satélite</Text>
              <View style={[styles.toggle, isSatellite ? styles.toggleOn : styles.toggleOff]}>
                <View style={[styles.toggleThumb, isSatellite ? styles.toggleThumbOn : styles.toggleThumbOff]} />
              </View>
            </TouchableOpacity>

            {/* Tema del mapa */}
            <View style={[styles.settingsDivider, { backgroundColor: isDark ? '#ffffff15' : '#00000010' }]} />
            <Text style={[styles.settingsGroupLabel, { color: isDark ? '#aaa' : '#666' }]}>TEMA DEL MAPA</Text>
            {(['auto', 'light', 'dark'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={styles.settingsRow}
                onPress={() => setMapTheme(t)}
              >
                <Text style={[styles.settingsRowText, { color: isDark ? '#eee' : '#222' }]}>
                  {t === 'auto' ? 'Automático' : t === 'light' ? 'Claro' : 'Oscuro'}
                </Text>
                {mapTheme === t && (
                  <Text style={{ color: colors.accent, fontSize: 16 }}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Panel Dev: simulador GPS (debajo de ajustes) ── */}
      <View style={styles.devContainer}>
        <TouchableOpacity
          style={[
            styles.devBtn,
            { backgroundColor: isDark ? 'rgba(108,99,255,0.7)' : 'rgba(108,99,255,0.85)' },
            sim.isRunning && styles.devBtnActive,
          ]}
          onPress={() => { setDevPanelOpen((v) => !v); setSettingsOpen(false); }}
          accessibilityLabel="Panel de simulación GPS"
          accessibilityRole="button"
        >
          <Ionicons name="code-slash-outline" size={18} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        {devPanelOpen && (
          <View style={[styles.devPanel, {
            backgroundColor: isDark ? 'rgba(10,10,25,0.95)' : 'rgba(240,240,255,0.97)',
            borderColor: isDark ? '#6C63FF44' : '#6C63FF33',
          }]}>
            {/* Header */}
            <View style={styles.devHeader}>
              <Ionicons name="navigate-outline" size={14} color="#6C63FF" />
              <Text style={[styles.devHeaderText, { color: isDark ? '#ccc' : '#333' }]}>
                Simulador GPS
              </Text>
              {sim.position && (
                <View style={styles.devActivePill}>
                  <Text style={styles.devActivePillText}>ACTIVO</Text>
                </View>
              )}
            </View>

            {/* Waypoints available? */}
            {routeWaypoints.length < 2 ? (
              <Text style={[styles.devNoRoute, { color: isDark ? '#888' : '#666' }]}>
                Sin ruta cargada. Selecciona una ruta primero.
              </Text>
            ) : (
              <>
                {/* Progress bar */}
                <View style={[styles.devProgressTrack, { backgroundColor: isDark ? '#ffffff15' : '#00000012' }]}>
                  <View style={[styles.devProgressFill, { width: `${sim.progress * 100}%` as `${number}%` }]} />
                </View>
                <Text style={[styles.devProgressLabel, { color: isDark ? '#888' : '#666' }]}>
                  {Math.round(sim.progress * 100)}%  ·  seg {sim.segmentIdx + 1}/{routeWaypoints.length - 1}
                </Text>

                {/* Coordenadas simuladas */}
                {sim.position && (
                  <Text style={[styles.devCoords, { color: isDark ? '#6C63FF' : '#4a43cc' }]}>
                    {sim.position.lat.toFixed(6)}, {sim.position.lng.toFixed(6)}
                    {sim.heading != null ? `  ·  ${Math.round(sim.heading)}°` : ''}
                  </Text>
                )}

                {/* Velocidad */}
                <Text style={[styles.devLabel, { color: isDark ? '#aaa' : '#555' }]}>Velocidad</Text>
                <View style={styles.devSpeedRow}>
                  {[10, 30, 60, 120].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.devSpeedBtn, sim.speedKmh === s && styles.devSpeedBtnActive]}
                      onPress={() => sim.setSpeedKmh(s)}
                    >
                      <Text style={[styles.devSpeedText, sim.speedKmh === s && styles.devSpeedTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={[styles.devSpeedUnit, { color: isDark ? '#888' : '#666' }]}>km/h</Text>
                </View>

                {/* Controles */}
                <View style={styles.devControls}>
                  <TouchableOpacity
                    style={[styles.devCtrlBtn, { backgroundColor: sim.isRunning ? '#F9731620' : '#22C55E20', borderColor: sim.isRunning ? '#F9731660' : '#22C55E60' }]}
                    onPress={() => sim.isRunning ? sim.pause() : sim.start()}
                  >
                    <Ionicons
                      name={sim.isRunning ? 'pause' : 'play'}
                      size={16}
                      color={sim.isRunning ? '#F97316' : '#22C55E'}
                    />
                    <Text style={[styles.devCtrlText, { color: sim.isRunning ? '#F97316' : '#22C55E' }]}>
                      {sim.isRunning ? 'Pausar' : 'Iniciar'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.devCtrlBtn, { backgroundColor: '#6C63FF20', borderColor: '#6C63FF60' }]}
                    onPress={sim.reset}
                  >
                    <Ionicons name="reload" size={15} color="#6C63FF" />
                    <Text style={[styles.devCtrlText, { color: '#6C63FF' }]}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── Rutas de prueba ─────────────────────────────────── */}
            <View style={[styles.devDivider, { backgroundColor: isDark ? '#ffffff12' : '#00000010' }]} />
            <Text style={[styles.devLabel, { color: isDark ? '#aaa' : '#555', marginBottom: 6 }]}>
              Cargar ruta de prueba
            </Text>
            {DEV_ROUTES.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.devRouteBtn, { backgroundColor: isDark ? '#ffffff08' : '#00000006', borderColor: isDark ? '#ffffff18' : '#00000018' }]}
                onPress={() => {
                  sim.pause();
                  sim.reset();
                  storage.set(MMKV_KEYS.ACTIVE_ROUTE_ID, r.id);
                  storage.set(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS, JSON.stringify(r.waypoints));
                  storage.set(MMKV_KEYS.ACTIVE_ROUTE_STOPS, JSON.stringify(r.stops));
                  // Forzar recarga de waypoints igual que hace el isFocused effect
                  navFetchedRef.current = false;
                  setNavVersion((v) => v + 1);
                  setRouteWaypoints(r.waypoints.map((p) => ({ latitude: p.lat, longitude: p.lng })));
                  setRouteStops(r.stops);
                }}
              >
                <Ionicons name="map-outline" size={13} color="#6C63FF" style={{ marginRight: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.devRouteName, { color: isDark ? '#ddd' : '#222' }]}>{r.name}</Text>
                  <Text style={[styles.devRouteDesc, { color: isDark ? '#777' : '#888' }]}>
                    {r.origin} → {r.dest} · {r.waypoints.length} pts
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

      </View>

      {/* ── FAB SOS (top-right, solo durante tracking) ── */}
      {isTracking && (
        <Animated.View style={[styles.panicFab, panicStyle]}>
          <TouchableOpacity
            onPressIn={handlePanicPressIn}
            onPressOut={handlePanicPressOut}
            activeOpacity={0.85}
            style={[
              styles.panicFabInner,
              { backgroundColor: isDark ? 'rgba(180,40,40,0.6)' : 'rgba(220,60,60,0.65)' },
              panicHolding && styles.panicFabHolding,
            ]}
            accessibilityLabel="Boton de panico - manten 5 segundos"
            accessibilityRole="button"
          >
            {panicHolding ? (
              <Text style={styles.panicFabCountdown}>{panicCountdown}</Text>
            ) : (
              <Ionicons name="shield-outline" size={20} color="rgba(255,255,255,0.9)" />
            )}
            <Text style={styles.panicFabLabel}>{panicHolding ? 'SOS...' : 'SOS'}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── FAB Mi ubicación ──
          Se renderiza ANTES del BottomSheet en el árbol JSX, por lo
          que el sheet (pintado después) lo tapa naturalmente al expandirse.
          Sin zIndex ni elevation para no competir con el sheet. */}
      {lastCoordinate && (
        <TouchableOpacity
          style={[
            styles.locationFab,
            {
              backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)',
              bottom: isTracking ? '17%' : '41%',
            },
          ]}
          onPress={handleCenterOnMe}
          accessibilityLabel="Centrar en mi posicion"
          accessibilityRole="button"
        >
          <Ionicons
            name="locate-outline"
            size={20}
            color={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)'}
          />
        </TouchableOpacity>
      )}

      {/* ── Banner de llegada (Uber-style) ─────────────────────────────────
          Se renderiza ANTES del BottomSheet, por lo que el sheet lo tapa
          cuando se expande. Sin zIndex — el painter's algorithm lo ordena. */}
      {isTracking && arrivalSuggested && (
        <View
          style={[
            styles.arrivalBanner,
            { backgroundColor: isDark ? 'rgba(20,20,35,0.97)' : 'rgba(255,255,255,0.97)' },
          ]}
        >
          <View style={styles.arrivalBannerIcon}>
            <Ionicons name="flag" size={22} color="#22C55E" />
          </View>
          <View style={styles.arrivalBannerBody}>
            <Text style={[styles.arrivalBannerTitle, { color: colors.text }]}>
              Llegaste a tu destino
            </Text>
            <Text style={[styles.arrivalBannerSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {routeName}
            </Text>
          </View>
          <View style={styles.arrivalBannerActions}>
            <TouchableOpacity
              style={[styles.arrivalConfirmBtn, { backgroundColor: colors.accent }]}
              onPress={() => void handleCompleteTrip()}
              activeOpacity={0.8}
            >
              <Text style={styles.arrivalConfirmText}>Finalizar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setArrivalDismissed(true)}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Text style={[styles.arrivalDismissText, { color: colors.textSecondary }]}>
                Continuar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Bottom Sheet ── */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={isTracking ? SNAP_TRACKING : SNAP_IDLE}
        index={0}
        backgroundStyle={[styles.sheetBg, { backgroundColor: colors.surface }]}
        handleIndicatorStyle={[styles.sheetHandle, { backgroundColor: colors.borderLight }]}
        enablePanDownToClose={false}
        onChange={(idx: number) => setSheetIndex(idx)}
      >
        {isTracking ? (
          // ─── Contenido TRACKING: scrolleable para el snap expandido ────
          <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
            {/* Strip superior siempre visible */}
            <View style={styles.trackingStrip}>
              <View style={styles.stripLeft}>
                <View style={styles.activeDot} />
                <View>
                  <Text style={[styles.stripRouteName, { color: colors.text }]} numberOfLines={1}>{routeName}</Text>
                  {effectiveHeading != null && (
                    <Text style={[styles.stripSpeed, { color: colors.textSecondary }]}>
                      {Math.round(effectiveHeading)}°
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
            <View style={[styles.expandedSection, { borderTopColor: colors.surfaceAlt }]}>

              {/* Hint de navegación */}
              {navToStartPath.length > 0 && (
                <View style={styles.navHint}>
                  <View style={styles.navHintDot} />
                  <Text style={styles.navHintText}>Navega al inicio de la ruta</Text>
                </View>
              )}

              {/* Coordenadas */}
              {lastCoordinate && (
                <Text style={[styles.coords, { color: colors.textMuted }]}>
                  {lastCoordinate.lat.toFixed(6)}, {lastCoordinate.lng.toFixed(6)}
                  {heading != null ? `  •  ${Math.round(heading)}°` : ''}
                </Text>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* ── Sección: Checkpoints ── */}
              {checkpointStatuses.length > 0 && (
                <View style={[styles.checkpointsSection, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <View style={styles.cpHeader}>
                    <Text style={[styles.cpTitle, { color: colors.text }]}>Checkpoints</Text>
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
                          <Text style={[styles.cpName, { color: visited ? colors.textMuted : colors.text }]}
                            numberOfLines={1}>{cp.name}</Text>
                          {!cp.is_mandatory && (
                            <Text style={[styles.cpOptionalLabel, { color: colors.textMuted }]}>opcional</Text>
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
                <Ionicons name="warning-outline" size={18} color="#F97316" />
                <Text style={styles.incidentBtnText}>Reportar incidente</Text>
              </TouchableOpacity>

              {/* ── Incidentes reportados (feedback) ── */}
              {reportedIncidents.length > 0 && (
                <View style={[styles.reportedSection, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.reportedTitle, { color: colors.textSecondary }]}>Incidentes reportados</Text>
                  {reportedIncidents.map((inc, i) => (
                    <View key={i} style={styles.reportedRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.reportedCode, { color: colors.text }]}>{inc.code}</Text>
                        <Text style={[styles.reportedMeta, { color: colors.textMuted }]}>
                          {inc.type} - {inc.severity} - {inc.time}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </BottomSheetScrollView>
        ) : (
          // ─── Contenido IDLE (sin tracking) ───────────────────────────
          <BottomSheetView style={styles.sheetContent}>
            <View style={styles.idleContent}>
              <View style={styles.routeInfo}>
                <Text style={[styles.routeLabel, { color: colors.accent }]}>RUTA ASIGNADA</Text>
                <Text style={[styles.routeName, { color: colors.text }]} numberOfLines={2}>{routeName}</Text>
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
        onReported={(inc) => {
          setReportedIncidents((prev) => [
            {
              code: inc.code,
              type: inc.type,
              severity: inc.severity,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            ...prev,
          ].slice(0, 10));
        }}
        tripId={tripId}
        vehicleId={vehicleId}
        lat={lastCoordinate?.lat}
        lng={lastCoordinate?.lng}
      />
    </View>
  );
}

// Map styles are now imported from ThemeContext.

// ─── StyleSheet ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },

  // ── FAB SOS ─────────────────────────────────────────────────────────────────
  panicFab: {
    position: 'absolute', top: 56, right: 16, zIndex: 20,
  },
  panicFabInner: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 7,
  },
  panicFabHolding: { backgroundColor: 'rgba(220,40,40,0.85)' },
  panicFabCountdown: { color: '#fff', fontSize: 18, fontWeight: '900' },
  panicFabLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 8, fontWeight: '700', letterSpacing: 0.8, marginTop: 1 },

  // ── FAB Mi ubicacion ────────────────────────────────────────────────────────
  // Sin zIndex ni elevation: el BottomSheet se renderiza despues
  // en el arbol JSX, asi React Native lo pinta encima (painter's algorithm).
  locationFab: {
    position: 'absolute', right: 16,
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Banner de llegada ────────────────────────────────────────────────────────
  arrivalBanner: {
    position: 'absolute',
    left: 16, right: 16,
    bottom: '20%',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  arrivalBannerIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#22C55E18',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  arrivalBannerBody: { flex: 1, gap: 2 },
  arrivalBannerTitle: { fontSize: 15, fontWeight: '700' },
  arrivalBannerSub:   { fontSize: 13 },
  arrivalBannerActions: { alignItems: 'center', gap: 6 },
  arrivalConfirmBtn: {
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  arrivalConfirmText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  arrivalDismissText: { fontSize: 12, fontWeight: '500' },

  // ── Map settings button (top-left) ──────────────────────────────────────────
  settingsContainer: {
    position: 'absolute', top: 56, left: 16, zIndex: 20,
  },
  settingsBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 6,
  },
  settingsPanel: {
    marginTop: 8,
    borderRadius: 16, borderWidth: 1,
    paddingVertical: 8, paddingHorizontal: 4,
    minWidth: 180,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, gap: 12,
  },
  settingsRowText: { fontSize: 14, fontWeight: '500', flex: 1 },
  settingsDivider: { height: 1, marginHorizontal: 14, marginVertical: 4 },
  settingsGroupLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1,
    paddingHorizontal: 14, paddingTop: 2, paddingBottom: 4,
  },
  // Mini toggle
  toggle: {
    width: 38, height: 22, borderRadius: 11,
    justifyContent: 'center', padding: 2,
  },
  toggleOn:  { backgroundColor: '#6C63FF' },
  toggleOff: { backgroundColor: '#44445A' },
  toggleThumb: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
  },
  toggleThumbOn:  { alignSelf: 'flex-end' },
  toggleThumbOff: { alignSelf: 'flex-start' },

  // ── Dev simulator panel ──────────────────────────────────────────────────────
  devContainer: {
    position: 'absolute', top: 102, left: 16, zIndex: 20,
  },
  devBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45, shadowRadius: 6, elevation: 7,
  },
  devBtnActive: {
    shadowOpacity: 0.8, shadowRadius: 10,
  },
  devPanel: {
    marginTop: 8, borderRadius: 16, borderWidth: 1,
    padding: 14, minWidth: 230,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 12,
    gap: 8,
  },
  devHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  devHeaderText: { fontSize: 13, fontWeight: '700', flex: 1 },
  devActivePill: {
    backgroundColor: '#22C55E22', borderRadius: 8, borderWidth: 1,
    borderColor: '#22C55E55', paddingHorizontal: 6, paddingVertical: 2,
  },
  devActivePillText: { color: '#22C55E', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  devNoRoute: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

  devProgressTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden',
  },
  devProgressFill: {
    height: 4, backgroundColor: '#6C63FF', borderRadius: 2,
  },
  devProgressLabel: { fontSize: 10, fontFamily: 'monospace' },
  devCoords: { fontSize: 10, fontFamily: 'monospace', fontWeight: '500' },
  devLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },

  devSpeedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  devSpeedBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: '#6C63FF44',
  },
  devSpeedBtnActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  devSpeedText: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  devSpeedTextActive: { color: '#fff' },
  devSpeedUnit: { fontSize: 11 },

  devControls: { flexDirection: 'row', gap: 8, marginTop: 2 },
  devCtrlBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  devCtrlText: { fontSize: 13, fontWeight: '700' },

  devDivider: { height: 1, marginVertical: 4 },
  devRouteBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  devRouteName: { fontSize: 12, fontWeight: '700' },
  devRouteDesc: { fontSize: 10, marginTop: 1 },

  // ── Bottom Sheet ────────────────────────────────────────────────────────────
  sheetBg:     { borderRadius: 28 },
  sheetHandle: { width: 40 },
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
    fontSize: 14, fontWeight: '600',
    maxWidth: 200,
  },
  stripSpeed: {
    fontSize: 12, marginTop: 1,
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
    borderTopWidth: 1,
  },
  navHint:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navHintDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#38BDF8' },
  navHintText: { color: '#38BDF8', fontSize: 13, fontWeight: '600' },
  coords:      { fontSize: 11, fontFamily: 'monospace' },
  errorText:   { color: '#FF6B6B', fontSize: 13 },

  // ── Boton de reportar incidente (en sheet expandido) ─────────────────────────
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
  incidentBtnText: { color: '#F97316', fontSize: 14, fontWeight: '700' },

  // ── Incidentes reportados (feedback en sheet) ──────────────────────────────
  reportedSection: {
    borderRadius: 14, padding: 14,
    borderWidth: 1, marginTop: 8, gap: 8,
  },
  reportedTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  reportedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportedCode: { fontSize: 13, fontWeight: '600' },
  reportedMeta: { fontSize: 11 },

  // ── (unused placeholder — cpMarkerStyles defined separately below) ──────────

  // ── Checkpoints ─────────────────────────────────────────────────────────────
  checkpointsSection: {
    borderRadius: 14, padding: 14,
    borderWidth: 1, gap: 8,
  },
  cpHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  cpTitle: { fontSize: 14, fontWeight: '700' },
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
  cpName:        { fontSize: 13, fontWeight: '500' },
  cpNameVisited: {},
  cpOptionalLabel: { fontSize: 10, marginTop: 1 },
  cpNextBadge: {
    backgroundColor: '#F59E0B22', borderRadius: 20, borderWidth: 1, borderColor: '#F59E0B44',
    paddingHorizontal: 7, paddingVertical: 2,
  },
  cpNextText: { color: '#F59E0B', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  // ── Contenido IDLE ──────────────────────────────────────────────────────────
  idleContent: { gap: 16, paddingTop: 8 },
  routeInfo:   { gap: 4 },
  routeLabel:  { fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  routeName:   { fontSize: 18, fontWeight: '600', lineHeight: 24 },
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
