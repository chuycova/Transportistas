// ─── AlertDetailScreen.tsx ────────────────────────────────────────────────────
// Detalle de una alerta del historial. Muestra info y permite adjuntar evidencia.

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HistoryStackParamList } from '../navigation/HistoryNavigator';
import { EvidenceSection } from '../components/EvidenceSection';
import { useTheme } from '@lib/ThemeContext';

type Props = NativeStackScreenProps<HistoryStackParamList, 'AlertDetail'>;

const ALERT_META: Record<string, { label: string; icon: string; color: string; description: string }> = {
  emergency: {
    label: 'Pánico / SOS',
    icon: '🆘',
    color: '#EF4444',
    description: 'El conductor activó el botón de pánico de emergencia.',
  },
  off_route: {
    label: 'Desvío de ruta',
    icon: '⚠️',
    color: '#F59E0B',
    description: 'El vehículo se alejó de la ruta asignada más del umbral permitido.',
  },
  long_stop: {
    label: 'Parada prolongada',
    icon: '⏸️',
    color: '#F59E0B',
    description: 'El vehículo estuvo detenido por más tiempo del esperado.',
  },
  speeding: {
    label: 'Exceso de velocidad',
    icon: '🚨',
    color: '#EF4444',
    description: 'El vehículo superó el límite de velocidad configurado.',
  },
  geofence_entry: {
    label: 'Entrada a geocerca',
    icon: '📍',
    color: '#6C63FF',
    description: 'El vehículo entró a una zona geográfica configurada.',
  },
  geofence_exit: {
    label: 'Salida de geocerca',
    icon: '📤',
    color: '#6C63FF',
    description: 'El vehículo salió de una zona geográfica configurada.',
  },
};

function alertMeta(type: string) {
  return ALERT_META[type] ?? {
    label: type,
    icon: '🔔',
    color: '#8888AA',
    description: 'Alerta del sistema.',
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.surfaceAlt }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function PayloadRows({ alertType, payload, colors }: { alertType: string; payload: Record<string, unknown>; colors: ReturnType<typeof useTheme>['colors'] }) {
  if (Object.keys(payload).length === 0) return null;

  const rows: { label: string; value: string }[] = [];

  if (alertType === 'off_route' && payload.deviation_m != null) {
    rows.push({ label: 'Desvío detectado', value: `${String(payload.deviation_m)} m` });
  }
  if (alertType === 'speeding') {
    if (payload.speed_kmh != null)  rows.push({ label: 'Velocidad',  value: `${String(payload.speed_kmh)} km/h` });
    if (payload.limit_kmh != null)  rows.push({ label: 'Límite',     value: `${String(payload.limit_kmh)} km/h` });
  }
  if (alertType === 'long_stop' && payload.stop_minutes != null) {
    rows.push({ label: 'Tiempo detenido', value: `${String(payload.stop_minutes)} min` });
  }
  if ((alertType === 'geofence_entry' || alertType === 'geofence_exit') && payload.geofence_name) {
    rows.push({ label: 'Geocerca', value: String(payload.geofence_name) });
  }

  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((r) => (
        <InfoRow key={r.label} label={r.label} value={r.value} colors={colors} />
      ))}
    </>
  );
}

export function AlertDetailScreen({ route }: Props) {
  const alert = route.params.alert;
  const meta  = alertMeta(alert.alertType);
  const { colors } = useTheme();

  const severityLabel =
    alert.severity === 'critical' ? 'Crítica' :
    alert.severity === 'warning'  ? 'Aviso'   : 'Informativa';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
    >

      {/* ── Encabezado visual del tipo de alerta ── */}
      <View style={[styles.alertHeader, { borderColor: `${meta.color}44`, backgroundColor: `${meta.color}11` }]}>
        <Text style={styles.alertIconLarge}>{meta.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.alertLabel, { color: meta.color }]}>{meta.label}</Text>
          <Text style={[styles.alertDesc, { color: colors.textSecondary }]}>{meta.description}</Text>
        </View>
      </View>

      {/* ── Info general ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Detalle</Text>
        <InfoRow label="Fecha"     value={formatDate(alert.createdAt)} colors={colors} />
        <InfoRow label="Hora"      value={formatTime(alert.createdAt)} colors={colors} />
        <InfoRow label="Severidad" value={severityLabel} colors={colors} />
        <InfoRow label="Estado"    value={alert.isResolved ? 'Atendida ✓' : 'Pendiente'} colors={colors} />
        {alert.routeName && (
          <InfoRow label="Ruta" value={alert.routeName} colors={colors} />
        )}
        <PayloadRows alertType={alert.alertType} payload={alert.payload} colors={colors} />
      </View>

      {/* ── Evidencia ── */}
      <EvidenceSection contextLabel="esta alerta" />

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { padding: 16, gap: 14, paddingBottom: 40 },

  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  alertIconLarge: { fontSize: 36 },
  alertLabel:     { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  alertDesc:      { fontSize: 13, lineHeight: 18 },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '500', textAlign: 'right', flex: 1, paddingLeft: 16 },
});
