// ─── ThemeContext.tsx ─────────────────────────────────────────────────────────
// Contexto global de tema (dark/light).
// Persiste la preferencia en MMKV para que sobreviva reinicios sin parpadeo.
// Consumir con el hook useTheme() en cualquier componente.

import React, { createContext, useContext, useState, useCallback } from 'react';
import { getBool, setBool } from '@lib/mmkv';

const THEME_KEY = 'app.isDarkTheme';

// ─── Paletas ──────────────────────────────────────────────────────────────────
export const darkColors = {
  bg:           '#0A0A0F',
  surface:      '#12121C',
  surfaceAlt:   '#1E1E2E',
  border:       '#2A2A3F',
  borderLight:  '#3A3A5C',
  text:         '#FFFFFF',
  textSecondary:'#8888AA',
  textMuted:    '#4A4A6A',
  accent:       '#6C63FF',
  accentAlt:    '#8B85FF',
  success:      '#10B981',
  warning:      '#F59E0B',
  danger:       '#EF4444',
} as const;

export const lightColors = {
  bg:           '#F5F5F7',
  surface:      '#FFFFFF',
  surfaceAlt:   '#EAEAEE',
  border:       '#DDDDE8',
  borderLight:  '#CBCBD8',
  text:         '#0A0A0F',
  textSecondary:'#5A5A7A',
  textMuted:    '#9A9AB0',
  accent:       '#6C63FF',
  accentAlt:    '#5A52EE',
  success:      '#059669',
  warning:      '#D97706',
  danger:       '#DC2626',
} as const;

export type AppColors = typeof darkColors;

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextValue {
  isDark: boolean;
  colors: AppColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  colors: darkColors,
  toggleTheme: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Leer preferencia guardada (default: dark)
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Si nunca se guardó nada, usa dark por defecto
    const stored = getBool(THEME_KEY);
    // getBool devuelve false si no existe — distinguimos con getString
    const hasKey = getBool(THEME_KEY + '_set');
    return hasKey ? stored : true;
  });

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      setBool(THEME_KEY, next);
      setBool(THEME_KEY + '_set', true);
      return next;
    });
  }, []);

  const colors: AppColors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
