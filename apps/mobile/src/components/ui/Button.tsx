// ─── Button.tsx ───────────────────────────────────────────────────────────────
// Botón reutilizable que sigue el design system de ZonaZero.

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';

type ButtonVariant = 'primary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  testID,
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={[styles.label, styles[`${variant}Label` as keyof typeof styles] as TextStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primary: {
    backgroundColor: '#6C63FF',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  danger: { backgroundColor: '#FF4444' },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2A2A3F',
  },
  disabled: { opacity: 0.5 },
  label: { fontWeight: '600', fontSize: 15, letterSpacing: 0.3 },
  primaryLabel: { color: '#FFFFFF' },
  dangerLabel: { color: '#FFFFFF' },
  ghostLabel: { color: '#8888AA' },
});
