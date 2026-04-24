// ─── HistoryNavigator.tsx ─────────────────────────────────────────────────────
// Stack navigator anidado dentro del tab "Historial".
// Rutas internas:
//   HistoryMain   → lista de rutas y alertas
//   RouteDetail   → detalle de una ruta + subida de evidencia
//   AlertDetail   → detalle de una alerta + subida de evidencia

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@lib/ThemeContext';
import { HistoryScreen }      from '../screens/HistoryScreen';
import { RouteDetailScreen }  from '../screens/RouteDetailScreen';
import { AlertDetailScreen }  from '../screens/AlertDetailScreen';
import type { AlertHistoryItem } from '../hooks/useAlertHistory';

// ─── Tipos de parámetros ──────────────────────────────────────────────────────

export type HistoryRoute = {
  id: string;
  routeName: string;
  date: string;
  duration: string;
  distance: string;
  status: 'completed' | 'off_route' | 'cancelled';
  // Timestamps para desglose de tiempos
  started_at: string | null;
  route_started_at: string | null;
  route_completed_at: string | null;
  completed_at: string | null;
};

export type HistoryStackParamList = {
  HistoryMain: undefined;
  RouteDetail: { route: HistoryRoute };
  AlertDetail: { alert: AlertHistoryItem };
};

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export function HistoryNavigator() {
  const { colors } = useTheme();

  const headerOpts = {
    headerStyle:       { backgroundColor: colors.surface },
    headerTintColor:   colors.text,
    headerTitleStyle:  { fontWeight: '600' as const, color: colors.text },
    headerShadowVisible: false,
    headerBackTitle:   'Volver',
  } as const;

  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen
        name="HistoryMain"
        component={HistoryScreen}
        options={{ title: 'Historial' }}
      />
      <Stack.Screen
        name="RouteDetail"
        component={RouteDetailScreen}
        options={({ route }) => ({ title: route.params.route.routeName })}
      />
      <Stack.Screen
        name="AlertDetail"
        component={AlertDetailScreen}
        options={{ title: 'Detalle de alerta' }}
      />
    </Stack.Navigator>
  );
}
