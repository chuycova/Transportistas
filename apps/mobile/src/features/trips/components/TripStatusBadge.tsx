// ─── TripStatusBadge.tsx ──────────────────────────────────────────────────────
// Badge de estado de viaje con color y etiqueta según TripStatus.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TripStatus } from '../hooks/useTrips';

const STATUS_META: Record<TripStatus, { label: string; color: string; bg: string }> = {
  draft:          { label: 'Borrador',    color: '#8888AA', bg: '#1A1A2E' },
  scheduled:      { label: 'Programado',  color: '#6C63FF', bg: '#6C63FF22' },
  confirmed:      { label: 'Confirmado',  color: '#A78BFA', bg: '#A78BFA22' },
  in_transit:     { label: 'En tránsito', color: '#F59E0B', bg: '#F59E0B22' },
  at_destination: { label: 'En destino',  color: '#06B6D4', bg: '#06B6D422' },
  paused:         { label: 'Pausado',     color: '#FB923C', bg: '#FB923C22' },
  completed:      { label: 'Completado',  color: '#22C55E', bg: '#22C55E22' },
  closed:         { label: 'Cerrado',     color: '#8888AA', bg: '#1A1A2E' },
  cancelled:      { label: 'Cancelado',   color: '#EF4444', bg: '#EF444422' },
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  const meta = STATUS_META[status];
  return (
    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
      <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});
