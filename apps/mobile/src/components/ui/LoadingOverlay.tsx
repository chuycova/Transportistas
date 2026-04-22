// ─── LoadingOverlay.tsx ───────────────────────────────────────────────────────
// Overlay de carga semi-transparente para operaciones bloqueantes.

import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Modal } from 'react-native';
import { useTheme } from '@lib/ThemeContext';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message = 'Cargando...' }: LoadingOverlayProps) {
  const { colors, isDark } = useTheme();
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(10,10,15,0.85)' : 'rgba(0,0,0,0.4)' }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    minWidth: 200,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
  },
});
