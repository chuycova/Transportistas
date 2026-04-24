// ─── StopTrackingDialog.tsx ───────────────────────────────────────────────────
// Diálogo personalizado que reemplaza el Alert.alert nativo al presionar "Parar".
// Opciones: Pausar ruta · Cancelar ruta · Continuar (dismiss).

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/ThemeContext';

interface StopTrackingDialogProps {
  visible:    boolean;
  /** Porcentaje de progreso actual (0-100) */
  progressPct: number;
  onContinue: () => void;
  onPause:    () => void;
  onCancel:   () => void;
}

export function StopTrackingDialog({
  visible, progressPct, onContinue, onPause, onCancel,
}: StopTrackingDialogProps) {
  const { colors, isDark } = useTheme();
  const cardBg      = isDark ? '#1C1C2E' : '#FFFFFF';
  const borderColor = isDark ? '#FFFFFF10' : '#0000000A';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onContinue}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onContinue}
      >
        <View
          style={[styles.container, { backgroundColor: cardBg }]}
          onStartShouldSetResponder={() => true}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: isDark ? '#FFFFFF08' : '#0000000A' }]}>
              <Ionicons name="stop-circle-outline" size={28} color={colors.textSecondary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Detener seguimiento</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Llevas {progressPct}% del recorrido
            </Text>
          </View>

          {/* ── Progress bar ── */}
          <View style={[styles.progressBg, { backgroundColor: isDark ? '#FFFFFF12' : '#0000000D' }]}>
            <View style={[styles.progressFill, { width: `${progressPct}%` as `${number}%` }]} />
          </View>

          {/* ── Opción: Pausar ── */}
          <TouchableOpacity
            style={[styles.optionBtn, { borderColor: '#F59E0B40', backgroundColor: isDark ? '#F59E0B12' : '#FEF3C7' }]}
            onPress={onPause}
            activeOpacity={0.75}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="pause-circle-outline" size={22} color="#F59E0B" />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: '#F59E0B' }]}>Pausar ruta</Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                Guarda tu progreso y reanuda después
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
          </TouchableOpacity>

          {/* ── Opción: Cancelar ── */}
          <TouchableOpacity
            style={[styles.optionBtn, { borderColor: '#EF444440', backgroundColor: isDark ? '#EF444412' : '#FEF2F2' }]}
            onPress={onCancel}
            activeOpacity={0.75}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: '#EF4444' }]}>Cancelar ruta</Text>
              <Text style={[styles.optionDesc, { color: colors.textSecondary }]}>
                Descarta el viaje y borra el progreso
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#EF4444" />
          </TouchableOpacity>

          {/* ── Continuar ── */}
          <TouchableOpacity
            style={[styles.continueBtn, { backgroundColor: isDark ? '#FFFFFF08' : '#0000000A' }]}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <Text style={[styles.continueBtnText, { color: colors.textSecondary }]}>Continuar viaje</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    gap: 14,
  },

  // Header
  header: { alignItems: 'center', gap: 6, marginBottom: 4 },
  headerIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title:    { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center' },

  // Progress bar
  progressBg: {
    height: 6, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#F59E0B', borderRadius: 3,
  },

  // Option buttons
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1.5, padding: 16,
  },
  optionIcon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionDesc:  { fontSize: 12 },

  // Continue / dismiss
  continueBtn: {
    paddingVertical: 16, borderRadius: 16,
    alignItems: 'center', marginTop: 2,
  },
  continueBtnText: { fontSize: 15, fontWeight: '600' },
});
