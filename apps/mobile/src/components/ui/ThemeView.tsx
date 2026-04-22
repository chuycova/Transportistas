// ─── ThemeView.tsx ─────────────────────────────────────────────────────────────
// Wrapper de View que aplica automáticamente el color de fondo del tema actual.
// variant:
//   'bg'         → colors.bg         (fondo de página)
//   'surface'    → colors.surface    (tarjetas/cards)  [default]
//   'surfaceAlt' → colors.surfaceAlt (secciones alternas)

import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '@lib/ThemeContext';

type Variant = 'bg' | 'surface' | 'surfaceAlt' | 'none';

interface ThemeViewProps extends ViewProps {
  variant?: Variant;
}

export function ThemeView({ variant = 'bg', style, ...rest }: ThemeViewProps) {
  const { colors } = useTheme();

  const bg =
    variant === 'none'       ? undefined :
    variant === 'surface'    ? colors.surface :
    variant === 'surfaceAlt' ? colors.surfaceAlt :
                               colors.bg;

  return <View style={[bg ? { backgroundColor: bg } : undefined, style]} {...rest} />;
}
