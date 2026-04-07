// ─── HistoryScreen.tsx ────────────────────────────────────────────────────────
// Historial de viajes del conductor.
// TODO: conectar al endpoint GET /api/v1/tracking/history cuando esté disponible.

import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

// Datos de ejemplo hasta que el endpoint de historial esté listo
const PLACEHOLDER_TRIPS = [
  {
    id: '1',
    routeName: 'Ruta Centro → Norte',
    date: '2026-04-06',
    duration: '1h 24m',
    distance: '32.4 km',
    status: 'completed',
  },
  {
    id: '2',
    routeName: 'Ruta Sur → Aeropuerto',
    date: '2026-04-05',
    duration: '48m',
    distance: '18.7 km',
    status: 'completed',
  },
  {
    id: '3',
    routeName: 'Ruta Periférico',
    date: '2026-04-04',
    duration: '2h 05m',
    distance: '61.2 km',
    status: 'off_route',
  },
];

type Trip = (typeof PLACEHOLDER_TRIPS)[number];

function TripCard({ item }: { item: Trip }) {
  const isOffRoute = item.status === 'off_route';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardRoute} numberOfLines={1}>{item.routeName}</Text>
        <View style={[styles.badge, isOffRoute ? styles.badgeOffRoute : styles.badgeDone]}>
          <Text style={[styles.badgeText, isOffRoute && styles.badgeTextOffRoute]}>
            {isOffRoute ? 'Desvío' : 'Completado'}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaItem}>📅 {item.date}</Text>
        <Text style={styles.metaItem}>⏱ {item.duration}</Text>
        <Text style={styles.metaItem}>📍 {item.distance}</Text>
      </View>
    </View>
  );
}

export function HistoryScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonIcon}>🗓</Text>
        <Text style={styles.comingSoonTitle}>Historial en desarrollo</Text>
        <Text style={styles.comingSoonSub}>
          Pronto verás tus viajes recientes aquí.{'\n'}Se muestra una vista previa por ahora.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Vista previa</Text>

      <FlatList
        data={PLACEHOLDER_TRIPS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => <TripCard item={item} />}
      />
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
  comingSoon: {
    backgroundColor: '#12121C',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2A3F',
  },
  comingSoonIcon: { fontSize: 36, marginBottom: 4 },
  comingSoonTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  comingSoonSub: { color: '#8888AA', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  sectionTitle: {
    color: '#8888AA',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#12121C',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardRoute: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeDone: { backgroundColor: '#22C55E22' },
  badgeOffRoute: { backgroundColor: '#FF444422' },
  badgeText: { color: '#22C55E', fontSize: 11, fontWeight: '600' },
  badgeTextOffRoute: { color: '#FF6B6B' },
  cardMeta: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  metaItem: { color: '#8888AA', fontSize: 12 },
});
