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

function fmtMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function timeAgoDetail(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'Justo ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'hace 1 dia';
  return `hace ${days} dias`;
}

export function RouteDetailScreen({ route }: Props) {
  const r = route.params.route;
  const isCancelled = r.status === 'cancelled';
  const isOff = r.status === 'off_route';
  const { colors } = useTheme();

  // Tiempos desglosados
  const approachTime = (r.started_at && r.route_started_at)
    ? fmtMs(new Date(r.route_started_at).getTime() - new Date(r.started_at).getTime())
    : null;
  const routeTime = (r.route_started_at && r.route_completed_at)
    ? fmtMs(new Date(r.route_completed_at).getTime() - new Date(r.route_started_at).getTime())
    : null;
  const endRef = r.completed_at ?? r.route_completed_at;
  const ago = endRef ? timeAgoDetail(endRef) : null;

  const statusLabel = isCancelled ? 'No concluido' : (isOff ? 'Desvio detectado' : 'Completada');
  const bannerStyle = isCancelled ? styles.bannerCancelled : (isOff ? styles.bannerWarn : styles.bannerOk);
  const textStyle = isCancelled ? styles.statusTextCancelled : (isOff ? styles.statusTextWarn : styles.statusTextOk);
  const statusIcon = isCancelled ? '⛔' : (isOff ? '⚠️' : '✅');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >

      {/* -- Encabezado de estado -- */}
      <View style={[styles.statusBanner, bannerStyle]}>
        <Text style={styles.statusIcon}>{statusIcon}</Text>
        <Text style={[styles.statusText, textStyle]}>
          {statusLabel}
        </Text>
      </View>

      {/* -- Info de la ruta -- */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Informacion de la ruta</Text>
        <InfoRow label="Nombre"    value={r.routeName} colors={colors} />
        <InfoRow label="Fecha"     value={r.date}      colors={colors} />
        <InfoRow label="Distancia" value={r.distance}  colors={colors} />
        <InfoRow label="Estado"    value={statusLabel}  colors={colors} />
        {ago && <InfoRow label="Finalizado" value={ago} colors={colors} />}
      </View>

      {/* -- Desglose de tiempos -- */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Desglose de tiempos</Text>
        {approachTime && (
          <InfoRow label="Ubicacion → 1er punto" value={approachTime} colors={colors} />
        )}
        {routeTime && (
          <InfoRow label="Ruta asignada" value={routeTime} colors={colors} />
        )}
        <InfoRow label="Duracion total" value={r.duration} colors={colors} />
        {!approachTime && !routeTime && (
          <Text style={[styles.noDataHint, { color: colors.textSecondary }]}>
            Sin datos detallados de tiempo para este viaje
          </Text>
        )}
      </View>

      {/* -- Evidencia -- */}
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
  bannerCancelled: { backgroundColor: '#F5900B11', borderColor: '#F5900B33' },
  statusIcon: { fontSize: 22 },
  statusText:     { flex: 1, fontSize: 13, fontWeight: '600' },
  statusTextOk:   { color: '#22C55E' },
  statusTextWarn: { color: '#F59E0B' },
  statusTextCancelled: { color: '#F5900B' },
  noDataHint: { fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },

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
