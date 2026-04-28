// ─── RoutesScreen.tsx ─────────────────────────────────────────────────────────
// Pantalla unificada de rutas del conductor.
//
// Secciones:
//   En Curso   — viajes activos/pausados (in_transit, at_destination, paused)
//   Asignadas  — rutas asignadas aún sin viaje iniciado
//
// La pantalla "Viajes" fue eliminada del tab nav y su contenido vive aquí.

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@lib/ThemeContext';
import { setStr, storage } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';
import { activateRoute } from '@features/trips/lib/activateRoute';
import { useTrips, updateTripStatus, type DriverTrip } from '@features/trips/hooks/useTrips';
import { TripStatusBadge } from '@features/trips/components/TripStatusBadge';
import { fmtDate, fmtDistance, fmtDuration } from '@features/trips/lib/formatters';
import type { RootStackParamList } from '@navigation/RootNavigator';
import type { MainTabParamList } from '@navigation/MainTabNavigator';
import { RouteCard } from '../components/RouteCard';
import { RouteDetailModal } from '../components/RouteDetailModal';
import type { RouteItem } from '../types';
import { useDriverAssignment } from '../hooks/useDriverAssignment';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Routes'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Sección header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      <View style={[styles.sectionBadge, { backgroundColor: color + '22' }]}>
        <Text style={[styles.sectionBadgeText, { color }]}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Tarjeta de viaje en curso ────────────────────────────────────────────────

interface InCourseCardProps {
  trip: DriverTrip;
  onStart: () => void;
  onAtDestination: () => void;
  onComplete: () => void;
}

function InCourseCard({ trip, onStart, onAtDestination, onComplete }: InCourseCardProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tripCard, { backgroundColor: colors.surface, borderColor: colors.accent + '44' }]}>
      <View style={styles.tripCardHeader}>
        <Text style={[styles.tripCode, { color: colors.textSecondary }]}>{trip.code}</Text>
        <TripStatusBadge status={trip.status} />
      </View>

      {/* Trayecto origen → destino */}
      <View style={styles.routeSection}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#22C55E' }]} />
          <Text style={[styles.routePointText, { color: colors.text }]} numberOfLines={1}>
            {trip.origin_name}
          </Text>
        </View>
        <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
          <Text style={[styles.routePointText, { color: colors.text }]} numberOfLines={1}>
            {trip.dest_name}
          </Text>
        </View>
      </View>

      {/* Métricas */}
      {(trip.estimated_distance_km || trip.estimated_duration_min || trip.scheduled_at) && (
        <View style={[styles.metricsRow, { backgroundColor: colors.surfaceAlt }]}>
          {fmtDistance(trip.estimated_distance_km) ? (
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: colors.text }]}>{fmtDistance(trip.estimated_distance_km)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>distancia</Text>
            </View>
          ) : null}
          {fmtDuration(trip.estimated_duration_min) ? (
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: colors.text }]}>{fmtDuration(trip.estimated_duration_min)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>estimado</Text>
            </View>
          ) : null}
          {fmtDate(trip.scheduled_at) ? (
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: colors.text }]}>{fmtDate(trip.scheduled_at)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>programado</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Acciones según estado */}
      {trip.status === 'confirmed' && (
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={onStart}>
          <Text style={styles.actionBtnText}>Iniciar viaje</Text>
        </TouchableOpacity>
      )}
      {trip.status === 'paused' && (
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={onStart}>
          <Text style={styles.actionBtnText}>Reanudar viaje</Text>
        </TouchableOpacity>
      )}
      {trip.status === 'in_transit' && (
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0891B2' }]} onPress={onAtDestination}>
          <Text style={styles.actionBtnText}>He llegado al destino</Text>
        </TouchableOpacity>
      )}
      {trip.status === 'at_destination' && (
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#16A34A' }]} onPress={onComplete}>
          <Text style={styles.actionBtnText}>Completar viaje</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export function RoutesScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, loading: loadingRoutes, refreshing, error: routeError, refresh } = useDriverAssignment();
  const { activeTrip, pastTrips: _pastTrips, loading: loadingTrips, error: tripError, refetch } = useTrips();
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const loading = loadingRoutes || loadingTrips;
  const error = routeError ?? tripError;

  // ── Acciones de viaje activo ─────────────────────────────────────────────
  const handleTripAction = useCallback(async (action: 'start' | 'resume' | 'atDest' | 'complete', trip: DriverTrip) => {
    try {
      if (action === 'start' || action === 'resume') {
        await updateTripStatus(trip.id, 'in_transit', { started_at: new Date().toISOString() });
        setStr(MMKV_KEYS.ACTIVE_TRIP_ID, trip.id);
        if (trip.route_id) setStr(MMKV_KEYS.ACTIVE_ROUTE_ID, trip.route_id);
        navigation.navigate('Map');
      } else if (action === 'atDest') {
        await updateTripStatus(trip.id, 'at_destination');
        void refetch();
      } else if (action === 'complete') {
        await updateTripStatus(trip.id, 'completed', { completed_at: new Date().toISOString() });
        storage.delete(MMKV_KEYS.ACTIVE_TRIP_ID);
        void refetch();
      }
    } catch (e) {
      console.error('[RoutesScreen] trip action error:', e);
    }
  }, [navigation, refetch]);

  // ── Iniciar ruta nueva desde asignación ─────────────────────────────────
  const handleStartRoute = useCallback((route: RouteItem) => {
    if (!data?.vehicle) return;
    activateRoute({ route, vehicleId: data.vehicle.id });
    setSelectedRoute(null);
    navigation.navigate('Map');
  }, [data, navigation]);

  // ── Reanudar ruta pausada ────────────────────────────────────────────────
  const handleResumeRoute = useCallback((pausedTrip: DriverTrip) => {
    if (!data?.vehicle) return;
    const route = data.routes.find((r) => r.id === pausedTrip.route_id);
    if (route) {
      setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID,      data.vehicle.id);
      setStr(MMKV_KEYS.ACTIVE_ROUTE_ID,        route.id);
      setStr(MMKV_KEYS.ACTIVE_ROUTE_NAME,      route.name);
      setStr(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS, JSON.stringify(route.waypoints));
      setStr(MMKV_KEYS.ACTIVE_ROUTE_STOPS,     JSON.stringify(route.stops));
    }
    setStr(MMKV_KEYS.ACTIVE_TRIP_ID, pausedTrip.id);
    storage.set(MMKV_KEYS.TRIP_IS_PAUSED, true);
    storage.set(MMKV_KEYS.TRIP_PAUSED_PCT, pausedTrip.progress_pct ?? 0);
    if (pausedTrip.last_waypoint_idx != null) {
      storage.set(MMKV_KEYS.LAST_WAYPOINT_IDX, pausedTrip.last_waypoint_idx);
    }
    setSelectedRoute(null);
    navigation.navigate('Map');
  }, [data, navigation]);

  // ── Partición: viajes en curso vs rutas sin viaje ────────────────────────
  // Un trip "en curso" es cualquiera con status activo (incluyendo paused)
  const activeStatuses = new Set(['confirmed', 'in_transit', 'at_destination', 'paused']);
  const inCourseTrips: DriverTrip[] = [];
  if (activeTrip && activeStatuses.has(activeTrip.status)) {
    inCourseTrips.push(activeTrip);
  }
  const inCourseRouteIds = new Set(inCourseTrips.map((t) => t.route_id).filter(Boolean));

  // Rutas asignadas que NO tienen un viaje activo en este momento
  const assignedRoutes = (data?.routes ?? []).filter((r) => !inCourseRouteIds.has(r.id));

  // ── Loading / Error / Sin vehículo ────────────────────────────────────────
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
          onPress={() => { refresh(); void refetch(); }}
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

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { refresh(); void refetch(); }}
            tintColor={colors.accent}
          />
        }
      >
        {/* ── En Curso ────────────────────────────────────────────────────── */}
        <SectionHeader
          title="EN CURSO"
          count={inCourseTrips.length}
          color={colors.accent}
        />
        {inCourseTrips.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="navigate-outline" size={28} color={colors.textSecondary} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyCardText, { color: colors.textSecondary }]}>
              No hay viajes activos en este momento
            </Text>
          </View>
        ) : (
          inCourseTrips.map((trip) => (
            <InCourseCard
              key={trip.id}
              trip={trip}
              onStart={() => { void handleTripAction('start', trip); }}
              onAtDestination={() => { void handleTripAction('atDest', trip); }}
              onComplete={() => { void handleTripAction('complete', trip); }}
            />
          ))
        )}

        {/* ── Asignadas ───────────────────────────────────────────────────── */}
        <SectionHeader
          title="ASIGNADAS"
          count={assignedRoutes.length}
          color={colors.textSecondary}
        />
        {assignedRoutes.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="map-outline" size={28} color={colors.textSecondary} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyCardText, { color: colors.textSecondary }]}>
              Sin rutas pendientes por iniciar
            </Text>
          </View>
        ) : (
          assignedRoutes.map((route) => {
            const routeIsPaused = activeTrip?.status === 'paused' && activeTrip.route_id === route.id;
            return (
              <RouteCard
                key={route.id}
                route={route}
                isActive={route.status === 'active' && !routeIsPaused}
                isPaused={routeIsPaused}
                progressPct={routeIsPaused ? (activeTrip?.progress_pct ?? 0) : undefined}
                onPress={() => setSelectedRoute(route)}
              />
            );
          })
        )}
      </ScrollView>

      {selectedRoute ? (
        <RouteDetailModal
          route={selectedRoute}
          vehiclePlate={data.vehicle.plate}
          onClose={() => setSelectedRoute(null)}
          onStart={handleStartRoute}
          pausedTrip={
            activeTrip?.status === 'paused' && activeTrip.route_id === selectedRoute.id
              ? activeTrip
              : null
          }
          onResume={handleResumeRoute}
        />
      ) : null}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:         { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText:  { marginTop: 8, fontSize: 14, fontWeight: '500' },
  errorText:    { textAlign: 'center', fontSize: 14, maxWidth: 260 },
  retryBtn:     { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  retryText:    { color: '#fff', fontWeight: '600', fontSize: 15 },
  stateTitle:   { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  stateSub:     { fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300, marginTop: 4 },

  // Sección
  sectionRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 4 },
  sectionTitle:     { fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  sectionBadge:     { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 11, fontWeight: '700' },

  // Tarjeta vacía
  emptyCard:     { flexDirection: 'row', alignItems: 'center', gap: 12,
                   borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  emptyCardText: { fontSize: 14, flex: 1 },

  // Tarjeta viaje en curso
  tripCard:       { borderRadius: 18, padding: 18, borderWidth: 1 },
  tripCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  tripCode:       { fontSize: 11, fontFamily: 'monospace', fontWeight: '600' },
  routeSection:   { gap: 4, marginBottom: 12 },
  routePoint:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot:       { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeLine:      { width: 1, height: 14, marginLeft: 3.5 },
  routePointText: { fontSize: 14, flex: 1 },
  metricsRow:     { flexDirection: 'row', justifyContent: 'space-around', borderRadius: 12,
                    padding: 12, marginBottom: 12 },
  metric:         { alignItems: 'center' },
  metricValue:    { fontSize: 14, fontWeight: '700' },
  metricLabel:    { fontSize: 10, marginTop: 2 },
  divider:        { height: 1, marginBottom: 14 },
  actionBtn:      { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  actionBtnText:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
