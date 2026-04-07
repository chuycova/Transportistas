// ─── RoutePickerScreen.tsx ────────────────────────────────────────────────────
// El conductor selecciona la ruta asignada antes de iniciar tracking.
// Consulta el backend: GET /vehicles/mine → obtiene vehicleId + rutas asignadas.
// Guarda la selección en MMKV para que el tracking hook la use.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Route } from '@zona-zero/domain';
import { supabase } from '@lib/supabase';
import { setStr } from '@lib/mmkv';
import { MMKV_KEYS, API_URL } from '@lib/constants';
import type { RootStackParamList } from '@navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'RoutePicker'>;

interface AssignedRoute {
  id: string;
  name: string;
  originName: string;
  destinationName: string;
  estimatedDurationS?: number;
  status: string;
}

interface VehicleResponse {
  vehicleId: string;
  plate: string;
  alias?: string;
  assignedRoutes: AssignedRoute[];
}

export function RoutePickerScreen() {
  const navigation = useNavigation<NavProp>();
  const [vehicleData, setVehicleData] = useState<VehicleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicle = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(`${API_URL}/api/v1/vehicles/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as VehicleResponse;
      setVehicleData(data);
      setError(null);

      // Guardar vehicleId en MMKV para el tracking
      setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID, data.vehicleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar rutas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchVehicle(); }, [fetchVehicle]);

  const selectRoute = (route: AssignedRoute) => {
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
        <TouchableOpacity style={styles.retryBtn} onPress={fetchVehicle}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header del vehículo */}
      <View style={styles.vehicleCard}>
        <Text style={styles.vehicleLabel}>Vehículo asignado</Text>
        <Text style={styles.vehiclePlate}>{vehicleData?.plate}</Text>
        {vehicleData?.alias ? (
          <Text style={styles.vehicleAlias}>{vehicleData.alias}</Text>
        ) : null}
      </View>

      {/* Lista de rutas */}
      <Text style={styles.sectionTitle}>Selecciona tu ruta</Text>

      {vehicleData?.assignedRoutes.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No tienes rutas asignadas.</Text>
          <Text style={styles.emptySubText}>Contacta a tu supervisor.</Text>
        </View>
      ) : (
        <FlatList
          data={vehicleData?.assignedRoutes ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchVehicle(); }}
              tintColor="#6C63FF"
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.routeCard}
              onPress={() => selectRoute(item)}
              accessibilityLabel={`Ruta ${item.name}, de ${item.originName} a ${item.destinationName}`}
              accessibilityRole="button"
            >
              <View style={styles.routeHeader}>
                <Text style={styles.routeName}>{item.name}</Text>
                {item.estimatedDurationS ? (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{formatDuration(item.estimatedDurationS)}</Text>
                  </View>
                ) : null}
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
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#6C63FF44',
  },
  vehicleLabel: { color: '#8888AA', fontSize: 12, letterSpacing: 1, marginBottom: 4 },
  vehiclePlate: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: 2 },
  vehicleAlias: { color: '#8888AA', fontSize: 14, marginTop: 4 },
  sectionTitle: {
    color: '#8888AA',
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
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
  routeName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1 },
  durationBadge: { backgroundColor: '#6C63FF22', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  durationText: { color: '#6C63FF', fontSize: 12, fontWeight: '600' },
  routeRoute: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  routeOrigin: { color: '#8888AA', fontSize: 13 },
  routeArrow: { color: '#4A4A6A', fontSize: 13 },
  routeDest: { color: '#8888AA', fontSize: 13 },
  loadingText: { color: '#8888AA', marginTop: 12, fontSize: 14 },
  errorIcon: { fontSize: 40 },
  errorText: { color: '#FF6B6B', textAlign: 'center', fontSize: 14, maxWidth: 260 },
  retryBtn: { backgroundColor: '#6C63FF', borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: '#FFFFFF', fontSize: 16 },
  emptySubText: { color: '#8888AA', fontSize: 13 },
});
