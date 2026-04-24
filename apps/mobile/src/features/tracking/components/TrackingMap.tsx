import React, { forwardRef, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Region, LatLng } from 'react-native-maps';
import { darkMapStyle, lightMapStyle } from '@lib/ThemeContext';
import { DriverMarker } from './DriverMarker';
import { CheckpointMarker } from './CheckpointMarker';

const DEFAULT_REGION: Region = {
  latitude: 20.6597, longitude: -103.3496,
  latitudeDelta: 0.05, longitudeDelta: 0.05,
};

interface CheckpointStatus {
  checkpoint: {
    id: string;
    name: string;
    order_index: number;
    lat: number;
    lng: number;
    is_mandatory: boolean;
  };
  visited: boolean;
}

interface TrackingMapProps {
  routeWaypoints: LatLng[];
  routeProgressIdx: number;
  routeStops: Array<{ name: string; lat: number; lng: number; order: number }>;
  isTracking: boolean;
  navToStartPath: LatLng[];
  checkpointStatuses: CheckpointStatus[];
  nextCheckpointId: string | undefined;
  driverPosition: { lat: number; lng: number } | null;
  driverHeading: number | null;
  showTraffic: boolean;
  isSatellite: boolean;
  effectiveDark: boolean;
  onMapReady: () => void;
}

export const TrackingMap = forwardRef<MapView, TrackingMapProps>(function TrackingMap(
  {
    routeWaypoints, routeProgressIdx, routeStops, isTracking, navToStartPath,
    checkpointStatuses, nextCheckpointId, driverPosition, driverHeading,
    showTraffic, isSatellite, effectiveDark, onMapReady,
  },
  ref,
) {
  // tracksViewChanges: true en el primer render del marker para que la vista
  // personalizada se capture; false después para evitar redraws constantes.
  const [driverMarkerReady, setDriverMarkerReady] = useState(false);
  useEffect(() => { if (driverPosition) setDriverMarkerReady(false); }, [!!driverPosition]);

  return (
    <MapView
      ref={ref}
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      initialRegion={DEFAULT_REGION}
      onMapReady={onMapReady}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsTraffic={showTraffic && !isSatellite}
      showsBuildings={false}
      mapType={isSatellite ? 'satellite' : 'standard'}
      customMapStyle={isSatellite ? [] : (effectiveDark ? darkMapStyle : lightMapStyle)}
    >
      {/* Tramo completado (verde) */}
      {isTracking && routeProgressIdx > 0 && routeWaypoints.length >= 2 && (
        <Polyline
          coordinates={routeWaypoints.slice(0, routeProgressIdx + 1)}
          strokeColor="#22C55E"
          strokeWidth={6}
          zIndex={2}
        />
      )}
      {/* Tramo pendiente (morado) */}
      {routeWaypoints.length >= 2 && (
        <Polyline
          coordinates={isTracking ? routeWaypoints.slice(routeProgressIdx) : routeWaypoints}
          strokeColor="#6C63FF"
          strokeWidth={5}
          zIndex={1}
        />
      )}
      {/* Nav al inicio: outline oscuro para contraste con tráfico */}
      {navToStartPath.length >= 2 && (
        <Polyline
          coordinates={navToStartPath}
          strokeColor="rgba(0,0,0,0.5)"
          strokeWidth={7}
          lineDashPattern={[12, 8]}
          zIndex={0}
        />
      )}
      {/* Nav al inicio: línea punteada cyan */}
      {navToStartPath.length >= 2 && (
        <Polyline
          coordinates={navToStartPath}
          strokeColor="#38BDF8"
          strokeWidth={4}
          lineDashPattern={[12, 8]}
          zIndex={1}
        />
      )}
      {routeWaypoints.length > 0 && (
        <Marker coordinate={routeWaypoints[0]!} title="Inicio de ruta" pinColor="#22C55E" />
      )}
      {routeWaypoints.length > 1 && (
        <Marker coordinate={routeWaypoints[routeWaypoints.length - 1]!} title="Destino" pinColor="#EF4444" />
      )}
      {routeStops.map((stop, i) => (
        <Marker
          key={`stop-${i}`}
          coordinate={{ latitude: stop.lat, longitude: stop.lng }}
          title={`${stop.order}. ${stop.name}`}
          pinColor="#F59E0B"
        />
      ))}
      {checkpointStatuses.map(({ checkpoint: cp, visited }) => (
        <CheckpointMarker
          key={`cp-${cp.id}`}
          id={cp.id}
          name={cp.name}
          orderIndex={cp.order_index}
          lat={cp.lat}
          lng={cp.lng}
          isMandatory={cp.is_mandatory}
          visited={visited}
          isNext={nextCheckpointId === cp.id}
        />
      ))}
      {driverPosition ? (
        <Marker
          coordinate={{ latitude: driverPosition.lat, longitude: driverPosition.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          flat
          rotation={driverHeading ?? 0}
          zIndex={10}
          tracksViewChanges={!driverMarkerReady}
          onLayout={() => setDriverMarkerReady(true)}
        >
          <DriverMarker />
        </Marker>
      ) : null}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: { flex: 1 },
});
