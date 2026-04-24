// Marcador del conductor (Waze-style). Siempre muestra la flecha direccional.
// La rotación con el heading la controla el prop `rotation` del <Marker> padre.

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export function DriverMarker() {
  return (
    <View style={styles.arrowWrapper}>
      <View style={styles.halo} />
      <View style={styles.tip} />
      <View style={styles.body} />
    </View>
  );
}

const styles = StyleSheet.create({
  arrowWrapper: {
    width: 32, height: 44, alignItems: 'center',
    overflow: Platform.OS === 'android' ? 'visible' : 'visible',
  },
  halo: {
    position: 'absolute',
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#6C63FF33', top: 8,
  },
  tip: {
    width: 0, height: 0,
    borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 22,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#6C63FF',
  },
  body: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#6C63FF', borderWidth: 2, borderColor: '#fff',
    marginTop: -5,
  },
});
