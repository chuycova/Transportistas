// ─── RouteDetailScreen.tsx ────────────────────────────────────────────────────
// Detalle de una ruta del historial. Muestra info y permite adjuntar evidencia.

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HistoryStackParamList } from '../navigation/HistoryNavigator';
import { EvidenceSection } from '../components/EvidenceSection';
import { useTheme } from '@lib/ThemeContext';

type Props = NativeStackScreenProps<HistoryStackParamList, 'RouteDetail'>;

function InfoRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.surfaceAlt }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export function RouteDetailScreen({ route }: Props) {
  const r = route.params.route;
  const isOff = r.status === 'off_route';
  const { colors } = useTheme();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >

      {/* ── Encabezado de estado ── */}
      <View style={[styles.statusBanner, isOff ? styles.bannerWarn : styles.bannerOk]}>
        <Text style={styles.statusIcon}>{isOff ? '⚠️' : '✅'}</Text>
        <Text style={[styles.statusText, isOff ? styles.statusTextWarn : styles.statusTextOk]}>
          {isOff ? 'Ruta con desvíos detectados' : 'Ruta completada correctamente'}
        </Text>
      </View>

      {/* ── Info de la ruta ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Información de la ruta</Text>
        <InfoRow label="Nombre"    value={r.routeName} colors={colors} />
        <InfoRow label="Fecha"     value={r.date}      colors={colors} />
        <InfoRow label="Duración"  value={r.duration}  colors={colors} />
        <InfoRow label="Distancia" value={r.distance}  colors={colors} />
        <InfoRow label="Estado"    value={isOff ? 'Desvío detectado' : 'Completada'} colors={colors} />
      </View>

      {/* ── Evidencia ── */}
      <EvidenceSection contextLabel="esta ruta" />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { padding: 16, gap: 14, paddingBottom: 40 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  bannerOk:   { backgroundColor: '#22C55E11', borderColor: '#22C55E33' },
  bannerWarn: { backgroundColor: '#F59E0B11', borderColor: '#F59E0B33' },
  statusIcon: { fontSize: 22 },
  statusText:     { flex: 1, fontSize: 13, fontWeight: '600' },
  statusTextOk:   { color: '#22C55E' },
  statusTextWarn: { color: '#F59E0B' },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500' },
});
