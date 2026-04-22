// ─── RoutePickerScreen.tsx ────────────────────────────────────────────────────
// El conductor selecciona la ruta asignada antes de iniciar tracking.

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
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@lib/supabase';
import { useTheme } from '@lib/ThemeContext';
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
  const { colors, isDark } = useTheme();

  const cardBg = isDark ? '#1C1C2E' : '#F6F8FA';
  const borderColor = isDark ? '#FFFFFF10' : '#0000000A';

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
          onPress={fetchVehicle}
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header del vehículo */}
      <View style={[styles.vehicleCard, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.vehicleLabel, { color: colors.textSecondary }]}>Vehículo asignado</Text>
        <Text style={[styles.vehiclePlate, { color: colors.text }]}>{vehicleData?.plate}</Text>
        {vehicleData?.alias ? (
          <Text style={[styles.vehicleAlias, { color: colors.textSecondary }]}>{vehicleData.alias}</Text>
        ) : null}
      </View>

      {/* Lista de rutas */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Selecciona tu ruta</Text>

      {vehicleData?.assignedRoutes.length === 0 ? (
        <View style={[styles.centered, { backgroundColor: colors.bg }]}>
          <Text style={[styles.emptyText, { color: colors.text }]}>No tienes rutas asignadas.</Text>
          <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>Contacta a tu supervisor.</Text>
        </View>
      ) : (
        <FlatList
          data={vehicleData?.assignedRoutes ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); void fetchVehicle(); }}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.routeCard, { backgroundColor: cardBg, borderColor }]}
              onPress={() => selectRoute(item)}
              activeOpacity={0.8}
              accessibilityLabel={`Ruta ${item.name}, de ${item.originName} a ${item.destinationName}`}
              accessibilityRole="button"
            >
              <View style={styles.routeHeader}>
                <Text style={[styles.routeName, { color: colors.text }]}>{item.name}</Text>
                {item.estimatedDurationS ? (
                  <View style={[styles.durationBadge, { backgroundColor: colors.accent + '22' }]}>
                    <Text style={[styles.durationText, { color: colors.accent }]}>{formatDuration(item.estimatedDurationS)}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.routeRoute}>
                <Ionicons name="location" size={14} color="#22C55E" />
                <Text style={[styles.routeOrigin, { color: colors.textSecondary }]}>{item.originName}</Text>
                
                <Ionicons name="arrow-forward" size={14} color={colors.textMuted} style={{ marginHorizontal: 4 }} />
                
                <Ionicons name="flag" size={14} color="#EF4444" />
                <Text style={[styles.routeDest, { color: colors.textSecondary }]}>{item.destinationName}</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  vehicleCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  vehicleLabel: { fontSize: 12, letterSpacing: 1, marginBottom: 4 },
  vehiclePlate: { fontSize: 28, fontWeight: '700', letterSpacing: 2 },
  vehicleAlias: { fontSize: 14, marginTop: 4 },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  routeCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  routeName: { fontSize: 16, fontWeight: '600', flex: 1 },
  durationBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  durationText: { fontSize: 12, fontWeight: '600' },
  routeRoute: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  routeOrigin: { fontSize: 13 },
  routeArrow: { fontSize: 13 },
  routeDest: { fontSize: 13 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorIcon: { fontSize: 40 },
  errorText: { textAlign: 'center', fontSize: 14, maxWidth: 260 },
  retryBtn: { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyText: { fontSize: 16 },
  emptySubText: { fontSize: 13 },
});
