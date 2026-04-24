// ─── PastTripItem.tsx ─────────────────────────────────────────────────────────
// Item de historial para viajes pasados.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@lib/ThemeContext';
import { TripStatusBadge } from './TripStatusBadge';
import { fmtDate } from '../lib/formatters';
import type { DriverTrip } from '../hooks/useTrips';

export function PastTripItem({ trip }: { trip: DriverTrip }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pastItem, { backgroundColor: colors.surface }]}>
      <View style={styles.pastItemLeft}>
        <Text style={[styles.pastCode, { color: colors.textSecondary }]}>{trip.code}</Text>
        <Text style={[styles.pastRoute, { color: colors.text }]} numberOfLines={1}>
          {trip.origin_name} → {trip.dest_name}
        </Text>
        {fmtDate(trip.completed_at ?? trip.started_at) && (
          <Text style={[styles.pastDate, { color: colors.textMuted }]}>
            {fmtDate(trip.completed_at ?? trip.started_at)}
          </Text>
        )}
      </View>
      <TripStatusBadge status={trip.status} />
    </View>
  );
}

const styles = StyleSheet.create({
  pastItem:     { padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pastItemLeft: { flex: 1, gap: 2 },
  pastCode:     { fontSize: 11, fontFamily: 'monospace' },
  pastRoute:    { fontSize: 13, fontWeight: '500' },
  pastDate:     { fontSize: 11 },
});
