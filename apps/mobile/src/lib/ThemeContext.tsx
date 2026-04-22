// ─── ThemeContext.tsx ─────────────────────────────────────────────────────────
// Contexto global de tema (dark/light).
// Persiste la preferencia en MMKV para que sobreviva reinicios sin parpadeo.
// Consumir con el hook useTheme() en cualquier componente.

import React, { createContext, useContext, useState, useCallback } from 'react';
import { DefaultTheme } from '@react-navigation/native';
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

// Light palette inspired by the web app (shadcn/Tailwind light mode):
//   bg = soft blue-gray page, surface = white cards, text = near-black navy
export const lightColors = {
  bg:           '#F4F6FB',
  surface:      '#FFFFFF',
  surfaceAlt:   '#EEF0F7',
  border:       '#D8DDE8',
  borderLight:  '#C5CCE0',
  text:         '#0F1117',
  textSecondary:'#4A5568',
  textMuted:    '#8A96AE',
  accent:       '#6C63FF',
  accentAlt:    '#5A52EE',
  success:      '#059669',
  warning:      '#D97706',
  danger:       '#DC2626',
} as const;

export type AppColors = typeof darkColors;

// ─── Google Maps styles ───────────────────────────────────────────────────────
export const darkMapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#0A0A0F' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#8888AA' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0F' }] },
  { featureType: 'road',               elementType: 'geometry', stylers: [{ color: '#1C1C2E' }] },
  { featureType: 'road.arterial',      elementType: 'geometry', stylers: [{ color: '#2A2A3F' }] },
  { featureType: 'road.highway',       elementType: 'geometry', stylers: [{ color: '#3A3A5C' }] },
  { featureType: 'water',              elementType: 'geometry', stylers: [{ color: '#060610' }] },
  { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
];

// Light mode: minimal style — suppress clutter, use default Google Maps look
export const lightMapStyle = [
  { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

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
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = getBool(THEME_KEY);
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

// ─── React Navigation theme helper ───────────────────────────────────────────
export function useNavigationTheme() {
  const { isDark, colors } = useTheme();
  return {
    ...DefaultTheme,          // ← ensures fonts.regular / fonts.medium etc. are present
    dark: isDark,
    colors: {
      ...DefaultTheme.colors, // ← safe baseline so no key is ever undefined
      primary:      colors.accent,
      background:   colors.bg,
      card:         colors.surface,
      text:         colors.text,
      border:       colors.border,
      notification: colors.danger,
    },
  };
}
