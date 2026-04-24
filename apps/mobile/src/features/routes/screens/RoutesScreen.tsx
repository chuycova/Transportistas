// ─── RoutesScreen.tsx ─────────────────────────────────────────────────────────
// Lista de rutas asignadas al vehículo del conductor. El conductor puede
// seleccionar una para ver detalles e iniciar/reanudar la navegación.

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, FlatList, ScrollView,
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
import { useTrips, type DriverTrip } from '@features/trips/hooks/useTrips';
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

export function RoutesScreen() {
  const navigation = useNavigation<NavProp>();
  const { data, loading, refreshing, error, refresh } = useDriverAssignment();
  const { activeTrip } = useTrips();
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // ── Iniciar ruta nueva ─────────────────────────────────────────────────────
  const handleStartRoute = useCallback((route: RouteItem) => {
    if (!data?.vehicle) return;

    activateRoute({
      route,
      vehicleId: data.vehicle.id,
    });

    setSelectedRoute(null);
    navigation.navigate('Map');
  }, [data, navigation]);

  // El trip ya existe en DB con status 'paused'; solo hay que escribir el ID
  // y datos de ruta en MMKV para que la pantalla de Mapa muestre el bottom
  // sheet en modo pausado. El conductor pulsará "Reanudar" en el sheet, que
  // marcará el trip como in_transit via useTrackingToggle.
  const handleResumeRoute = useCallback((pausedTrip: DriverTrip) => {
    if (!data?.vehicle) return;

    // Asegurarse de que MMKV refleja la ruta correcta
    const route = data.routes.find((r) => r.id === pausedTrip.route_id);
    if (route) {
      setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID,      data.vehicle.id);
      setStr(MMKV_KEYS.ACTIVE_ROUTE_ID,        route.id);
      setStr(MMKV_KEYS.ACTIVE_ROUTE_NAME,      route.name);
      setStr(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS, JSON.stringify(route.waypoints));
      setStr(MMKV_KEYS.ACTIVE_ROUTE_STOPS,     JSON.stringify(route.stops));
    }

    // Escribir trip + estado de pausa en MMKV para que el BottomSheet lo muestre
    setStr(MMKV_KEYS.ACTIVE_TRIP_ID, pausedTrip.id);
    storage.set(MMKV_KEYS.TRIP_IS_PAUSED, true);
    storage.set(MMKV_KEYS.TRIP_PAUSED_PCT, pausedTrip.progress_pct ?? 0);
    if (pausedTrip.last_waypoint_idx != null) {
      storage.set(MMKV_KEYS.LAST_WAYPOINT_IDX, pausedTrip.last_waypoint_idx);
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
          onPress={refresh}
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
        <ScrollView
          contentContainerStyle={[styles.centered, { flex: 1 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
          }
        >
          <Ionicons name="map-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 8, opacity: 0.8 }} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Sin rutas asignadas</Text>
          <Text style={[styles.stateSub, { color: colors.textSecondary }]}>
            Tu vehículo no tiene rutas activas.{'\n'}
            Jala hacia abajo para refrescar.
          </Text>
        </ScrollView>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
          }
          renderItem={({ item }) => {
            const routeIsPaused =
              activeTrip?.status === 'paused' && activeTrip.route_id === item.id;
            return (
              <RouteCard
                route={item}
                isActive={item.status === 'active' && !routeIsPaused}
                isPaused={routeIsPaused}
                progressPct={routeIsPaused ? (activeTrip?.progress_pct ?? 0) : undefined}
                onPress={() => setSelectedRoute(item)}
              />
            );
          }}
        />
      )}

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

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  loadingText: { marginTop: 8, fontSize: 14, fontWeight: '500' },
  errorText: { textAlign: 'center', fontSize: 14, maxWidth: 260 },
  retryBtn: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  stateTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  stateSub: { fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300, marginTop: 4 },

  list: { paddingHorizontal: 20, paddingTop: 4, gap: 16 },
});
