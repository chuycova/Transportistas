// ─── RouteDetailScreen.tsx ────────────────────────────────────────────────────
// Detalle de una ruta del historial. Muestra info y permite adjuntar evidencia.

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HistoryStackParamList } from '../navigation/HistoryNavigator';
import { EvidenceSection } from '../components/EvidenceSection';

type Props = NativeStackScreenProps<HistoryStackParamList, 'RouteDetail'>;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function RouteDetailScreen({ route }: Props) {
  const r = route.params.route;
  const isOff = r.status === 'off_route';

  return (
    <ScrollView
      style={styles.container}
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
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Información de la ruta</Text>
        <InfoRow label="Nombre"    value={r.routeName} />
        <InfoRow label="Fecha"     value={r.date} />
        <InfoRow label="Duración"  value={r.duration} />
        <InfoRow label="Distancia" value={r.distance} />
        <InfoRow label="Estado"    value={isOff ? 'Desvío detectado' : 'Completada'} />
      </View>

      {/* ── Evidencia ── */}
      <EvidenceSection contextLabel="esta ruta" />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
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
    backgroundColor: '#12121C',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    gap: 10,
  },
  sectionTitle: {
    color: '#8888AA',
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
    borderBottomColor: '#1E1E2E',
  },
  infoLabel: { color: '#8888AA', fontSize: 13 },
  infoValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
});
