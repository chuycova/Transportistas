import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/ThemeContext';

export type MapTheme = 'auto' | 'light' | 'dark';

interface MapSettingsPanelProps {
  open: boolean;
  showTraffic: boolean;
  isSatellite: boolean;
  mapTheme: MapTheme;
  onToggleOpen: () => void;
  onToggleTraffic: () => void;
  onToggleSatellite: () => void;
  onChangeTheme: (t: MapTheme) => void;
}

export function MapSettingsPanel({
  open, showTraffic, isSatellite, mapTheme,
  onToggleOpen, onToggleTraffic, onToggleSatellite, onChangeTheme,
}: MapSettingsPanelProps) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.container, open && { zIndex: 30 }]}>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)' }]}
        onPress={onToggleOpen}
        accessibilityLabel="Ajustes del mapa"
        accessibilityRole="button"
      >
        <Ionicons
          name="settings-outline"
          size={20}
          color={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)'}
        />
      </TouchableOpacity>

      {open && (
        <View style={[styles.panel, {
          backgroundColor: isDark ? 'rgba(15,15,30,0.92)' : 'rgba(255,255,255,0.95)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        }]}>
          <TouchableOpacity style={styles.row} onPress={onToggleTraffic}>
            <Text style={[styles.rowText, { color: isDark ? '#eee' : '#222' }]}>Tráfico</Text>
            <View style={[styles.toggle, showTraffic ? styles.toggleOn : styles.toggleOff]}>
              <View style={[styles.toggleThumb, showTraffic ? styles.toggleThumbOn : styles.toggleThumbOff]} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={onToggleSatellite}>
            <Text style={[styles.rowText, { color: isDark ? '#eee' : '#222' }]}>Satélite</Text>
            <View style={[styles.toggle, isSatellite ? styles.toggleOn : styles.toggleOff]}>
              <View style={[styles.toggleThumb, isSatellite ? styles.toggleThumbOn : styles.toggleThumbOff]} />
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: isDark ? '#ffffff15' : '#00000010' }]} />
          <Text style={[styles.groupLabel, { color: isDark ? '#aaa' : '#666' }]}>TEMA DEL MAPA</Text>
          {(['auto', 'light', 'dark'] as const).map((t) => (
            <TouchableOpacity key={t} style={styles.row} onPress={() => onChangeTheme(t)}>
              <Text style={[styles.rowText, { color: isDark ? '#eee' : '#222' }]}>
                {t === 'auto' ? 'Automático' : t === 'light' ? 'Claro' : 'Oscuro'}
              </Text>
              {mapTheme === t && (
                <Text style={{ color: colors.accent, fontSize: 16 }}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 56, left: 16, zIndex: 20,
  },
  btn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 6,
  },
  panel: {
    marginTop: 8,
    borderRadius: 16, borderWidth: 1,
    paddingVertical: 8, paddingHorizontal: 4,
    minWidth: 180,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, gap: 12,
  },
  rowText: { fontSize: 14, fontWeight: '500', flex: 1 },
  divider: { height: 1, marginHorizontal: 14, marginVertical: 4 },
  groupLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1,
    paddingHorizontal: 14, paddingTop: 2, paddingBottom: 4,
  },
  toggle: {
    width: 38, height: 22, borderRadius: 11,
    justifyContent: 'center', padding: 2,
  },
  toggleOn:  { backgroundColor: '#6C63FF' },
  toggleOff: { backgroundColor: '#44445A' },
  toggleThumb: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff',
  },
  toggleThumbOn:  { alignSelf: 'flex-end' },
  toggleThumbOff: { alignSelf: 'flex-start' },
});
