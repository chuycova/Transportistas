// ─── ThemedStatusBar.tsx ────────────────────────────────────────────────────────
// StatusBar que responde automáticamente al tema: 'light' en dark mode,
// 'dark' en light mode (para que los íconos del OS sean legibles).

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@lib/ThemeContext';

export function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
