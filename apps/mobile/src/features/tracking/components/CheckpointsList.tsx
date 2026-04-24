import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@lib/ThemeContext';

interface CheckpointStatus {
  checkpoint: {
    id: string;
    name: string;
    order_index: number;
    is_mandatory: boolean;
  };
  visited: boolean;
}

interface CheckpointsListProps {
  statuses: CheckpointStatus[];
  nextCheckpointId: string | undefined;
  mandatoryTotal: number;
  mandatoryVisited: number;
}

export function CheckpointsList({
  statuses, nextCheckpointId, mandatoryTotal, mandatoryVisited,
}: CheckpointsListProps) {
  const { colors } = useTheme();
  if (statuses.length === 0) return null;

  const allComplete = mandatoryVisited === mandatoryTotal;

  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Checkpoints</Text>
        {mandatoryTotal > 0 && (
          <View style={[styles.progressBadge, allComplete && styles.progressComplete]}>
            <Text style={[styles.progressText, allComplete && styles.progressTextComplete]}>
              {mandatoryVisited}/{mandatoryTotal}
            </Text>
          </View>
        )}
      </View>
      {statuses.map(({ checkpoint: cp, visited }) => {
        const isNext = nextCheckpointId === cp.id;
        return (
          <View key={cp.id} style={[styles.row, visited && styles.rowVisited]}>
            <View style={[styles.badge,
              visited  && styles.badgeVisited,
              isNext   && styles.badgeNext,
              !cp.is_mandatory && !visited && styles.badgeOptional,
            ]}>
              <Text style={[styles.badgeText, visited && styles.badgeTextVisited]}>
                {visited ? '✓' : String(cp.order_index)}
              </Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.name, { color: visited ? colors.textMuted : colors.text }]}
                numberOfLines={1}>{cp.name}</Text>
              {!cp.is_mandatory && (
                <Text style={[styles.optionalLabel, { color: colors.textMuted }]}>opcional</Text>
              )}
            </View>
            {isNext && !visited && (
              <View style={styles.nextBadge}>
                <Text style={styles.nextText}>PRÓXIMO</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 14, padding: 14,
    borderWidth: 1, gap: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  title: { fontSize: 14, fontWeight: '700' },
  progressBadge: {
    backgroundColor: '#6C63FF22', borderRadius: 20, borderWidth: 1, borderColor: '#6C63FF44',
    paddingHorizontal: 8, paddingVertical: 3,
  },
  progressComplete: { backgroundColor: '#10B98122', borderColor: '#10B98144' },
  progressText: { color: '#6C63FF', fontSize: 11, fontWeight: '700' },
  progressTextComplete: { color: '#10B981' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#1A1A2E',
  },
  rowVisited: { opacity: 0.55 },
  badge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#6C63FF22',
    borderWidth: 1, borderColor: '#6C63FF44', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  badgeVisited:  { backgroundColor: '#10B98122', borderColor: '#10B98144' },
  badgeNext:     { backgroundColor: '#F59E0B22', borderColor: '#F59E0B44' },
  badgeOptional: { backgroundColor: '#2A2A3F',   borderColor: '#3A3A5C' },
  badgeText:        { color: '#6C63FF', fontSize: 11, fontWeight: '700' },
  badgeTextVisited: { color: '#10B981' },
  rowContent: { flex: 1 },
  name:        { fontSize: 13, fontWeight: '500' },
  optionalLabel: { fontSize: 10, marginTop: 1 },
  nextBadge: {
    backgroundColor: '#F59E0B22', borderRadius: 20, borderWidth: 1, borderColor: '#F59E0B44',
    paddingHorizontal: 7, paddingVertical: 2,
  },
  nextText: { color: '#F59E0B', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
});
