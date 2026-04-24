import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/ThemeContext';
import { DEV_ROUTES, type DevRoute } from '../lib/dev-routes';

interface SimApi {
  isRunning: boolean;
  position: { lat: number; lng: number } | null;
  heading: number | null;
  progress: number;
  segmentIdx: number;
  speedKmh: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  setSpeedKmh: (v: number) => void;
}

interface DevSimulatorPanelProps {
  open: boolean;
  sim: SimApi;
  routeWaypointsCount: number;
  onToggleOpen: () => void;
  onLoadDevRoute: (r: DevRoute) => void;
}

export function DevSimulatorPanel({
  open, sim, routeWaypointsCount, onToggleOpen, onLoadDevRoute,
}: DevSimulatorPanelProps) {
  const { isDark } = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.btn,
          { backgroundColor: isDark ? 'rgba(108,99,255,0.7)' : 'rgba(108,99,255,0.85)' },
          sim.isRunning && styles.btnActive,
        ]}
        onPress={onToggleOpen}
        accessibilityLabel="Panel de simulación GPS"
        accessibilityRole="button"
      >
        <Ionicons name="code-slash-outline" size={18} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>

      {open && (
        <View style={[styles.panel, {
          backgroundColor: isDark ? 'rgba(10,10,25,0.95)' : 'rgba(240,240,255,0.97)',
          borderColor: isDark ? '#6C63FF44' : '#6C63FF33',
        }]}>
          <View style={styles.header}>
            <Ionicons name="navigate-outline" size={14} color="#6C63FF" />
            <Text style={[styles.headerText, { color: isDark ? '#ccc' : '#333' }]}>
              Simulador GPS
            </Text>
            {sim.position && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>ACTIVO</Text>
              </View>
            )}
          </View>

          {routeWaypointsCount < 2 ? (
            <Text style={[styles.noRoute, { color: isDark ? '#888' : '#666' }]}>
              Sin ruta cargada. Selecciona una ruta primero.
            </Text>
          ) : (
            <>
              <View style={[styles.progressTrack, { backgroundColor: isDark ? '#ffffff15' : '#00000012' }]}>
                <View style={[styles.progressFill, { width: `${sim.progress * 100}%` as `${number}%` }]} />
              </View>
              <Text style={[styles.progressLabel, { color: isDark ? '#888' : '#666' }]}>
                {Math.round(sim.progress * 100)}%  ·  seg {sim.segmentIdx + 1}/{routeWaypointsCount - 1}
              </Text>

              {sim.position && (
                <Text style={[styles.coords, { color: isDark ? '#6C63FF' : '#4a43cc' }]}>
                  {sim.position.lat.toFixed(6)}, {sim.position.lng.toFixed(6)}
                  {sim.heading != null ? `  ·  ${Math.round(sim.heading)}°` : ''}
                </Text>
              )}

              <Text style={[styles.label, { color: isDark ? '#aaa' : '#555' }]}>Velocidad</Text>
              <View style={styles.speedRow}>
                {[10, 30, 60, 120].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.speedBtn, sim.speedKmh === s && styles.speedBtnActive]}
                    onPress={() => sim.setSpeedKmh(s)}
                  >
                    <Text style={[styles.speedText, sim.speedKmh === s && styles.speedTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
                <Text style={[styles.speedUnit, { color: isDark ? '#888' : '#666' }]}>km/h</Text>
              </View>

              <View style={styles.controls}>
                <TouchableOpacity
                  style={[styles.ctrlBtn, { backgroundColor: sim.isRunning ? '#F9731620' : '#22C55E20', borderColor: sim.isRunning ? '#F9731660' : '#22C55E60' }]}
                  onPress={() => sim.isRunning ? sim.pause() : sim.start()}
                >
                  <Ionicons
                    name={sim.isRunning ? 'pause' : 'play'}
                    size={16}
                    color={sim.isRunning ? '#F97316' : '#22C55E'}
                  />
                  <Text style={[styles.ctrlText, { color: sim.isRunning ? '#F97316' : '#22C55E' }]}>
                    {sim.isRunning ? 'Pausar' : 'Iniciar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ctrlBtn, { backgroundColor: '#6C63FF20', borderColor: '#6C63FF60' }]}
                  onPress={sim.reset}
                >
                  <Ionicons name="reload" size={15} color="#6C63FF" />
                  <Text style={[styles.ctrlText, { color: '#6C63FF' }]}>Reset</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={[styles.divider, { backgroundColor: isDark ? '#ffffff12' : '#00000010' }]} />
          <Text style={[styles.label, { color: isDark ? '#aaa' : '#555', marginBottom: 6 }]}>
            Cargar ruta de prueba
          </Text>
          {DEV_ROUTES.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.routeBtn, { backgroundColor: isDark ? '#ffffff08' : '#00000006', borderColor: isDark ? '#ffffff18' : '#00000018' }]}
              onPress={() => onLoadDevRoute(r)}
            >
              <Ionicons name="map-outline" size={13} color="#6C63FF" style={{ marginRight: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.routeName, { color: isDark ? '#ddd' : '#222' }]}>{r.name}</Text>
                <Text style={[styles.routeDesc, { color: isDark ? '#777' : '#888' }]}>
                  {r.origin} → {r.dest} · {r.waypoints.length} pts
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 102, left: 16, zIndex: 20,
  },
  btn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45, shadowRadius: 6, elevation: 7,
  },
  btnActive: {
    shadowOpacity: 0.8, shadowRadius: 10,
  },
  panel: {
    marginTop: 8, borderRadius: 16, borderWidth: 1,
    padding: 14, minWidth: 230,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 12,
    gap: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  headerText: { fontSize: 13, fontWeight: '700', flex: 1 },
  activePill: {
    backgroundColor: '#22C55E22', borderRadius: 8, borderWidth: 1,
    borderColor: '#22C55E55', paddingHorizontal: 6, paddingVertical: 2,
  },
  activePillText: { color: '#22C55E', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  noRoute: { fontSize: 12, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

  progressTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: 4, backgroundColor: '#6C63FF', borderRadius: 2,
  },
  progressLabel: { fontSize: 10, fontFamily: 'monospace' },
  coords: { fontSize: 10, fontFamily: 'monospace', fontWeight: '500' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },

  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  speedBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: '#6C63FF44',
  },
  speedBtnActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  speedText: { color: '#6C63FF', fontSize: 12, fontWeight: '700' },
  speedTextActive: { color: '#fff' },
  speedUnit: { fontSize: 11 },

  controls: { flexDirection: 'row', gap: 8, marginTop: 2 },
  ctrlBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  ctrlText: { fontSize: 13, fontWeight: '700' },

  divider: { height: 1, marginVertical: 4 },
  routeBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  routeName: { fontSize: 12, fontWeight: '700' },
  routeDesc: { fontSize: 10, marginTop: 1 },
});
