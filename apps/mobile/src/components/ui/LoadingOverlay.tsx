// ─── LoadingOverlay.tsx ───────────────────────────────────────────────────────
// Overlay de carga semi-transparente para operaciones bloqueantes.

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Modal } from 'react-native';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message = 'Cargando...' }: LoadingOverlayProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,15,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#12121C',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    minWidth: 200,
  },
  message: {
    color: '#8888AA',
    fontSize: 14,
    textAlign: 'center',
  },
});
