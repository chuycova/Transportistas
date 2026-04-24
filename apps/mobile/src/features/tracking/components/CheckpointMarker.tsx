import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';

interface CheckpointMarkerProps {
  id: string;
  name: string;
  orderIndex: number;
  lat: number;
  lng: number;
  isMandatory: boolean;
  visited: boolean;
  isNext: boolean;
}

export function CheckpointMarker({
  id, name, orderIndex, lat, lng, isMandatory, visited, isNext,
}: CheckpointMarkerProps) {
  const bgColor =
    visited ? '#10B981' :
    isNext ? '#F59E0B' :
    isMandatory ? '#6C63FF' : '#4A4A6A';
  const borderColor =
    visited ? '#10B98166' :
    isNext ? '#F59E0B99' : '#6C63FF66';

  return (
    <Marker
      key={`cp-${id}`}
      coordinate={{ latitude: lat, longitude: lng }}
      title={`${orderIndex}. ${name}`}
      description={visited ? 'Visitado ✓' : isMandatory ? 'Obligatorio' : 'Opcional'}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View style={[styles.badge, { backgroundColor: bgColor, borderColor }]}>
        {visited
          ? <Text style={styles.tick}>✓</Text>
          : <Text style={styles.num}>{orderIndex}</Text>
        }
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
  },
  num:  { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  tick: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
