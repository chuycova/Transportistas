import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/ThemeContext';
import { formatDistance, formatDuration } from '../lib/formatters';
import { RouteMapPreview } from './RouteMapPreview';
import type { RouteItem } from '../types';
import type { DriverTrip } from '@features/trips/hooks/useTrips';

interface RouteDetailModalProps {
  route: RouteItem | null;
  vehiclePlate: string;
  onClose: () => void;
  onStart: (route: RouteItem) => void;
  /** Trip pausado que pertenece a esta ruta — activa el botón Reanudar */
  pausedTrip?: DriverTrip | null;
  onResume?: (trip: DriverTrip) => void;
}

export function RouteDetailModal({
  route, vehiclePlate, onClose, onStart, pausedTrip, onResume,
}: RouteDetailModalProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const cardBg = isDark ? '#1C1C2E' : '#F6F8FA';
  const borderColor = isDark ? '#FFFFFF10' : '#0000000A';
  const sectionBg = isDark ? '#FFFFFF06' : '#00000006';

  if (!route) return null;

  const canResume = !!pausedTrip && pausedTrip.route_id === route.id && pausedTrip.status === 'paused';
  const progress = canResume && pausedTrip.progress_pct != null ? pausedTrip.progress_pct : null;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {route.name}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: cardBg }]}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {route.waypoints.length >= 2 && (
          <View style={[styles.map, { borderColor }]}>
            <RouteMapPreview
              waypoints={route.waypoints}
              stops={route.stops}
              accentColor={colors.accent}
              height={220}
            />
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Inicio</Text>
              </View>
              {route.stops.length > 0 && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>Paradas</Text>
                </View>
              )}
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Destino</Text>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.body, { flex: 1 }]}>
          <View style={[styles.infoRow, { backgroundColor: sectionBg, borderColor }]}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Unidad</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{vehiclePlate}</Text>
            </View>
            {route.total_distance_m ? (
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Distancia</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{formatDistance(route.total_distance_m)}</Text>
              </View>
            ) : null}
            {route.estimated_duration_s ? (
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Estimado</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{formatDuration(route.estimated_duration_s)}</Text>
              </View>
            ) : null}
          </View>

          {/* Banner de ruta pausada */}
          {canResume && (
            <View style={[styles.pausedBanner, { backgroundColor: isDark ? '#F59E0B18' : '#FEF3C7', borderColor: '#F59E0B40' }]}>
              <Ionicons name="pause-circle-outline" size={18} color="#F59E0B" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pausedTitle, { color: '#F59E0B' }]}>Ruta pausada</Text>
                {progress !== null && (
                  <View style={styles.progressRow}>
                    <View style={[styles.progressBar, { backgroundColor: isDark ? '#FFFFFF20' : '#0000001A' }]}>
                      <View style={[styles.progressFill, { width: `${progress}%` as `${number}%` }]} />
                    </View>
                    <Text style={styles.progressPct}>{progress}%</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Recorrido</Text>
          <View style={styles.section}>
            <View style={styles.stopRow}>
              <View style={[styles.stopDot, { borderColor: '#22C55E' }]} />
              <Text style={[styles.stopText, { color: colors.text }]}>{route.origin_name}</Text>
            </View>
            {route.stops.map((s, i) => (
              <View key={i} style={styles.stopRow}>
                <View style={[styles.stopDot, { borderColor: colors.accent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stopText, { color: colors.text }]}>{s.name}</Text>
                  {s.address ? (
                    <Text style={[styles.stopAddr, { color: colors.textSecondary }]}>{s.address}</Text>
                  ) : null}
                </View>
              </View>
            ))}
            <View style={styles.stopRow}>
              <View style={[styles.stopDot, { borderColor: '#EF4444' }]} />
              <Text style={[styles.stopText, { color: colors.text }]}>{route.dest_name}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.footer, { borderTopColor: borderColor, paddingBottom: Platform.OS === 'ios' ? insets.bottom + 16 : 24 }]}>
          {canResume ? (
            <View style={styles.btnRow}>
              {/* Reanudar — primario */}
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: '#F59E0B', flex: 1 }]}
                onPress={() => pausedTrip && onResume?.(pausedTrip)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Reanudar ruta"
              >
                <View style={styles.startBtnInner}>
                  <Text style={styles.startBtnText}>Reanudar ruta</Text>
                  <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              {/* Iniciar de nuevo — secundario */}
              <TouchableOpacity
                style={[styles.secondaryBtn, { borderColor }]}
                onPress={() => onStart(route)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Iniciar desde cero"
              >
                <Ionicons name="refresh-outline" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: colors.accent }]}
              onPress={() => onStart(route)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Iniciar ruta"
            >
              <View style={styles.startBtnInner}>
                <Text style={styles.startBtnText}>Iniciar navegación</Text>
                <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', flex: 1 },
  map: { height: 220, borderRadius: 16, marginHorizontal: 24, overflow: 'hidden', borderWidth: 1 },
  legend: {
    position: 'absolute', bottom: 10, left: 14,
    flexDirection: 'row', gap: 12, alignItems: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontWeight: '600' },
  body: { paddingHorizontal: 24, paddingTop: 20, gap: 16 },
  infoRow: {
    flexDirection: 'row', borderRadius: 14, padding: 16,
    borderWidth: 1, gap: 0, justifyContent: 'space-between',
  },
  infoItem: { alignItems: 'center', gap: 3 },
  infoLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  infoValue: { fontSize: 18, fontWeight: '700' },
  // Paused banner
  pausedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  pausedTitle: { fontSize: 13, fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  progressBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 3 },
  progressPct: { fontSize: 11, fontWeight: '700', color: '#F59E0B', width: 32, textAlign: 'right' },
  // Recorrido
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4,
  },
  section: { gap: 14 },
  stopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stopDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, backgroundColor: 'transparent', marginTop: 3, flexShrink: 0 },
  stopText: { fontSize: 16, fontWeight: '600', flex: 1 },
  stopAddr: { fontSize: 13, marginTop: 2 },
  // Footer buttons
  footer: {
    paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  startBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  startBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    width: 52, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    justifyContent: 'center', borderWidth: 1.5, backgroundColor: 'transparent',
  },
});
