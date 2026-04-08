// ─── RoutesScreen.tsx ─────────────────────────────────────────────────────────
// Tab de rutas para el conductor (role='driver').
// Consume GET /api/v1/driver/assignment — el endpoint dedicado que devuelve
// solo los datos necesarios para ese conductor específico.
//
// Estados posibles:
//   1. Cargando — spinner
//   2. Error de red/auth
//   3. Sin vehículo asignado — pantalla de espera
//   4. Vehículo asignado pero sin ruta activa — pantalla de espera de ruta
//   5. Ruta activa → card de ruta + botón "Iniciar navegación"

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@lib/supabase';
import { setStr } from '@lib/mmkv';
import { MMKV_KEYS, API_URL } from '@lib/constants';
import type { RootStackParamList } from '@navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

interface DriverAssignment {
  driver: { id: string; full_name: string; role: string };
  vehicle: {
    id: string;
    plate: string;
    alias: string | null;
    color: string | null;
    vehicle_type: string;
  } | null;
  activeRoute: {
    id: string;
    name: string;
    origin_name: string;
    dest_name: string;
    total_distance_m: number | null;
    estimated_duration_s: number | null;
    deviation_threshold_m: number | null;
    waypoints: Array<{ lat: number; lng: number }>;
    stops: Array<{ name: string; address: string | null; lat: number; lng: number; order: number }>;
  } | null;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function formatDistance(meters?: number | null): string {
  if (!meters) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ─── Estado: sin vehículo asignado ───────────────────────────────────────────
function NoVehicleState() {
  return (
    <View style={styles.stateContainer}>
      <Text style={styles.stateIcon}>🚛</Text>
      <Text style={styles.stateTitle}>Sin vehículo asignado</Text>
      <Text style={styles.stateSub}>
        Tu supervisor aún no te ha asignado una unidad.{'\n'}
        Contacta a tu monitor para que te asigne un vehículo.
      </Text>
    </View>
  );
}

// ─── Estado: sin ruta activa ──────────────────────────────────────────────────
function NoRouteState({ plate, alias }: { plate: string; alias?: string | null }) {
  return (
    <View style={styles.stateContainer}>
      <View style={styles.vehicleChip}>
        <Text style={styles.vehicleChipLabel}>UNIDAD</Text>
        <Text style={styles.vehicleChipPlate}>{plate}</Text>
        {alias ? <Text style={styles.vehicleChipAlias}>{alias}</Text> : null}
      </View>
      <Text style={styles.stateIcon}>🗺️</Text>
      <Text style={styles.stateTitle}>Sin ruta asignada</Text>
      <Text style={styles.stateSub}>
        Tu vehículo está listo pero no tiene una ruta activa.{'\n'}
        Espera a que tu supervisor te asigne una.
      </Text>
    </View>
  );
}

// ─── Tarjeta de ruta activa ───────────────────────────────────────────────────
function ActiveRouteCard({
  assignment,
  onStart,
}: {
  assignment: DriverAssignment;
  onStart: () => void;
}) {
  const { vehicle, activeRoute } = assignment;
  if (!vehicle || !activeRoute) return null;

  return (
    <View style={styles.activeCard}>
      {/* Vehículo */}
      <View style={styles.vehicleRow}>
        <View style={[styles.vehicleDot, { backgroundColor: vehicle.color ?? '#6C63FF' }]} />
        <View>
          <Text style={styles.vehiclePlate}>{vehicle.plate}</Text>
          {vehicle.alias ? <Text style={styles.vehicleAlias}>{vehicle.alias}</Text> : null}
        </View>
        <View style={styles.badgeActive}>
          <Text style={styles.badgeText}>EN SERVICIO</Text>
        </View>
      </View>

      {/* Separador */}
      <View style={styles.divider} />

      {/* Ruta */}
      <Text style={styles.routeLabel}>RUTA ACTIVA</Text>
      <Text style={styles.routeName}>{activeRoute.name}</Text>

      <View style={styles.routePoints}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#22C55E' }]} />
          <Text style={styles.routePointText}>{activeRoute.origin_name}</Text>
        </View>
        {activeRoute.stops.map((stop, i) => (
          <View key={i} style={styles.routePoint}>
            <View style={[styles.routeDot, styles.routeDotStop]} />
            <Text style={styles.routePointText}>{stop.name}</Text>
          </View>
        ))}
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.routePointText}>{activeRoute.dest_name}</Text>
        </View>
      </View>

      {/* Métricas */}
      <View style={styles.metricsRow}>
        {activeRoute.total_distance_m ? (
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatDistance(activeRoute.total_distance_m)}</Text>
            <Text style={styles.metricLabel}>distancia</Text>
          </View>
        ) : null}
        {activeRoute.estimated_duration_s ? (
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{formatDuration(activeRoute.estimated_duration_s)}</Text>
            <Text style={styles.metricLabel}>estimado</Text>
          </View>
        ) : null}
        {activeRoute.waypoints.length > 0 ? (
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{activeRoute.waypoints.length}</Text>
            <Text style={styles.metricLabel}>puntos GPS</Text>
          </View>
        ) : null}
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.startBtn}
        onPress={onStart}
        accessibilityLabel="Iniciar navegación de la ruta"
        accessibilityRole="button"
      >
        <Text style={styles.startBtnText}>▶  Iniciar navegación</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export function RoutesScreen() {
  const navigation = useNavigation<NavProp>();
  const [data, setData] = useState<DriverAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignment = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(`${API_URL}/api/v1/driver/assignment`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Error ${res.status}: ${text}`);
      }

      const assignment = (await res.json()) as DriverAssignment;
      setData(assignment);

      // Guardar en MMKV para uso offline del tracking
      if (assignment.vehicle) {
        setStr(MMKV_KEYS.ACTIVE_VEHICLE_ID, assignment.vehicle.id);
      }
      if (assignment.activeRoute) {
        setStr(MMKV_KEYS.ACTIVE_ROUTE_ID, assignment.activeRoute.id);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar asignación');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchAssignment(); }, [fetchAssignment]);

  const handleStartRoute = () => {
    if (!data?.activeRoute) return;
    navigation.navigate('Tracking', {
      routeId: data.activeRoute.id,
      routeName: data.activeRoute.name,
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Cargando asignación...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setLoading(true); void fetchAssignment(); }}
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); void fetchAssignment(); }}
          tintColor="#6C63FF"
        />
      }
    >
      <Text style={styles.greeting}>
        Hola, {data?.driver.full_name?.split(' ')[0] ?? 'Conductor'} 👋
      </Text>

      {!data?.vehicle ? (
        <NoVehicleState />
      ) : !data.activeRoute ? (
        <NoRouteState plate={data.vehicle.plate} alias={data.vehicle.alias} />
      ) : (
        <ActiveRouteCard assignment={data} onStart={handleStartRoute} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  centered: {
    flex: 1, backgroundColor: '#0A0A0F',
    justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24,
  },
  greeting: {
    color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 20,
  },

  // Estados de espera
  stateContainer: { alignItems: 'center', paddingTop: 40, gap: 12 },
  stateIcon: { fontSize: 56 },
  stateTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  stateSub: { color: '#8888AA', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  // Chip de vehículo en estado sin ruta
  vehicleChip: {
    backgroundColor: '#12121C', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#6C63FF44', alignItems: 'center', marginBottom: 24, minWidth: 180,
  },
  vehicleChipLabel: { color: '#6C63FF', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
  vehicleChipPlate: { color: '#FFF', fontSize: 26, fontWeight: '700', letterSpacing: 2, marginTop: 4 },
  vehicleChipAlias: { color: '#8888AA', fontSize: 13, marginTop: 2 },

  // Card de ruta activa
  activeCard: {
    backgroundColor: '#12121C', borderRadius: 20,
    padding: 20, borderWidth: 1, borderColor: '#6C63FF44',
  },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  vehicleDot: { width: 12, height: 12, borderRadius: 6 },
  vehiclePlate: { color: '#FFF', fontSize: 18, fontWeight: '700', letterSpacing: 1.5 },
  vehicleAlias: { color: '#8888AA', fontSize: 12, marginTop: 2 },
  badgeActive: {
    marginLeft: 'auto', backgroundColor: '#22C55E22',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeText: { color: '#22C55E', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#2A2A3F', marginBottom: 16 },
  routeLabel: {
    color: '#6C63FF', fontSize: 10, letterSpacing: 1.5,
    fontWeight: '700', marginBottom: 6,
  },
  routeName: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', marginBottom: 14 },
  routePoints: { gap: 8, marginBottom: 16 },
  routePoint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeDotStop: { backgroundColor: '#6C63FF' },
  routePointText: { color: '#CCCCDD', fontSize: 13, flex: 1 },
  metricsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#0A0A0F', borderRadius: 12, padding: 12, marginBottom: 20,
  },
  metric: { alignItems: 'center' },
  metricValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  metricLabel: { color: '#8888AA', fontSize: 10, marginTop: 2 },
  startBtn: {
    backgroundColor: '#6C63FF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Utilitarios
  loadingText: { color: '#8888AA', marginTop: 12, fontSize: 14 },
  errorIcon: { fontSize: 40 },
  errorText: { color: '#FF6B6B', textAlign: 'center', fontSize: 14, maxWidth: 260 },
  retryBtn: {
    backgroundColor: '#6C63FF', borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
