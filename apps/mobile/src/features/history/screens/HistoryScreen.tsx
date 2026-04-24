// ─── HistoryScreen.tsx ────────────────────────────────────────────────────────
// Pantalla principal de Historial.
// Dos secciones: Rutas realizadas | Alertas activadas

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAlertHistory } from '../hooks/useAlertHistory';
import type { AlertHistoryItem } from '../hooks/useAlertHistory';
import { useTrips } from '@features/trips/hooks/useTrips';
import { useTheme } from '@lib/ThemeContext';
import type { HistoryStackParamList, HistoryRoute } from '../navigation/HistoryNavigator';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'HistoryMain'>;

function fmtMsDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1)  return 'Justo ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'hace 1 dia';
  return `hace ${days} dias`;
}

function tripToHistoryRoute(trip: ReturnType<typeof useTrips>['pastTrips'][0]): HistoryRoute {
  const distance = trip.actual_distance_km ?? trip.estimated_distance_km;
  const distStr  = distance ? `${distance.toFixed(1)} km` : '—';

  // Duracion de la ruta asignada (route_started_at -> route_completed_at)
  // Fallback a started_at -> completed_at si no hay datos de ruta
  let duration = '—';
  if (trip.route_started_at && trip.route_completed_at) {
    const ms = new Date(trip.route_completed_at).getTime() - new Date(trip.route_started_at).getTime();
    duration = fmtMsDuration(ms);
  } else if (trip.started_at && trip.completed_at) {
    const ms = new Date(trip.completed_at).getTime() - new Date(trip.started_at).getTime();
    duration = fmtMsDuration(ms);
  } else if (trip.estimated_duration_min) {
    const h = Math.floor(trip.estimated_duration_min / 60);
    const m = trip.estimated_duration_min % 60;
    duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const endRef = trip.completed_at ?? trip.started_at;
  const dateStr = endRef
    ? new Date(endRef).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  let status: HistoryRoute['status'] = 'completed';
  if (trip.status === 'cancelled') status = 'cancelled';

  return {
    id:        trip.id,
    routeName: `${trip.origin_name} → ${trip.dest_name}`,
    date:      dateStr,
    duration,
    distance:  distStr,
    status,
    started_at:         trip.started_at,
    route_started_at:   trip.route_started_at,
    route_completed_at: trip.route_completed_at,
    completed_at:       trip.completed_at,
  };
}

// ─── Helpers de alertas ───────────────────────────────────────────────────────
const ALERT_META: Record<string, { label: string; icon: string; color: string }> = {
  emergency:      { label: 'Pánico / SOS',       icon: '🆘', color: '#EF4444' },
  off_route:      { label: 'Desvío de ruta',      icon: '⚠️', color: '#F59E0B' },
  long_stop:      { label: 'Parada prolongada',   icon: '⏸️', color: '#F59E0B' },
  speeding:       { label: 'Exceso de velocidad', icon: '🚨', color: '#EF4444' },
  geofence_entry: { label: 'Entrada a geocerca',  icon: '📍', color: '#6C63FF' },
  geofence_exit:  { label: 'Salida de geocerca',  icon: '📤', color: '#6C63FF' },
};

function alertMeta(type: string) {
  return ALERT_META[type] ?? { label: type, icon: '🔔', color: '#8888AA' };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function RouteRow({ item, onPress }: { item: HistoryRoute; onPress: () => void }) {
  const { colors } = useTheme();
  const isCancelled = item.status === 'cancelled';
  const isOff = item.status === 'off_route';
  const endRef = item.completed_at ?? item.started_at;
  const ago = endRef ? timeAgo(endRef) : '';

  const badgeStyle = isCancelled ? styles.badgeCancelled : (isOff ? styles.badgeWarn : styles.badgeOk);
  const badgeLabel = isCancelled ? 'No concluido' : (isOff ? 'Desvio' : 'Completada');
  const badgeTextStyle = isCancelled ? styles.badgeTextCancelled : (isOff ? styles.badgeTextWarn : null);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.routeName}</Text>
        <View style={[styles.badge, badgeStyle]}>
          <Text style={[styles.badgeText, badgeTextStyle]}>
            {badgeLabel}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={[styles.metaItem, { color: colors.textSecondary }]}>⏱ {item.duration}</Text>
        <Text style={[styles.metaItem, { color: colors.textSecondary }]}>📍 {item.distance}</Text>
        {ago ? <Text style={[styles.metaItem, { color: colors.textSecondary }]}>{ago}</Text> : null}
      </View>
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.evidenceHint, { color: colors.accent }]}>Toca para ver detalle</Text>
        <Text style={[styles.chevron, { color: colors.accent }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function AlertRow({ item, onPress }: { item: AlertHistoryItem; onPress: () => void }) {
  const { colors } = useTheme();
  const meta = alertMeta(item.alertType);
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.alertIconWrapper, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={styles.alertIcon}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{meta.label}</Text>
          {item.routeName ? (
            <Text style={[styles.subRoute, { color: colors.textSecondary }]} numberOfLines={1}>Ruta: {item.routeName}</Text>
          ) : null}
        </View>
        <View style={[styles.badge, { backgroundColor: `${meta.color}22` }]}>
          <Text style={[styles.badgeText, { color: meta.color }]}>
            {item.severity === 'critical' ? 'Crítica' : item.severity === 'warning' ? 'Aviso' : 'Info'}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={[styles.metaItem, { color: colors.textSecondary }]}>📅 {formatDate(item.createdAt)}</Text>
        <Text style={[styles.metaItem, { color: colors.textSecondary }]}>🕐 {formatTime(item.createdAt)}</Text>
        {item.isResolved && <Text style={[styles.metaItem, { color: '#22C55E' }]}>✓ Atendida</Text>}
      </View>
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.evidenceHint, { color: colors.accent }]}>Toca para ver detalle o adjuntar evidencia</Text>
        <Text style={[styles.chevron, { color: colors.accent }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

type Tab = 'routes' | 'alerts';

export function HistoryScreen() {
  const nav = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<Tab>('routes');
  const { data: alerts, loading: alertsLoading, refetch: refetchAlerts } = useAlertHistory();
  const { pastTrips, loading: tripsLoading, refetch: refetchTrips } = useTrips();
  const historyRoutes = pastTrips.map(tripToHistoryRoute);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAlerts(), refetchTrips()]);
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>

      {/* ── Selector de pestaña ── */}
      <View style={[styles.segmentWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'routes' && [styles.segmentActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('routes')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'routes' ? '#FFFFFF' : colors.textSecondary }]}>
            Rutas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'alerts' && [styles.segmentActive, { backgroundColor: colors.accent }]]}
          onPress={() => setActiveTab('alerts')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, { color: activeTab === 'alerts' ? '#FFFFFF' : colors.textSecondary }]}>
            Alertas
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Lista de Viajes (historial) ── */}
      {activeTab === 'routes' && (
        <FlatList
          data={historyRoutes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || tripsLoading}
              onRefresh={() => { void onRefresh(); }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            tripsLoading
              ? null
              : <EmptyState message="Sin viajes completados aún" />
          }
          renderItem={({ item }) => (
            <RouteRow
              item={item}
              onPress={() => nav.navigate('RouteDetail', { route: item })}
            />
          )}
        />
      )}

      {/* ── Lista de Alertas ── */}
      {activeTab === 'alerts' && (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || alertsLoading}
              onRefresh={() => { void onRefresh(); }}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            alertsLoading
              ? null
              : <EmptyState message="Sin alertas registradas" />
          }
          renderItem={({ item }) => (
            <AlertRow
              item={item}
              onPress={() => nav.navigate('AlertDetail', { alert: item })}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  segmentWrapper: {
    flexDirection: 'row',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: {},
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },

  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },

  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  subRoute: {
    fontSize: 12,
    marginTop: 1,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  metaItem: {
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  evidenceHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300',
  },

  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeOk:   { backgroundColor: '#22C55E22' },
  badgeWarn: { backgroundColor: '#F59E0B22' },
  badgeCancelled: { backgroundColor: '#F5900B22' },
  badgeText:     { color: '#22C55E', fontSize: 11, fontWeight: '600' },
  badgeTextWarn: { color: '#F59E0B' },
  badgeTextCancelled: { color: '#F5900B' },

  alertIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIcon: { fontSize: 18 },

  empty: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
