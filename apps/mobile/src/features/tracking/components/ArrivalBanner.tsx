import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/ThemeContext';

interface ArrivalBannerProps {
  routeName: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function ArrivalBanner({ routeName, onConfirm, onDismiss }: ArrivalBannerProps) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: isDark ? 'rgba(20,20,35,0.97)' : 'rgba(255,255,255,0.97)' },
      ]}
    >
      <View style={styles.icon}>
        <Ionicons name="flag" size={22} color="#22C55E" />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>Llegaste a tu destino</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
          {routeName}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
          onPress={onConfirm}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmText}>Finalizar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Text style={[styles.dismissText, { color: colors.textSecondary }]}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16, right: 16,
    bottom: '20%',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#22C55E18',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '700' },
  sub:   { fontSize: 13 },
  actions: { alignItems: 'center', gap: 6 },
  confirmBtn: {
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  confirmText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dismissText: { fontSize: 12, fontWeight: '500' },
});
