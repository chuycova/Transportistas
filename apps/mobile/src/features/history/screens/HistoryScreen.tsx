// ─── HistoryScreen.tsx ────────────────────────────────────────────────────────
// Pantalla principal de Historial.
// Dos secciones: Rutas realizadas | Alertas activadas
// Cada ítem es navegable al detalle donde se puede adjuntar evidencia.

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
import type { HistoryStackParamList, HistoryRoute } from '../navigation/HistoryNavigator';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'HistoryMain'>;

function tripToHistoryRoute(trip: ReturnType<typeof useTrips>['pastTrips'][0]): HistoryRoute {
  const distance = trip.actual_distance_km ?? trip.estimated_distance_km;
  const distStr  = distance ? `${distance.toFixed(1)} km` : '—';

  let duration = '—';
  if (trip.started_at && trip.completed_at) {
    const ms = new Date(trip.completed_at).getTime() - new Date(trip.started_at).getTime();
    const h  = Math.floor(ms / 3_600_000);
    const m  = Math.floor((ms % 3_600_000) / 60_000);
    duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
  } else if (trip.estimated_duration_min) {
    const h = Math.floor(trip.estimated_duration_min / 60);
    const m = trip.estimated_duration_min % 60;
    duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const dateStr = trip.completed_at
    ? new Date(trip.completed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : (trip.scheduled_at ? new Date(trip.scheduled_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

  return {
    id:        trip.id,
    routeName: `${trip.origin_name} → ${trip.dest_name}`,
    date:      dateStr,
    duration,
    distance:  distStr,
    status:    trip.status === 'cancelled' ? 'off_route' : 'completed',
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
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function RouteRow({ item, onPress }: { item: HistoryRoute; onPress: () => void }) {
  const isOff = item.status === 'off_route';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.routeName}</Text>
        <View style={[styles.badge, isOff ? styles.badgeWarn : styles.badgeOk]}>
          <Text style={[styles.badgeText, isOff && styles.badgeTextWarn]}>
            {isOff ? 'Desvío' : 'Completada'}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaItem}>📅 {item.date}</Text>
        <Text style={styles.metaItem}>⏱ {item.duration}</Text>
        <Text style={styles.metaItem}>📍 {item.distance}</Text>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.evidenceHint}>Toca para ver detalle o adjuntar evidencia</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function AlertRow({ item, onPress }: { item: AlertHistoryItem; onPress: () => void }) {
  const meta = alertMeta(item.alertType);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <View style={styles.alertIconWrapper}>
          <Text style={styles.alertIcon}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{meta.label}</Text>
          {item.routeName ? (
            <Text style={styles.subRoute} numberOfLines={1}>Ruta: {item.routeName}</Text>
          ) : null}
        </View>
        <View style={[styles.badge, { backgroundColor: `${meta.color}22` }]}>
          <Text style={[styles.badgeText, { color: meta.color }]}>
            {item.severity === 'critical' ? 'Crítica' : item.severity === 'warning' ? 'Aviso' : 'Info'}
          </Text>
        </View>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaItem}>📅 {formatDate(item.createdAt)}</Text>
        <Text style={styles.metaItem}>🕐 {formatTime(item.createdAt)}</Text>
        {item.isResolved && <Text style={[styles.metaItem, { color: '#22C55E' }]}>✓ Atendida</Text>}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.evidenceHint}>Toca para ver detalle o adjuntar evidencia</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyText}>{message}</Text>
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

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchAlerts(), refetchTrips()]);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>

      {/* ── Selector de pestaña ── */}
      <View style={styles.segmentWrapper}>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'routes' && styles.segmentActive]}
          onPress={() => setActiveTab('routes')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, activeTab === 'routes' && styles.segmentTextActive]}>
            Rutas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, activeTab === 'alerts' && styles.segmentActive]}
          onPress={() => setActiveTab('alerts')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentText, activeTab === 'alerts' && styles.segmentTextActive]}>
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
              tintColor="#6C63FF"
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
              tintColor="#6C63FF"
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
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },

  // Segmented control
  segmentWrapper: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#12121C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#6C63FF',
  },
  segmentText: {
    color: '#8888AA',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },

  // Lista
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },

  // Cards
  card: {
    backgroundColor: '#12121C',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  subRoute: {
    color: '#8888AA',
    fontSize: 12,
    marginTop: 1,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  metaItem: {
    color: '#8888AA',
    fontSize: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2A2A3F',
    paddingTop: 8,
  },
  evidenceHint: {
    color: '#6C63FF',
    fontSize: 11,
    fontWeight: '500',
  },
  chevron: {
    color: '#6C63FF',
    fontSize: 20,
    fontWeight: '300',
  },

  // Badges
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeOk:   { backgroundColor: '#22C55E22' },
  badgeWarn: { backgroundColor: '#F59E0B22' },
  badgeText:     { color: '#22C55E', fontSize: 11, fontWeight: '600' },
  badgeTextWarn: { color: '#F59E0B' },

  // Alert icon
  alertIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1C1C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIcon: { fontSize: 18 },

  // Estado vacío
  empty: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: '#8888AA', fontSize: 14, textAlign: 'center' },
});
