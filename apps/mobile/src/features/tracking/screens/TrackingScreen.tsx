// ─── TrackingScreen.tsx ───────────────────────────────────────────────────────
// Pantalla principal del conductor durante el tracking.
// Composición pura de hooks de dominio + componentes UI.
// Sin lógica de infraestructura (DB, MMKV, socket) en este archivo.

import React, {
  useEffect, useRef, useCallback, useState, useMemo,
} from 'react';
import {
  View, TouchableOpacity, TouchableWithoutFeedback, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type MapView from 'react-native-maps';
import { useTheme } from '@lib/ThemeContext';
import { ThemedStatusBar } from '@components/ui/ThemedStatusBar';
import * as Notifications from 'expo-notifications';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useGpsTracking } from '../hooks/useGpsTracking';
import { usePingSync } from '../hooks/usePingSync';
import { useCheckpoints } from '../hooks/useCheckpoints';
import { useDevSimulator } from '../hooks/useDevSimulator';
import { useActiveRoute } from '../hooks/useActiveRoute';
import { useInitialPosition } from '../hooks/useInitialPosition';
import { useNavToStart } from '../hooks/useNavToStart';
import { useCameraFollow } from '../hooks/useCameraFollow';
import { usePanicHold } from '../hooks/usePanicHold';
import { useDeviationAlerts } from '../hooks/useDeviationAlerts';
import { useArrivalDetection } from '../hooks/useArrivalDetection';
import { useTenantId } from '../hooks/useTenantId';
import { usePanicTrigger } from '../hooks/usePanicTrigger';
import { useRouteLifecycle } from '../hooks/useRouteLifecycle';
import { useTrackingToggle } from '../hooks/useTrackingToggle';
import { ReportIncidentModal } from '@features/incidents/components/ReportIncidentModal';
import { emitLocationPing } from '@lib/socket';
import { MMKV_KEYS } from '@lib/constants';
import { usePermissions } from '@lib/usePermissions';
import { PermissionsGateScreen } from '@components/ui/PermissionsGateScreen';
import { ArrivalBanner } from '../components/ArrivalBanner';
import { PanicFab } from '../components/PanicFab';
import { MapSettingsPanel } from '../components/MapSettingsPanel';
import type { MapTheme } from '../components/MapSettingsPanel';
import { DevSimulatorPanel } from '../components/DevSimulatorPanel';
import { TrackingBottomSheet } from '../components/TrackingBottomSheet';
import { StopTrackingDialog } from '../components/StopTrackingDialog';
import { TrackingMap } from '../components/TrackingMap';
import { storage } from '@lib/mmkv';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export function TrackingScreen() {
  const {
    allRequiredGranted, permissions,
    loading: permLoading, requestAll, refresh: refreshPerms,
  } = usePermissions();
  const { colors, isDark } = useTheme();

  const mapRef   = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);

  // ── Datos de ruta (MMKV, se refrescan al ganar foco) ─────────────────────
  const {
    routeId, routeName, vehicleId,
    routeWaypoints, routeStops,
    tripId, routeActive,
    navVersion, navFetchedRef,
    isPaused, pausedPct,
    setTripId, setRouteWaypoints, setRouteStops, setRouteActive, setNavVersion, setIsPaused, setPausedPct,
  } = useActiveRoute();

  // ── Tenant ID ────────────────────────────────────────────────────────────
  const { tenantId, tenantIdRef } = useTenantId();

  // ── GPS + tracking ────────────────────────────────────────────────────────
  const { isTracking, lastCoordinate, heading, error, startTracking, stopTracking } =
    useGpsTracking({ vehicleId, tenantId, routeId, tripId });

  // ── Posición inicial (antes de tracking) ─────────────────────────────────
  const initialPosition = useInitialPosition();

  // ── Simulador GPS (Dev) ──────────────────────────────────────────────────
  const handleSimTick = useCallback((pos: { lat: number; lng: number; speed?: number }, h: number) => {
    emitLocationPing({
      vehicleId,
      tenantId: tenantIdRef.current || tenantId,
      routeId,
      coordinate: { lat: pos.lat, lng: pos.lng },
      speedKmh:   pos.speed != null ? Number((pos.speed * 3.6).toFixed(1)) : undefined,
      headingDeg: Math.round(h),
      recordedAt: new Date().toISOString(),
    });
  }, [vehicleId, tenantId, routeId, tenantIdRef]);

  const sim = useDevSimulator(
    routeWaypoints.map((w) => ({ lat: w.latitude, lng: w.longitude })),
    { onTick: handleSimTick },
  );

  const effectivePosition = sim.position ?? lastCoordinate ?? initialPosition;
  const effectiveHeading  = sim.position != null ? sim.heading : heading;
  const driverPosition    = effectivePosition;
  const driverHeading     = effectiveHeading;

  // ── Checkpoints ───────────────────────────────────────────────────────────
  const { statuses: checkpointStatuses, nextCheckpoint, mandatoryTotal, mandatoryVisited } =
    useCheckpoints({
      routeId:      routeId || undefined,
      tripId,
      currentCoord: lastCoordinate ? { lat: lastCoordinate.lat, lng: lastCoordinate.lng } : null,
      enabled:      isTracking,
    });

  // ── Ruta de navegación al inicio ─────────────────────────────────────────
  const { navToStartPath, setNavToStartPath } = useNavToStart({
    driverPosition, routeWaypoints, navVersion, navFetchedRef,
    isTracking, vehicleId, routeId,
  });

  // ── Cámara Waze-style ─────────────────────────────────────────────────────
  const { centerOnMe } = useCameraFollow({
    mapRef, isTracking, effectivePosition, effectiveHeading,
  });

  // ── Detección de llegada ──────────────────────────────────────────────────
  const {
    arrivalSuggested,
    setArrivalSuggested, setArrivalDismissed, setRouteStartRecorded,
  } = useArrivalDetection({
    isTracking, effectivePosition, lastCoordinate,
    routeWaypoints, simProgress: sim.progress,
  });

  // ── Desviaciones (socket) ─────────────────────────────────────────────────
  useDeviationAlerts();

  // ── Ciclo de vida de la ruta ──────────────────────────────────────────────
  const { handleCompleteTrip, handleSheetChange } = useRouteLifecycle({
    sim, stopTracking, isTracking, setTripId,
    setRouteWaypoints, setRouteStops, setRouteActive, setNavToStartPath, navFetchedRef,
    setArrivalSuggested, setArrivalDismissed, setRouteStartRecorded,
    setIsPaused,
  });


  // ── Pánico ────────────────────────────────────────────────────────────────
  const { triggerPanic } = usePanicTrigger({ vehicleId, lastCoordinate });
  const {
    panicHolding, panicCountdown, panicStyle,
    handlePanicPressIn, handlePanicPressOut,
  } = usePanicHold({ isTracking, onTrigger: triggerPanic });

  // ── Incidentes ────────────────────────────────────────────────────────────
  const [incidentModalVisible, setIncidentModalVisible] = useState(false);
  const [reportedIncidents, setReportedIncidents] = useState<
    Array<{ code: string; type: string; severity: string; time: string }>
  >([]);

  // ── Ajustes del mapa ──────────────────────────────────────────────────────
  const [showTraffic,  setShowTraffic]  = useState(true);
  const [isSatellite,  setIsSatellite]  = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [mapTheme,     setMapTheme]     = useState<MapTheme>('auto');

  const effectiveDark =
    mapTheme === 'dark' ? true :
    mapTheme === 'light' ? false :
    isDark;

  // ── Índice de progreso (polilínea completada vs pendiente) ────────────────
  const routeProgressIdx = useMemo(() => {
    if (!isTracking || !driverPosition || routeWaypoints.length < 2) return 0;
    let minDist = Infinity, closest = 0;
    const { lat, lng } = driverPosition;
    for (let i = 0; i < routeWaypoints.length; i++) {
      const wp = routeWaypoints[i]!;
      const d = (wp.latitude - lat) ** 2 + (wp.longitude - lng) ** 2;
      if (d < minDist) { minDist = d; closest = i; }
    }
    return closest;
  }, [isTracking, driverPosition, routeWaypoints]);

  const {
    handleToggle,
    stopDialogVisible, stopDialogPct,
    handleDialogContinue, handleDialogPause, handleDialogCancel,
  } = useTrackingToggle({
    isTracking, startTracking, stopTracking, tenantId, setTripId,
    routeProgressIdx,
    totalWaypoints: routeWaypoints.length,
    setArrivalSuggested, setArrivalDismissed, setRouteStartRecorded,
    setIsPaused, setPausedPct,
  });

  // ── Drena pings offline al arrancar tracking ──────────────────────────────
  const { drainQueue } = usePingSync();
  useEffect(() => {
    if (isTracking) void drainQueue();
  }, [isTracking, drainQueue]);

  // ── Sheet: snap al cambiar estado de tracking o pausa ──────────────────────
  useEffect(() => {
    sheetRef.current?.snapToIndex(0);
  }, [isTracking, isPaused]);

  // ── Fit al mapa ───────────────────────────────────────────────────────────
  const handleMapReady = useCallback(() => {
    if (!mapRef.current || routeWaypoints.length < 2) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(routeWaypoints, {
        edgePadding: { top: 60, right: 40, bottom: 220, left: 40 },
        animated: true,
      });
    }, 300);
  }, [routeWaypoints]);

  // ── Cargar ruta del simulador dev (escribe en MMKV + estado) ─────────────
  // Aislado en un callback para no tener storage.set() mezclado en el JSX.
  const handleLoadDevRoute = useCallback((r: {
    id: string;
    waypoints: Array<{ lat: number; lng: number }>;
    stops: Array<{ name: string; lat: number; lng: number; order: number }>;
  }) => {
    sim.pause();
    sim.reset();
    storage.set(MMKV_KEYS.ACTIVE_ROUTE_ID, r.id);
    storage.set(MMKV_KEYS.ACTIVE_ROUTE_WAYPOINTS, JSON.stringify(r.waypoints));
    storage.set(MMKV_KEYS.ACTIVE_ROUTE_STOPS, JSON.stringify(r.stops));
    navFetchedRef.current = false;
    setNavVersion((v) => v + 1);
    setRouteWaypoints(r.waypoints.map((p) => ({ latitude: p.lat, longitude: p.lng })));
    setRouteStops(r.stops);
  }, [sim, navFetchedRef, setNavVersion, setRouteWaypoints, setRouteStops]);

  // ─── Render ──────────────────────────────────────────────────────────────
  if (!permLoading && !allRequiredGranted) {
    return (
      <PermissionsGateScreen
        permissions={permissions}
        loading={permLoading}
        onRequestAll={requestAll}
        onRefresh={refreshPerms}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ThemedStatusBar />

      <TrackingMap
        ref={mapRef}
        routeWaypoints={routeWaypoints}
        routeProgressIdx={routeProgressIdx}
        routeStops={routeStops}
        isTracking={isTracking}
        navToStartPath={navToStartPath}
        checkpointStatuses={checkpointStatuses}
        nextCheckpointId={nextCheckpoint?.id}
        driverPosition={driverPosition}
        driverHeading={driverHeading}
        showTraffic={showTraffic}
        isSatellite={isSatellite}
        effectiveDark={effectiveDark}
        onMapReady={handleMapReady}
      />

      {(settingsOpen || devPanelOpen) && (
        <TouchableWithoutFeedback
          onPress={() => { setSettingsOpen(false); setDevPanelOpen(false); }}
          accessibilityLabel="Cerrar panel"
        >
          <View style={styles.panelOverlay} />
        </TouchableWithoutFeedback>
      )}

      <MapSettingsPanel
        open={settingsOpen}
        showTraffic={showTraffic}
        isSatellite={isSatellite}
        mapTheme={mapTheme}
        onToggleOpen={() => { setSettingsOpen((v) => !v); setDevPanelOpen(false); }}
        onToggleTraffic={() => setShowTraffic((v) => !v)}
        onToggleSatellite={() => setIsSatellite((v) => !v)}
        onChangeTheme={setMapTheme}
      />

      <DevSimulatorPanel
        open={devPanelOpen}
        sim={sim}
        routeWaypointsCount={routeWaypoints.length}
        onToggleOpen={() => { setDevPanelOpen((v) => !v); setSettingsOpen(false); }}
        onLoadDevRoute={handleLoadDevRoute}
      />

      {isTracking && (
        <PanicFab
          holding={panicHolding}
          countdown={panicCountdown}
          animatedStyle={panicStyle}
          onPressIn={handlePanicPressIn}
          onPressOut={handlePanicPressOut}
        />
      )}

      {driverPosition && (
        <TouchableOpacity
          style={[
            styles.locationFab,
            {
              backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.75)',
              bottom: isTracking ? '17%' : (routeActive && !isPaused) ? '43%' : isPaused ? '30%' : 32,
            },
          ]}
          onPress={() => centerOnMe(driverPosition, driverHeading)}
          accessibilityLabel="Centrar en mi posicion"
          accessibilityRole="button"
        >
          <Ionicons
            name="locate-outline"
            size={20}
            color={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)'}
          />
        </TouchableOpacity>
      )}

      {isTracking && arrivalSuggested && (
        <ArrivalBanner
          routeName={routeName}
          onConfirm={() => void handleCompleteTrip()}
          onDismiss={() => setArrivalDismissed(true)}
        />
      )}

      {routeActive && (
        <TrackingBottomSheet
          ref={sheetRef}
          isTracking={isTracking}
          isPaused={isPaused}
          pausedPct={pausedPct}
          routeName={routeName}
          lastCoordinate={lastCoordinate}
          heading={heading}
          effectiveHeading={effectiveHeading}
          error={error}
          navToStartVisible={navToStartPath.length > 0}
          checkpointStatuses={checkpointStatuses}
          nextCheckpointId={nextCheckpoint?.id}
          mandatoryTotal={mandatoryTotal}
          mandatoryVisited={mandatoryVisited}
          reportedIncidents={reportedIncidents}
          onStart={() => void handleToggle()}
          onStop={() => void handleToggle()}
          onReportIncident={() => setIncidentModalVisible(true)}
          onSheetChange={handleSheetChange}
        />
      )}

      <StopTrackingDialog
        visible={stopDialogVisible}
        progressPct={stopDialogPct}
        onContinue={handleDialogContinue}
        onPause={() => void handleDialogPause()}
        onCancel={() => void handleDialogCancel()}
      />

      <ReportIncidentModal
        visible={incidentModalVisible}
        onClose={() => setIncidentModalVisible(false)}
        onReported={(inc) => {
          setReportedIncidents((prev) => [
            {
              code: inc.code,
              type: inc.type,
              severity: inc.severity,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            ...prev,
          ].slice(0, 10));
        }}
        tripId={tripId}
        vehicleId={vehicleId}
        lat={driverPosition?.lat}
        lng={driverPosition?.lng}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  panelOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 15,
  },
  locationFab: {
    position: 'absolute', right: 16,
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
});
