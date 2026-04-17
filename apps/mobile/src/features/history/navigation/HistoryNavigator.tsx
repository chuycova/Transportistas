// ─── HistoryNavigator.tsx ─────────────────────────────────────────────────────
// Stack navigator anidado dentro del tab "Historial".
// Rutas internas:
//   HistoryMain   → lista de rutas y alertas
//   RouteDetail   → detalle de una ruta + subida de evidencia
//   AlertDetail   → detalle de una alerta + subida de evidencia

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
  status: 'completed' | 'off_route';
};

export type HistoryStackParamList = {
  HistoryMain: undefined;
  RouteDetail: { route: HistoryRoute };
  AlertDetail: { alert: AlertHistoryItem };
};

const Stack = createNativeStackNavigator<HistoryStackParamList>();

const HEADER_OPTS = {
  headerStyle:       { backgroundColor: '#12121C' },
  headerTintColor:   '#FFFFFF',
  headerTitleStyle:  { fontWeight: '600' as const },
  headerShadowVisible: false,
  headerBackTitle:   'Volver',
} as const;

export function HistoryNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER_OPTS}>
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
