// ─── TripsScreen.tsx ──────────────────────────────────────────────────────────
// Pantalla principal de Viajes para el conductor.

import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTrips, updateTripStatus, type DriverTrip, type TripStatus } from '../hooks/useTrips';
import { useTheme } from '@lib/ThemeContext';
import { setStr, storage } from '@lib/mmkv';
import { MMKV_KEYS } from '@lib/constants';
import type { RootStackParamList } from '@navigation/RootNavigator';
import type { MainTabParamList } from '@navigation/MainTabNavigator';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Trips'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<TripStatus, { label: string; color: string; bg: string }> = {
  draft:          { label: 'Borrador',    color: '#8888AA', bg: '#1A1A2E' },
  scheduled:      { label: 'Programado',  color: '#6C63FF', bg: '#6C63FF22' },
  confirmed:      { label: 'Confirmado',  color: '#A78BFA', bg: '#A78BFA22' },
  in_transit:     { label: 'En tránsito', color: '#F59E0B', bg: '#F59E0B22' },
  at_destination: { label: 'En destino',  color: '#06B6D4', bg: '#06B6D422' },
  completed:      { label: 'Completado',  color: '#22C55E', bg: '#22C55E22' },
  closed:         { label: 'Cerrado',     color: '#8888AA', bg: '#1A1A2E' },
  cancelled:      { label: 'Cancelado',   color: '#EF4444', bg: '#EF444422' },
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function fmtDistance(km: number | null) {
  if (!km) return null;
  return `${km.toFixed(0)} km`;
}

function fmtDuration(min: number | null) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Badge de estado ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TripStatus }) {
  const meta = STATUS_META[status];
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

// ─── Tarjeta de viaje activo ──────────────────────────────────────────────────

function ActiveTripCard({
  trip,
  onStart,
  onAtDestination,
  onComplete,
}: {
  trip: DriverTrip;
  onStart: () => void;
  onAtDestination: () => void;
  onComplete: () => void;
  onRefresh: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.activeCard, { backgroundColor: colors.surface, borderColor: colors.accent + '44' }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={[styles.tripCode, { color: colors.textSecondary }]}>{trip.code}</Text>
        <StatusBadge status={trip.status} />
      </View>

      {/* Trayecto */}
      <View style={styles.routeSection}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#22C55E' }]} />
          <Text style={[styles.routePointText, { color: colors.text }]} numberOfLines={1}>{trip.origin_name}</Text>
        </View>
        <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
          <Text style={[styles.routePointText, { color: colors.text }]} numberOfLines={1}>{trip.dest_name}</Text>
        </View>
      </View>

      {/* Métricas */}
      {(trip.estimated_distance_km || trip.estimated_duration_min || trip.scheduled_at) && (
        <View style={[styles.metricsRow, { backgroundColor: colors.surfaceAlt }]}>
          {fmtDistance(trip.estimated_distance_km) && (
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: colors.text }]}>{fmtDistance(trip.estimated_distance_km)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>distancia</Text>
            </View>
          )}
          {fmtDuration(trip.estimated_duration_min) && (
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: colors.text }]}>{fmtDuration(trip.estimated_duration_min)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>estimado</Text>
            </View>
          )}
          {fmtDate(trip.scheduled_at) && (
            <View style={styles.metric}>
              <Text style={[styles.metricValue, { color: colors.text }]}>{fmtDate(trip.scheduled_at)}</Text>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>programado</Text>
            </View>
          )}
        </View>
      )}

      {/* Carga */}
      {trip.cargo_type && (
        <View style={[styles.cargoChip, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.cargoText, { color: colors.textSecondary }]}>📦 {trip.cargo_type}{trip.weight_tons ? ` · ${trip.weight_tons} ton` : ''}</Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Acciones según estado */}
      {trip.status === 'confirmed' && (
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={onStart}>
          <Text style={styles.primaryBtnText}>▶  Iniciar viaje</Text>
        </TouchableOpacity>
      )}
      {trip.status === 'in_transit' && (
        <TouchableOpacity style={[styles.primaryBtn, styles.cyanBtn]} onPress={onAtDestination}>
          <Text style={styles.primaryBtnText}>📍  He llegado al destino</Text>
        </TouchableOpacity>
      )}
      {trip.status === 'at_destination' && (
        <TouchableOpacity style={[styles.primaryBtn, styles.greenBtn]} onPress={onComplete}>
          <Text style={styles.primaryBtnText}>✓  Completar viaje</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Item de historial ────────────────────────────────────────────────────────

function PastTripItem({ trip }: { trip: DriverTrip }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pastItem, { backgroundColor: colors.surface }]}>
      <View style={styles.pastItemLeft}>
        <Text style={[styles.pastCode, { color: colors.textSecondary }]}>{trip.code}</Text>
        <Text style={[styles.pastRoute, { color: colors.text }]} numberOfLines={1}>
          {trip.origin_name} → {trip.dest_name}
        </Text>
        {fmtDate(trip.completed_at ?? trip.started_at) && (
          <Text style={[styles.pastDate, { color: colors.textMuted }]}>{fmtDate(trip.completed_at ?? trip.started_at)}</Text>
        )}
      </View>
      <StatusBadge status={trip.status} />
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export function TripsScreen() {
  const navigation = useNavigation<NavProp>();
  const { activeTrip, pastTrips, loading, error, refetch } = useTrips();
  const [refreshing, setRefreshing] = React.useState(false);
  const { colors } = useTheme();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleStart = useCallback(async () => {
    if (!activeTrip) return;
    try {
      await updateTripStatus(activeTrip.id, 'in_transit', {
        started_at: new Date().toISOString(),
      });
      setStr(MMKV_KEYS.ACTIVE_TRIP_ID, activeTrip.id);
      if (activeTrip.route_id) setStr(MMKV_KEYS.ACTIVE_ROUTE_ID, activeTrip.route_id);
      navigation.navigate('Map');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al iniciar viaje');
    }
  }, [activeTrip, navigation]);

  const handleAtDestination = useCallback(async () => {
    if (!activeTrip) return;
    try {
      await updateTripStatus(activeTrip.id, 'at_destination');
      void refetch();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al actualizar estado');
    }
  }, [activeTrip, refetch]);

  const handleComplete = useCallback(async () => {
    if (!activeTrip) return;
    Alert.alert(
      'Completar viaje',
      '¿Confirmas que el viaje ha sido completado?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          onPress: async () => {
            try {
              await updateTripStatus(activeTrip.id, 'completed', {
                completed_at: new Date().toISOString(),
              });
              // Limpiar el trip activo del MMKV para que la ruta
              // ya no aparezca como disponible para iniciar de nuevo
              storage.delete(MMKV_KEYS.ACTIVE_TRIP_ID);
              void refetch();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Error al completar viaje');
            }
          },
        },
      ],
    );
  }, [activeTrip, refetch]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando viajes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.accent }]}
          onPress={() => { void refetch(); }}
        >
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { void handleRefresh(); }}
          tintColor={colors.accent}
        />
      }
    >
      {/* ── Viaje activo ── */}
      {activeTrip ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.accent }]}>VIAJE ACTIVO</Text>
          <ActiveTripCard
            trip={activeTrip}
            onStart={() => { void handleStart(); }}
            onAtDestination={() => { void handleAtDestination(); }}
            onComplete={() => { void handleComplete(); }}
            onRefresh={() => { void refetch(); }}
          />
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🚚</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin viaje activo</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Tu supervisor aún no te ha asignado un viaje.{'\n'}
            Cuando se confirme uno aparecerá aquí.
          </Text>
        </View>
      )}

      {/* ── Historial ── */}
      {pastTrips.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 28, color: colors.accent }]}>HISTORIAL</Text>
          <View style={[styles.pastList, { borderColor: colors.border }]}>
            {pastTrips.map((trip) => (
              <PastTripItem key={trip.id} trip={trip} />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  centered:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },

  sectionTitle: { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 10 },

  // Tarjeta de viaje activo
  activeCard: {
    borderRadius: 20,
    padding: 20, borderWidth: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  tripCode:   { fontSize: 12, fontFamily: 'monospace', fontWeight: '600' },

  badge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  routeSection: { gap: 4, marginBottom: 14 },
  routePoint:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot:     { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeLine:    { width: 1, height: 16, marginLeft: 3.5 },
  routePointText: { fontSize: 14, flex: 1 },

  metricsRow: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: 12, padding: 12, marginBottom: 12 },
  metric:      { alignItems: 'center' },
  metricValue: { fontSize: 14, fontWeight: '700' },
  metricLabel: { fontSize: 10, marginTop: 2 },

  cargoChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12, alignSelf: 'flex-start' },
  cargoText: { fontSize: 12 },

  divider: { height: 1, marginBottom: 16 },

  primaryBtn:   { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cyanBtn:      { backgroundColor: '#0891B2' },
  greenBtn:     { backgroundColor: '#16A34A' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Estado vacío
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyIcon:  { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  // Historial
  pastList: { gap: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  pastItem: {
    padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  pastItemLeft: { flex: 1, gap: 2 },
  pastCode:  { fontSize: 11, fontFamily: 'monospace' },
  pastRoute: { fontSize: 13, fontWeight: '500' },
  pastDate:  { fontSize: 11 },

  // Utilidades
  loadingText: { marginTop: 12, fontSize: 14 },
  errorIcon:   { fontSize: 40 },
  errorText:   { textAlign: 'center', fontSize: 14, maxWidth: 260 },
  retryBtn:    { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText:   { color: '#fff', fontWeight: '600' },
});
