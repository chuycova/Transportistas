// ─── ThemeText.tsx ─────────────────────────────────────────────────────────────
// Wrapper de Text que aplica automáticamente el color de texto del tema actual.
// variant:
//   'primary'   → colors.text           [default]
//   'secondary' → colors.textSecondary
//   'muted'     → colors.textMuted
//   'accent'    → colors.accent

import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useTheme } from '@lib/ThemeContext';

type Variant = 'primary' | 'secondary' | 'muted' | 'accent';

interface ThemeTextProps extends TextProps {
  variant?: Variant;
}

export function ThemeText({ variant = 'primary', style, ...rest }: ThemeTextProps) {
  const { colors } = useTheme();

  const color =
    variant === 'secondary' ? colors.textSecondary :
    variant === 'muted'     ? colors.textMuted :
    variant === 'accent'    ? colors.accent :
                              colors.text;

  return <Text style={[{ color }, style]} {...rest} />;
}
