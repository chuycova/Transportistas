// ─── RoutesScreen.tsx ─────────────────────────────────────────────────────────
// Lista de todas las rutas asignadas al vehículo del conductor.
// El conductor puede seleccionar una para ver detalles e iniciarla.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, RefreshControl, FlatList, Modal, LayoutChangeEvent, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@lib/supabase';
import { useTheme } from '@lib/ThemeContext';
import { setStr } from '@lib/mmkv';
import { MMKV_KEYS, API_URL } from '@lib/constants';
import type { RootStackParamList } from '@navigation/RootNavigator';
import type { MainTabParamList } from '@navigation/MainTabNavigator';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Routes'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface RouteItem {
  id: string;
  name: string;
  origin_name: string;
  dest_name: string;
  status: 'draft' | 'active' | 'archived';
  total_distance_m: number | null;
  estimated_duration_s: number | null;
  deviation_threshold_m: number | null;
  waypoints: Array<{ lat: number; lng: number }>;
  stops: Array<{ name: string; address: string | null; lat: number; lng: number; order: number }>;
}

interface DriverAssignment {
  driver: { id: string; full_name: string; role: string };
  vehicle: {
    id: string;
    plate: string;
    alias: string | null;
    color: string | null;
    vehicle_type: string;
  } | null;
  activeRoute: RouteItem | null;
  routes: RouteItem[];
}

// ─── StaticRouteMap ──────────────────────────────────────────────────────
// Renderiza la polilínea de la ruta en RN puro sin llamadas a API de Maps.
// Proyecta lat/lng a píxeles (bounding-box lineal) y dibuja segmentos como
// Views absolutas rotadas. Incluye marcadores de inicio, paradas y fin.
function StaticRouteMap({
  waypoints,
  stops = [],
  accentColor,
  bgColor,
  lineColor,
  height = 200,
}: {
  waypoints: Array<{ lat: number; lng: number }>;
  stops?: Array<{ lat: number; lng: number; name: string }>;
  accentColor: string;
  bgColor: string;
  lineColor: string;
  height?: number;
}) {
  const [size, setSize] = React.useState({ w: 0, h: height });
  const PAD = 24;

  const onLayout = (e: LayoutChangeEvent) => {
    setSize({ w: e.nativeEvent.layout.width, h: height });
  };

  if (waypoints.length < 2) {
    return (
      <View
        style={{ height, backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}
      >
        <Ionicons name="map-outline" size={32} color={lineColor} style={{ opacity: 0.25 }} />
        <Text style={{ color: lineColor, opacity: 0.4, fontSize: 12, marginTop: 8 }}>Sin datos de ruta</Text>
      </View>
    );
  }

  if (size.w === 0) {
    return (
      <View
        style={{ height, backgroundColor: bgColor }}
        onLayout={onLayout}
      />
    );
  }

  // Bounding box
  const lats = waypoints.map((p) => p.lat);
  const lngs = waypoints.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const rangeW = maxLng - minLng || 0.001;
  const rangeH = maxLat - minLat || 0.001;

  const toX = (lng: number) => PAD + ((lng - minLng) / rangeW) * (size.w - PAD * 2);
  // lat increases upward, screen y increases downward — invert
  const toY = (lat: number) => PAD + ((maxLat - lat) / rangeH) * (height - PAD * 2);

  // Build line segments
  const segments: React.ReactNode[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const x1 = toX(waypoints[i]!.lng), y1 = toY(waypoints[i]!.lat);
    const x2 = toX(waypoints[i + 1]!.lng), y2 = toY(waypoints[i + 1]!.lat);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) continue;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    segments.push(
      <View
        key={`seg-${i}`}
        style={{
          position: 'absolute',
          left: x1, top: y1 - 1.5,
          width: len, height: 3,
          backgroundColor: accentColor,
          borderRadius: 2,
          transformOrigin: '0 50%',
          transform: [{ rotate: `${angle}deg` }],
        }}
      />
    );
  }

  const Dot = ({ lat, lng, color, size: ds = 9 }: { lat: number; lng: number; color: string; size?: number }) => (
    <View style={{
      position: 'absolute',
      left: toX(lng) - ds / 2, top: toY(lat) - ds / 2,
      width: ds, height: ds, borderRadius: ds / 2,
      backgroundColor: color,
      borderWidth: 2, borderColor: '#fff',
    }} />
  );

  return (
    <View
      style={{ height, backgroundColor: bgColor, overflow: 'hidden' }}
      onLayout={onLayout}
    >
      {/* Subtle grid */}
      <View style={{ position: 'absolute', inset: 0, opacity: 0.06 }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <View key={`h${f}`} style={{ position: 'absolute', left: 0, right: 0, top: height * f, height: 1, backgroundColor: lineColor }} />
        ))}
        {[0.25, 0.5, 0.75].map((f) => (
          <View key={`v${f}`} style={{ position: 'absolute', top: 0, bottom: 0, left: size.w * f, width: 1, backgroundColor: lineColor }} />
        ))}
      </View>

      {segments}

      {/* Paradas intermedias */}
      {stops.map((s, i) => (
        <Dot key={`stop-${i}`} lat={s.lat} lng={s.lng} color="#F59E0B" size={7} />
      ))}

      {/* Inicio */}
      {waypoints[0] && <Dot lat={waypoints[0].lat} lng={waypoints[0].lng} color="#22C55E" size={12} />}
      {/* Fin */}
      {waypoints[waypoints.length - 1] && (
        <Dot lat={waypoints[waypoints.length - 1]!.lat} lng={waypoints[waypoints.length - 1]!.lng} color="#EF4444" size={12} />
      )}
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDuration(s?: number | null): string {
  if (!s) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}
function formatDistance(m?: number | null): string {
  if (!m) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

// ─── Tarjeta de ruta ─────────────────────────────────────────────────────────
function RouteCard({
  route,
  isActive,
  onPress,
}: {
  route: RouteItem;
  isActive: boolean;
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? '#1C1C2E' : '#F6F8FA';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: cardBg },
        isActive && { borderWidth: 1.5, borderColor: colors.accent + '50', backgroundColor: colors.accent + '12' },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Ruta ${route.name}`}
    >
      {/* Row: nombre + activo badge + chevron */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          {isActive && (
            <View style={styles.activePill}>
              <View style={[styles.activePillDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.activePillText, { color: colors.accent }]}>ACTIVA</Text>
            </View>
          )}
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>
            {route.name}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      {/* Timeline origen → destino */}
      <View style={styles.routeTimeline}>
        <View style={styles.timelinePoint}>
          <View style={[styles.timelineDot, { borderColor: '#22C55E' }]} />
          <Text style={[styles.timelineText, { color: colors.text }]} numberOfLines={1}>
            {route.origin_name}
          </Text>
        </View>

        {route.stops.length > 0 ? (
          <View style={styles.timelinePointPadded}>
            <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.timelineStopsText, { color: colors.textSecondary }]}>
              {route.stops.length} parada{route.stops.length !== 1 ? 's' : ''}
            </Text>
          </View>
        ) : (
          <View style={[styles.timelineLineOnly, { backgroundColor: colors.border }]} />
        )}

        <View style={styles.timelinePoint}>
          <View style={[styles.timelineDot, { borderColor: '#EF4444' }]} />
          <Text style={[styles.timelineText, { color: colors.text }]} numberOfLines={1}>
            {route.dest_name}
          </Text>
        </View>
      </View>

      {/* Mtricas */}
      {(route.total_distance_m || route.estimated_duration_s) ? (
        <View style={styles.metricsMinimal}>
          {route.total_distance_m ? (
            <View style={styles.metricChip}>
              <Ionicons name="navigate-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                {formatDistance(route.total_distance_m)}
              </Text>
            </View>
          ) : null}
          {route.estimated_duration_s ? (
            <View style={styles.metricChip}>
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                {formatDuration(route.estimated_duration_s)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Modal de detalle (Minimalista) ──────────────────────────────────────────
function RouteDetailModal({
  route,
  vehiclePlate,
  onClose,
  onStart,
}: {
  route: RouteItem | null;
  vehiclePlate: string;
  onClose: () => void;
  onStart: (route: RouteItem) => void;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const cardBg = isDark ? '#1C1C2E' : '#F6F8FA';
  const borderColor = isDark ? '#FFFFFF10' : '#0000000A';
  const sectionBg = isDark ? '#FFFFFF06' : '#00000006';

  if (!route) return null;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.detailRoot, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <Text style={[styles.detailTitle, { color: colors.text }]} numberOfLines={1}>
            {route.name}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.detailCloseBtn, { backgroundColor: cardBg }]}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Mapa estatico */}
        {route.waypoints.length >= 2 && (
          <View style={[styles.detailMap, { borderColor }]}>
            <StaticRouteMap
              waypoints={route.waypoints}
              stops={route.stops}
              accentColor={colors.accent}
              bgColor={cardBg}
              lineColor={colors.text}
              height={220}
            />
            {/* Leyenda */}
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Inicio</Text>
              </View>
              {route.stops.length > 0 && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>Paradas</Text>
                </View>
              )}
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Destino</Text>
              </View>
            </View>
          </View>
        )}

        {/* Body scrolleable */}
        <View style={[styles.detailBody, { flex: 1 }]}>
          {/* Vehículo y metricas */}
          <View style={[styles.detailInfoRow, { backgroundColor: sectionBg, borderColor }]}>
            <View style={styles.detailInfoItem}>
              <Text style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Unidad</Text>
              <Text style={[styles.detailInfoValue, { color: colors.text }]}>{vehiclePlate}</Text>
            </View>
            {route.total_distance_m ? (
              <View style={styles.detailInfoItem}>
                <Text style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Distancia</Text>
                <Text style={[styles.detailInfoValue, { color: colors.text }]}>{formatDistance(route.total_distance_m)}</Text>
              </View>
            ) : null}
            {route.estimated_duration_s ? (
              <View style={styles.detailInfoItem}>
                <Text style={[styles.detailInfoLabel, { color: colors.textSecondary }]}>Estimado</Text>
                <Text style={[styles.detailInfoValue, { color: colors.text }]}>{formatDuration(route.estimated_duration_s)}</Text>
              </View>
            ) : null}
          </View>

          {/* Paradas */}
          <Text style={[styles.detailSectionLabel, { color: colors.textSecondary }]}>Recorrido</Text>
          <View style={styles.detailSection}>
            <View style={styles.detailStopRow}>
              <View style={[styles.stopDot, { borderColor: '#22C55E' }]} />
              <Text style={[styles.detailStopText, { color: colors.text }]}>{route.origin_name}</Text>
            </View>
            {route.stops.map((s, i) => (
              <View key={i} style={styles.detailStopRow}>
                <View style={[styles.stopDot, { borderColor: colors.accent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailStopText, { color: colors.text }]}>{s.name}</Text>
                  {s.address ? (
                    <Text style={[styles.detailStopAddr, { color: colors.textSecondary }]}>{s.address}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            <View style={styles.detailStopRow}>
              <View style={[styles.stopDot, { borderColor: '#EF4444' }]} />
              <Text style={[styles.detailStopText, { color: colors.text }]}>{route.dest_name}</Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        <View style={[styles.detailFooter, { borderTopColor: borderColor, paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : 24 }]}>
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: colors.accent }]}
            onPress={() => onStart(route)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Iniciar ruta"
          >
            <View style={styles.startBtnInner}>
              <Text style={styles.startBtnText}>Iniciar navegación</Text>
              <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export function RoutesScreen() {
  const navigation = useNavigation<NavProp>();
  const [data, setData] = useState<DriverAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const fetchAssignment = useCallback(async () => {
    try {
      // Siempre refresca el token antes de llamar al API para evitar
      // errores 401 por tokens expirados cacheados en getSession().
      const { data: { session } } = await supabase.auth.refreshSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(`${API_URL}/api/v1/driver/assignment`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);

      const assignment = (await res.json()) as DriverAssignment;
      // Back-compat: if old API, build routes from activeRoute
      if (!assignment.routes) {
        assignment.routes = assignment.activeRoute ? [assignment.activeRoute] : [];
      }
      setData(assignment);
      if (assignment.vehicle) {
        setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID, assignment.vehicle.id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar rutas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refrescar rutas cada vez que el conductor navega de vuelta a esta pantalla.
  // RoutesScreen permanece montado por el tab navigator — sin isFocused el fetch
  // solo ocurre al primer montaje y cuando dispara realtime, lo que puede perderse.
  useEffect(() => {
    if (!isFocused) return;
    void fetchAssignment();
  }, [isFocused, fetchAssignment]);

  // Realtime
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user.id ?? null);
    });
  }, []);
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`driver-assignment-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles', filter: `assigned_driver_id=eq.${currentUserId}` },
        () => { void fetchAssignment(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_user_assignments', filter: `user_id=eq.${currentUserId}` },
        () => { void fetchAssignment(); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'routes' },
        () => { void fetchAssignment(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUserId, fetchAssignment]);

  const handleStartRoute = useCallback(async (route: RouteItem) => {
    if (!data?.vehicle) return;
    setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID,      data.vehicle.id);
    setStr(MMKV_KEYS.ACTIVE_ROUTE_ID,        route.id);
    setStr(MMKV_KEYS.ACTIVE_ROUTE_NAME,      route.name);
    setStr(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS, JSON.stringify(route.waypoints));
    setStr(MMKV_KEYS.ACTIVE_ROUTE_STOPS,     JSON.stringify(route.stops));

    // Crear el viaje en Supabase para que aparezca en historial
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      // tenant_id se lee de user_metadata del JWT (más confiable que depender del DEFAULT de la BD)
      const tenantId = (user?.user_metadata?.tenant_id as string | undefined) ?? null;
      const origin = route.waypoints[0];
      const dest   = route.waypoints[route.waypoints.length - 1];
      if (user && origin && dest && tenantId) {
        const { data: newTrip, error: tripErr } = await supabase
          .from('trips')
          .insert({
            driver_id:   user.id,
            vehicle_id:  data.vehicle.id,
            route_id:    route.id,
            tenant_id:   tenantId,
            origin_name: route.origin_name,
            origin_lat:  origin.lat,
            origin_lng:  origin.lng,
            dest_name:   route.dest_name,
            dest_lat:    dest.lat,
            dest_lng:    dest.lng,
            status:      'in_transit',
            started_at:  new Date().toISOString(),
            estimated_distance_km: route.total_distance_m ? route.total_distance_m / 1000 : null,
            estimated_duration_min: route.estimated_duration_s ? Math.round(route.estimated_duration_s / 60) : null,
          })
          .select('id')
          .single();
        if (!tripErr && newTrip?.id) {
          setStr(MMKV_KEYS.ACTIVE_TRIP_ID, newTrip.id);
          console.log('[RoutesScreen] Viaje creado:', newTrip.id);
        } else {
          const msg = tripErr?.message ?? 'error desconocido';
          console.warn('[RoutesScreen] No se pudo crear el viaje:', msg);
          Alert.alert('Error al crear viaje', `El historial no se guardará.\n\n${msg}\n\ntenant:${tenantId}\ndriver:${user.id}`);
        }
      } else if (!tenantId) {
        console.warn('[RoutesScreen] tenant_id no disponible en el JWT');
        Alert.alert('Sesión incompleta', 'Cierra sesión y vuelve a entrar para actualizar tu token.');
      }
    } catch (e) {
      console.warn('[RoutesScreen] Error al crear viaje:', e);
    }

    setSelectedRoute(null);
    navigation.navigate('Map');
  }, [data, navigation]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando rutas...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Ionicons name="alert-circle-outline" size={56} color={colors.danger} style={{ marginBottom: 8 }} />
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.accent }]}
          onPress={() => { setLoading(true); void fetchAssignment(); }}
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data?.vehicle) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Ionicons name="bus-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 8, opacity: 0.8 }} />
        <Text style={[styles.stateTitle, { color: colors.text }]}>Sin vehículo asignado</Text>
        <Text style={[styles.stateSub, { color: colors.textSecondary }]}>
          Tu supervisor aún no te ha asignado una unidad.{'\n'}
          Contacta a tu monitor para que te asigne un vehículo.
        </Text>
      </View>
    );
  }

  const routes = data.routes ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>


      {routes.length === 0 ? (
        <View style={[styles.centered, { flex: 1 }]}>
          <Ionicons name="map-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 8, opacity: 0.8 }} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Sin rutas asignadas</Text>
          <Text style={[styles.stateSub, { color: colors.textSecondary }]}>
            Tu vehículo no tiene rutas activas.{'\n'}
            Espera a que tu supervisor te asigne una.
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchAssignment(); }}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => (
            <RouteCard
              route={item}
              isActive={item.status === 'active'}
              onPress={() => setSelectedRoute(item)}
            />
          )}
        />
      )}

      {/* Detail modal */}
      {selectedRoute ? (
        <RouteDetailModal
          route={selectedRoute}
          vehiclePlate={data.vehicle.plate}
          onClose={() => setSelectedRoute(null)}
          onStart={handleStartRoute}
        />
      ) : null}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { marginTop: 8, fontSize: 14, fontWeight: '500' },
  errorIcon: { fontSize: 40 },
  errorText: { textAlign: 'center', fontSize: 14, maxWidth: 260 },
  retryBtn: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  stateIcon: { fontSize: 56, marginBottom: 8 },
  stateTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  stateSub: { fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300, marginTop: 4 },

  // Header
  screenHeader: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  screenTitle: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  screenSub: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6 },
  screenDesc: { fontSize: 15, fontWeight: '400' },

  vehiclePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, padding: 12, marginTop: 6,
  },
  vehiclePillPlate: { fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  vehiclePillAlias: { fontSize: 12, marginTop: 1 },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, gap: 16 },

  // Card
  card: {
    borderRadius: 18, padding: 25, gap: 14,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardName: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 4,
  },
  activePillDot: { width: 6, height: 6, borderRadius: 3 },
  activePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statusBadgeActive: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusActiveText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  routeTimeline: { gap: 0 },
  timelinePoint: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelinePointPadded: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  timelineDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: 'transparent' },
  timelineLine: { width: 2, height: 24, borderRadius: 1, marginLeft: 6 },
  timelineLineOnly: { width: 2, height: 16, borderRadius: 1, marginLeft: 6, marginVertical: 4 },
  timelineText: { fontSize: 16, fontWeight: '600', flex: 1 },
  timelineStopsText: { fontSize: 14, fontWeight: '400', flex: 1 },

  metricsMinimal: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap',
  },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { fontSize: 13, fontWeight: '500' },
  metricDot: { fontSize: 11 },

  // Detail modal styles
  detailRoot: { flex: 1 },
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16,
  },
  detailCloseBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: 22, fontWeight: '700', flex: 1 },
  detailMap: { height: 220, borderRadius: 16, marginHorizontal: 24, overflow: 'hidden', borderWidth: 1 },
  mapLegend: {
    position: 'absolute', bottom: 10, left: 14,
    flexDirection: 'row', gap: 12, alignItems: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: '600' },
  detailBody: { paddingHorizontal: 24, paddingTop: 20, gap: 16 },
  detailInfoRow: {
    flexDirection: 'row', borderRadius: 14, padding: 16,
    borderWidth: 1, gap: 0, justifyContent: 'space-between',
  },
  detailInfoItem: { alignItems: 'center', gap: 3 },
  detailInfoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  detailInfoValue: { fontSize: 18, fontWeight: '700' },
  detailSectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4,
  },
  detailSection: { gap: 14 },
  detailStopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stopDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: 'transparent', marginTop: 3, flexShrink: 0 },
  detailStopText: { fontSize: 16, fontWeight: '600', flex: 1 },
  detailStopAddr: { fontSize: 13, marginTop: 2 },
  detailFooter: {
    paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1,
  },
  startBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  startBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  // legacy — keep to avoid RN style lookup errors
  detailChip: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  detailChipLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  detailChipValue: { fontSize: 18, fontWeight: '600' },
  detailMetrics: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1 },
  detailMetric: { gap: 4 },
  detailMetricValue: { fontSize: 22, fontWeight: '800' },
  detailMetricLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
