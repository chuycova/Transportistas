import React, { forwardRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, {
  BottomSheetView, BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useTheme } from '@lib/ThemeContext';
import { SNAP_IDLE, SNAP_TRACKING, SNAP_PAUSED } from '../lib/constants';
import { CheckpointsList } from './CheckpointsList';

interface ReportedIncident {
  code: string;
  type: string;
  severity: string;
  time: string;
}

interface CheckpointStatus {
  checkpoint: {
    id: string;
    name: string;
    order_index: number;
    is_mandatory: boolean;
  };
  visited: boolean;
}

interface TrackingBottomSheetProps {
  isTracking:         boolean;
  /** true cuando el conductor pausó el viaje */
  isPaused:           boolean;
  /** porcentaje de progreso al pausar (0-100) */
  pausedPct:          number;
  routeName:          string;
  lastCoordinate:     { lat: number; lng: number } | null;
  heading:            number | null;
  effectiveHeading:   number | null;
  error:              string | null;
  navToStartVisible:  boolean;
  checkpointStatuses: CheckpointStatus[];
  nextCheckpointId:   string | undefined;
  mandatoryTotal:     number;
  mandatoryVisited:   number;
  reportedIncidents:  ReportedIncident[];
  onStart:            () => void;
  onStop:             () => void;
  onReportIncident:   () => void;
  onSheetChange:      (idx: number) => void;
}

// ─── snap points ─────────────────────────────────────────────────────────────
// SNAP_PAUSED exportado desde lib/constants — pequeño, para modo standby
const SNAP_PAUSED_LOCAL = SNAP_PAUSED ?? ['22%'];

export const TrackingBottomSheet = forwardRef<BottomSheet, TrackingBottomSheetProps>(
  function TrackingBottomSheet(
    {
      isTracking, isPaused, pausedPct,
      routeName, lastCoordinate, heading, effectiveHeading, error,
      navToStartVisible, checkpointStatuses, nextCheckpointId, mandatoryTotal, mandatoryVisited,
      reportedIncidents, onStart, onStop, onReportIncident, onSheetChange,
    },
    ref,
  ) {
    const { colors, isDark } = useTheme();
    const snapPoints = isTracking ? SNAP_TRACKING : isPaused ? SNAP_PAUSED_LOCAL : SNAP_IDLE;
    // El sheet no se puede cerrar deslizando si está activo O si está pausado
    const canDismiss = !isTracking && !isPaused;

    return (
      <BottomSheet
        ref={ref}
        snapPoints={snapPoints}
        index={0}
        backgroundStyle={[styles.sheetBg, { backgroundColor: colors.surface }]}
        handleIndicatorStyle={[styles.sheetHandle, { backgroundColor: colors.borderLight }]}
        enablePanDownToClose={canDismiss}
        onChange={onSheetChange}
      >
        {isTracking ? (
          /* ── Modo activo ───────────────────────────────────────────────── */
          <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
            <View style={styles.trackingStrip}>
              <View style={styles.stripLeft}>
                <View style={styles.activeDot} />
                <View>
                  <Text style={[styles.stripRouteName, { color: colors.text }]} numberOfLines={1}>{routeName}</Text>
                  {effectiveHeading != null && (
                    <Text style={[styles.stripSpeed, { color: colors.textSecondary }]}>
                      {Math.round(effectiveHeading)}°
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.stopBtn}
                onPress={onStop}
                accessibilityLabel="Detener tracking"
                accessibilityRole="button"
              >
                <View style={styles.stopBtnSquare} />
                <Text style={styles.stopBtnLabel}>Parar</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.expandedSection, { borderTopColor: colors.surfaceAlt }]}>
              {navToStartVisible && (
                <View style={styles.navHint}>
                  <View style={styles.navHintDot} />
                  <Text style={styles.navHintText}>Navega al inicio de la ruta</Text>
                </View>
              )}

              {lastCoordinate && (
                <Text style={[styles.coords, { color: colors.textMuted }]}>
                  {lastCoordinate.lat.toFixed(6)}, {lastCoordinate.lng.toFixed(6)}
                  {heading != null ? `  •  ${Math.round(heading)}°` : ''}
                </Text>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <CheckpointsList
                statuses={checkpointStatuses}
                nextCheckpointId={nextCheckpointId}
                mandatoryTotal={mandatoryTotal}
                mandatoryVisited={mandatoryVisited}
              />

              <TouchableOpacity
                style={styles.incidentBtn}
                onPress={onReportIncident}
                accessibilityLabel="Reportar incidente"
                accessibilityRole="button"
              >
                <Ionicons name="warning-outline" size={18} color="#F97316" />
                <Text style={styles.incidentBtnText}>Reportar incidente</Text>
              </TouchableOpacity>

              {reportedIncidents.length > 0 && (
                <View style={[styles.reportedSection, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.reportedTitle, { color: colors.textSecondary }]}>Incidentes reportados</Text>
                  {reportedIncidents.map((inc, i) => (
                    <View key={i} style={styles.reportedRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.reportedCode, { color: colors.text }]}>{inc.code}</Text>
                        <Text style={[styles.reportedMeta, { color: colors.textMuted }]}>
                          {inc.type} - {inc.severity} - {inc.time}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </BottomSheetScrollView>

        ) : isPaused ? (
          /* ── Modo pausado (standby) ────────────────────────────────────── */
          <BottomSheetView style={styles.sheetContent}>
            <View style={styles.pausedStrip}>
              {/* Indicador izquierdo */}
              <View style={styles.stripLeft}>
                <View style={styles.pausedDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pausedLabel, { color: '#F59E0B' }]}>PAUSADO</Text>
                  <Text style={[styles.stripRouteName, { color: colors.text }]} numberOfLines={1}>
                    {routeName}
                  </Text>
                </View>
              </View>

              {/* Barra de progreso compacta */}
              <View style={styles.progressCompact}>
                <Text style={styles.progressPctText}>{pausedPct}%</Text>
                <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#FFFFFF18' : '#0000001A' }]}>
                  <View style={[styles.progressBarFill, { width: `${pausedPct}%` as `${number}%` }]} />
                </View>
              </View>
            </View>

            {/* Botón Reanudar */}
            <TouchableOpacity
              style={styles.resumeBtn}
              onPress={onStart}
              accessibilityLabel="Reanudar ruta"
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Ionicons name="play-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.resumeBtnText}>Reanudar ruta</Text>
            </TouchableOpacity>
          </BottomSheetView>

        ) : (
          /* ── Modo idle (sin iniciar) ───────────────────────────────────── */
          <BottomSheetView style={styles.sheetContent}>
            <View style={styles.idleContent}>
              <View style={styles.routeInfo}>
                <Text style={[styles.routeLabel, { color: colors.accent }]}>RUTA ASIGNADA</Text>
                <Text style={[styles.routeName, { color: colors.text }]} numberOfLines={2}>{routeName}</Text>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.startBtn}
                onPress={onStart}
                accessibilityLabel="Iniciar tracking"
                accessibilityRole="button"
              >
                <View style={styles.startBtnDot} />
                <Text style={styles.startBtnText}>Iniciar ruta</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetView>
        )}
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  sheetBg:     { borderRadius: 28 },
  sheetHandle: { width: 40 },
  sheetContent:{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },

  // ── Tracking active ─────────────────────────────────────────────────────
  trackingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  stripLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1,
  },
  activeDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E',
    shadowColor: '#22C55E', shadowOpacity: 0.8, shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
    flexShrink: 0,
  },
  stripRouteName: {
    fontSize: 14, fontWeight: '600', maxWidth: 200,
  },
  stripSpeed: {
    fontSize: 12, marginTop: 1,
  },

  stopBtn: {
    alignItems: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, backgroundColor: '#FF444420',
    borderWidth: 1, borderColor: '#FF444460',
  },
  stopBtnSquare: {
    width: 14, height: 14, borderRadius: 3, backgroundColor: '#FF4444',
  },
  stopBtnLabel: {
    color: '#FF4444', fontSize: 10, fontWeight: '700', letterSpacing: 0.5,
  },

  expandedSection: {
    gap: 14, paddingTop: 4, borderTopWidth: 1,
  },
  navHint:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navHintDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#38BDF8' },
  navHintText: { color: '#38BDF8', fontSize: 13, fontWeight: '600' },
  coords:      { fontSize: 11, fontFamily: 'monospace' },
  errorText:   { color: '#FF6B6B', fontSize: 13 },

  incidentBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#F9731620', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#F9731640',
  },
  incidentBtnText: { color: '#F97316', fontSize: 14, fontWeight: '700' },

  reportedSection: {
    borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 8, gap: 8,
  },
  reportedTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  reportedRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportedCode:  { fontSize: 13, fontWeight: '600' },
  reportedMeta:  { fontSize: 11 },

  // ── Paused standby ──────────────────────────────────────────────────────
  pausedStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, gap: 12,
  },
  pausedDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B', shadowOpacity: 0.8, shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 }, elevation: 4,
    flexShrink: 0,
  },
  pausedLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 1 },

  // Progress bar (compacta en strip)
  progressCompact: { alignItems: 'flex-end', gap: 4, minWidth: 72 },
  progressPctText: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },
  progressBarBg: {
    width: 72, height: 5, borderRadius: 3, overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%', backgroundColor: '#F59E0B', borderRadius: 3,
  },

  // Reanudar button
  resumeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#F59E0B', borderRadius: 16, paddingVertical: 15, marginTop: 12,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  resumeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  // ── Idle ────────────────────────────────────────────────────────────────
  idleContent: { gap: 16, paddingTop: 8 },
  routeInfo:   { gap: 4 },
  routeLabel:  { fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  routeName:   { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 16,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
  startBtnDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF',
  },
  startBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
