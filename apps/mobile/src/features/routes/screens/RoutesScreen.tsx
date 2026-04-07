// ─── RoutesScreen.tsx ─────────────────────────────────────────────────────────
// Tab de rutas: intenta obtener el vehículo asignado al conductor.
// Si no tiene vehículo asignado (404) muestra todas las rutas activas del tenant.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@lib/supabase';
import { setStr } from '@lib/mmkv';
import { MMKV_KEYS, API_URL } from '@lib/constants';
import type { RootStackParamList } from '@navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

interface RouteItem {
  id: string;
  name: string;
  originName: string;
  destinationName: string;
  estimatedDurationS?: number;
  status: string;
}

interface VehicleData {
  vehicleId: string;
  plate: string;
  alias?: string;
  assignedRoutes: RouteItem[];
}

export function RoutesScreen() {
  const navigation = useNavigation<NavProp>();
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noVehicle, setNoVehicle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const headers = { Authorization: `Bearer ${session.access_token}` };

      // Intentar obtener vehículo asignado
      const vehicleRes = await fetch(`${API_URL}/api/v1/vehicles/mine`, { headers });

      if (vehicleRes.ok) {
        const data = (await vehicleRes.json()) as VehicleData;
        setVehicleData(data);
        setRoutes(data.assignedRoutes);
        setNoVehicle(false);
        setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID, data.vehicleId);
      } else if (vehicleRes.status === 404) {
        // Sin vehículo asignado — mostrar todas las rutas activas del tenant
        setNoVehicle(true);
        setVehicleData(null);

        const routesRes = await fetch(`${API_URL}/api/v1/routes?status=active`, { headers });
        if (!routesRes.ok) throw new Error(`Error ${routesRes.status} cargando rutas`);
        const data = (await routesRes.json()) as RouteItem[];
        setRoutes(data);
      } else {
        throw new Error(`Error ${vehicleRes.status}: ${await vehicleRes.text()}`);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar rutas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const selectRoute = (route: RouteItem) => {
    setStr(MMKV_KEYS.ACTIVE_ROUTE_ID, route.id);
    navigation.navigate('Tracking', { routeId: route.id, routeName: route.name });
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Cargando rutas...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); void fetchData(); }}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tarjeta de vehículo o aviso sin asignación */}
      {vehicleData ? (
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleLabel}>VEHÍCULO ASIGNADO</Text>
          <Text style={styles.vehiclePlate}>{vehicleData.plate}</Text>
          {vehicleData.alias ? (
            <Text style={styles.vehicleAlias}>{vehicleData.alias}</Text>
          ) : null}
        </View>
      ) : noVehicle ? (
        <View style={styles.noVehicleBanner}>
          <Text style={styles.noVehicleIcon}>🚛</Text>
          <View style={styles.noVehicleText}>
            <Text style={styles.noVehicleTitle}>Sin vehículo asignado</Text>
            <Text style={styles.noVehicleSub}>Contacta a tu supervisor para que te asigne una unidad.</Text>
          </View>
        </View>
      ) : null}

      {/* Lista de rutas */}
      <Text style={styles.sectionTitle}>
        {vehicleData ? 'Rutas asignadas' : 'Rutas disponibles'}
      </Text>

      {routes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No hay rutas disponibles.</Text>
          <Text style={styles.emptySubText}>Contacta a tu supervisor.</Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchData(); }}
              tintColor="#6C63FF"
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.routeCard}
              onPress={() => selectRoute(item)}
              accessibilityLabel={`Ruta ${item.name}`}
              accessibilityRole="button"
            >
              <View style={styles.routeHeader}>
                <Text style={styles.routeName}>{item.name}</Text>
                <View style={styles.rightBadges}>
                  {item.estimatedDurationS ? (
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>{formatDuration(item.estimatedDurationS)}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.statusBadge, item.status === 'active' ? styles.badgeActive : styles.badgeDraft]}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.routeRoute}>
                <Text style={styles.routeOrigin}>📍 {item.originName}</Text>
                <Text style={styles.routeArrow}>→</Text>
                <Text style={styles.routeDest}>{item.destinationName} 🏁</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
    gap: 12,
  },
  vehicleCard: {
    backgroundColor: '#12121C',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#6C63FF44',
  },
  vehicleLabel: { color: '#6C63FF', fontSize: 11, letterSpacing: 1.5, fontWeight: '700', marginBottom: 4 },
  vehiclePlate: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: 2 },
  vehicleAlias: { color: '#8888AA', fontSize: 14, marginTop: 4 },
  noVehicleBanner: {
    backgroundColor: '#1C1410',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF9F4444',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noVehicleIcon: { fontSize: 28 },
  noVehicleText: { flex: 1, gap: 2 },
  noVehicleTitle: { color: '#FFBB55', fontSize: 14, fontWeight: '600' },
  noVehicleSub: { color: '#8888AA', fontSize: 12, lineHeight: 16 },
  sectionTitle: {
    color: '#8888AA',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  routeCard: {
    backgroundColor: '#12121C',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A3F',
  },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  routeName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  rightBadges: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  durationBadge: { backgroundColor: '#6C63FF22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  durationText: { color: '#6C63FF', fontSize: 11, fontWeight: '600' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeActive: { backgroundColor: '#22C55E22' },
  badgeDraft: { backgroundColor: '#8888AA22' },
  statusText: { color: '#8888AA', fontSize: 11 },
  routeRoute: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  routeOrigin: { color: '#8888AA', fontSize: 12 },
  routeArrow: { color: '#4A4A6A', fontSize: 12 },
  routeDest: { color: '#8888AA', fontSize: 12 },
  loadingText: { color: '#8888AA', marginTop: 12, fontSize: 14 },
  errorIcon: { fontSize: 40 },
  errorText: { color: '#FF6B6B', textAlign: 'center', fontSize: 14, maxWidth: 260 },
  retryBtn: { backgroundColor: '#6C63FF', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: '#FFFFFF', fontSize: 16 },
  emptySubText: { color: '#8888AA', fontSize: 13 },
});
