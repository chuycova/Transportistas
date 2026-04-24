// ─── ActiveTripCard.tsx ───────────────────────────────────────────────────────
// Tarjeta del viaje activo con métricas, trayecto y botones de acción.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@lib/ThemeContext';
import { TripStatusBadge } from './TripStatusBadge';
import { fmtDate, fmtDistance, fmtDuration } from '../lib/formatters';
import type { DriverTrip } from '../hooks/useTrips';

interface ActiveTripCardProps {
  trip:            DriverTrip;
  onStart:         () => void;
  onAtDestination: () => void;
  onComplete:      () => void;
  onRefresh:       () => void;
}

export function ActiveTripCard({
  trip, onStart, onAtDestination, onComplete,
}: ActiveTripCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.activeCard, { backgroundColor: colors.surface, borderColor: colors.accent + '44' }]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={[styles.tripCode, { color: colors.textSecondary }]}>{trip.code}</Text>
        <TripStatusBadge status={trip.status} />
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
          <Text style={[styles.cargoText, { color: colors.textSecondary }]}>
            {trip.cargo_type}{trip.weight_tons ? ` · ${trip.weight_tons} ton` : ''}
          </Text>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Acciones según estado */}
      {trip.status === 'confirmed' && (
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={onStart}>
          <Text style={styles.primaryBtnText}>Iniciar viaje</Text>
        </TouchableOpacity>
      )}
      {trip.status === 'in_transit' && (
        <TouchableOpacity style={[styles.primaryBtn, styles.cyanBtn]} onPress={onAtDestination}>
          <Text style={styles.primaryBtnText}>He llegado al destino</Text>
        </TouchableOpacity>
      )}
      {trip.status === 'at_destination' && (
        <TouchableOpacity style={[styles.primaryBtn, styles.greenBtn]} onPress={onComplete}>
          <Text style={styles.primaryBtnText}>Completar viaje</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  activeCard:  { borderRadius: 20, padding: 20, borderWidth: 1 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  tripCode:    { fontSize: 12, fontFamily: 'monospace', fontWeight: '600' },
  routeSection:    { gap: 4, marginBottom: 14 },
  routePoint:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot:        { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeLine:       { width: 1, height: 16, marginLeft: 3.5 },
  routePointText:  { fontSize: 14, flex: 1 },
  metricsRow:  { flexDirection: 'row', justifyContent: 'space-around', borderRadius: 12, padding: 12, marginBottom: 12 },
  metric:      { alignItems: 'center' },
  metricValue: { fontSize: 14, fontWeight: '700' },
  metricLabel: { fontSize: 10, marginTop: 2 },
  cargoChip:   { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 12, alignSelf: 'flex-start' },
  cargoText:   { fontSize: 12 },
  divider:     { height: 1, marginBottom: 16 },
  primaryBtn:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cyanBtn:        { backgroundColor: '#0891B2' },
  greenBtn:       { backgroundColor: '#16A34A' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
