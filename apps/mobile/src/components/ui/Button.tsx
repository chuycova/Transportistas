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
import { useTheme } from '@lib/ThemeContext';

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
  const { colors } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary': return {
        backgroundColor: colors.accent,
        shadowColor: colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
      };
      case 'danger': return { backgroundColor: colors.danger };
      case 'ghost': return {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border,
      };
    }
  };

  const getLabelColor = (): string => {
    switch (variant) {
      case 'primary': return '#FFFFFF';
      case 'danger':  return '#FFFFFF';
      case 'ghost':   return colors.textSecondary;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.base, getVariantStyle(), (disabled || loading) && styles.disabled, style]}
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
        <Text style={[styles.label, { color: getLabelColor() } as TextStyle]}>
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
  disabled: { opacity: 0.5 },
  label: { fontWeight: '600', fontSize: 15, letterSpacing: 0.3 },
});
