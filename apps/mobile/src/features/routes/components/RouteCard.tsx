import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/ThemeContext';
import { formatDistance, formatDuration } from '../lib/formatters';
import type { RouteItem } from '../types';

interface RouteCardProps {
  route:       RouteItem;
  isActive:    boolean;
  /** true cuando el conductor tiene el trip de esta ruta en estado 'paused' */
  isPaused?:   boolean;
  /** porcentaje de ruta recorrida al pausar (0-100) */
  progressPct?: number;
  onPress:     () => void;
}

export function RouteCard({ route, isActive, isPaused, progressPct, onPress }: RouteCardProps) {
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? '#1C1C2E' : '#F6F8FA';

  const borderColor = isPaused
    ? '#F59E0B50'
    : isActive
    ? colors.accent + '50'
    : 'transparent';

  const bgColor = isPaused
    ? (isDark ? '#F59E0B12' : '#FEF3C740')
    : isActive
    ? colors.accent + '12'
    : cardBg;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: bgColor, borderColor, borderWidth: (isActive || isPaused) ? 1.5 : 1.5 },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Ruta ${route.name}`}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          {isPaused ? (
            <View style={styles.pausedPill}>
              <View style={[styles.pillDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.pillText, { color: '#F59E0B' }]}>PAUSADA</Text>
            </View>
          ) : isActive ? (
            <View style={styles.activePill}>
              <View style={[styles.pillDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.pillText, { color: colors.accent }]}>ACTIVA</Text>
            </View>
          ) : null}
          <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>
            {route.name}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      <View style={styles.routeTimeline}>
        <View style={styles.timelinePoint}>
          <View style={[styles.timelineDot, { borderColor: '#22C55E' }]} />
          <Text style={[styles.timelineText, { color: colors.text }]} numberOfLines={1}>
            {route.origin_name}
          </Text>
        </View>

        {route.stops.length > 0 ? (
          <View style={styles.timelinePointPadded}>
            <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.timelineStopsText, { color: colors.textSecondary }]}>
              {route.stops.length} parada{route.stops.length !== 1 ? 's' : ''}
            </Text>
          </View>
        ) : (
          <View style={[styles.timelineLineOnly, { backgroundColor: colors.border }]} />
        )}

        <View style={styles.timelinePoint}>
          <View style={[styles.timelineDot, { borderColor: '#EF4444' }]} />
          <Text style={[styles.timelineText, { color: colors.text }]} numberOfLines={1}>
            {route.dest_name}
          </Text>
        </View>
      </View>

      {(route.total_distance_m || route.estimated_duration_s) ? (
        <View style={styles.metricsMinimal}>
          {route.total_distance_m ? (
            <View style={styles.metricChip}>
              <Ionicons name="navigate-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                {formatDistance(route.total_distance_m)}
              </Text>
            </View>
          ) : null}
          {route.estimated_duration_s ? (
            <View style={styles.metricChip}>
              <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.metricText, { color: colors.textSecondary }]}>
                {formatDuration(route.estimated_duration_s)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Barra de progreso — solo visible cuando está pausada */}
      {isPaused && progressPct != null && (
        <View style={styles.progressSection}>
          <View style={[styles.progressBg, { backgroundColor: isDark ? '#FFFFFF15' : '#0000001A' }]}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{progressPct}% recorrido</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18, padding: 20, gap: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  cardName:   { fontSize: 18, fontWeight: '700', lineHeight: 24 },

  activePill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  pausedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  pillDot:    { width: 6, height: 6, borderRadius: 3 },
  pillText:   { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  routeTimeline:       { gap: 0 },
  timelinePoint:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timelinePointPadded: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  timelineDot:         { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: 'transparent' },
  timelineLine:        { width: 2, height: 24, borderRadius: 1, marginLeft: 6 },
  timelineLineOnly:    { width: 2, height: 16, borderRadius: 1, marginLeft: 6, marginVertical: 4 },
  timelineText:        { fontSize: 16, fontWeight: '600', flex: 1 },
  timelineStopsText:   { fontSize: 14, fontWeight: '400', flex: 1 },

  metricsMinimal: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap',
  },
  metricChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { fontSize: 13, fontWeight: '500' },

  progressSection: { gap: 6, marginTop: 2 },
  progressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: {
    height: '100%', backgroundColor: '#F59E0B', borderRadius: 3,
  },
  progressLabel: { fontSize: 11, fontWeight: '600', color: '#F59E0B' },
});
