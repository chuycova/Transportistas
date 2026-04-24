// ─── TripsScreen.tsx ──────────────────────────────────────────────────────────
// Pantalla principal de Viajes para el conductor.
// Composición pura: sin infraestructura (MMKV, DB) directa en este archivo.

import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTrips } from '../hooks/useTrips';
import { useTripActions } from '../hooks/useTripActions';
import { useTheme } from '@lib/ThemeContext';
import { ActiveTripCard } from '../components/ActiveTripCard';
import { PastTripItem } from '../components/PastTripItem';
import type { RootStackParamList } from '@navigation/RootNavigator';
import type { MainTabParamList } from '@navigation/MainTabNavigator';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Trips'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Pantalla ─────────────────────────────────────────────────────────────────

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

  const { handleStart, handleAtDestination, handleComplete } = useTripActions({
    activeTrip,
    refetch,
    onNavigateMap: () => navigation.navigate('Map'),
  });

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
  sectionTitle:  { fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 10 },
  emptyState:    { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyIcon:     { fontSize: 56 },
  emptyTitle:    { fontSize: 18, fontWeight: '700' },
  emptySub:      { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  pastList:      { gap: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  loadingText:   { marginTop: 12, fontSize: 14 },
  errorIcon:     { fontSize: 40 },
  errorText:     { textAlign: 'center', fontSize: 14, maxWidth: 260 },
  retryBtn:      { borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryText:     { color: '#fff', fontWeight: '600' },
});
