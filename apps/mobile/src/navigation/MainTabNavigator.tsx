// ─── MainTabNavigator.tsx ─────────────────────────────────────────────────────
// Tab navigator principal para el conductor autenticado.
// Tabs: Rutas · Mapa · Historial · Ajustes

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/ThemeContext';
import { RoutesScreen } from '@features/routes/screens/RoutesScreen';
import { TrackingScreen } from '@features/tracking/screens/TrackingScreen';
import { TripsScreen } from '@features/trips/screens/TripsScreen';
import { HistoryNavigator } from '@features/history/navigation/HistoryNavigator';
import { SettingsScreen } from '@features/settings/screens/SettingsScreen';

export type MainTabParamList = {
  Routes: undefined;
  Trips: undefined;
  Map: undefined;
  History: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { focused: IoniconsName; unfocused: IoniconsName }> = {
  Routes:   { focused: 'map',             unfocused: 'map-outline' },
  Trips:    { focused: 'cube',            unfocused: 'cube-outline' },
  Map:      { focused: 'navigate',        unfocused: 'navigate-outline' },
  History:  { focused: 'time',            unfocused: 'time-outline' },
  Settings: { focused: 'settings',        unfocused: 'settings-outline' },
};

const TAB_LABELS: Record<string, string> = {
  Routes:   'Rutas',
  Trips:    'Viajes',
  Map:      'Mapa',
  History:  'Historial',
  Settings: 'Ajustes',
};

export function MainTabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' as const },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const, marginBottom: 2 },
        tabBarLabel: TAB_LABELS[route.name] ?? route.name,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const name = focused ? icons?.focused : icons?.unfocused;
          return <Ionicons name={name ?? 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Routes"
        component={RoutesScreen}
        options={{ title: 'Rutas asignadas' }}
      />
      <Tab.Screen
        name="Trips"
        component={TripsScreen}
        options={{ title: 'Mis viajes' }}
      />
      <Tab.Screen
        name="Map"
        component={TrackingScreen}
        options={{ title: 'Mapa', headerShown: false }}
      />
      <Tab.Screen
        name="History"
        component={HistoryNavigator}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Ajustes' }}
      />
    </Tab.Navigator>
  );
}
