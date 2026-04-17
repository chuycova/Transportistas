// ─── App.tsx ──────────────────────────────────────────────────────────────────
// Entry point de la app ZonaZero Driver.
//
// IMPORTANTE: La importación de background-gps.task DEBE estar aquí,
// antes de que cualquier componente se monte. expo-task-manager requiere
// que la tarea esté registrada en el top-level del entry point.
//
// Stack completo:
//   GestureHandlerRootView   ← requerido por @react-navigation/stack
//     SafeAreaProvider       ← márgenes seguros iOS/Android
//       RootNavigator        ← Auth Stack | Driver Stack (según sesión Supabase)

import './src/features/tracking/tasks/background-gps.task'; // ← PRIMERO
import 'react-native-gesture-handler'; // ← SEGUNDO (requerido por react-navigation v7)

import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider } from './src/lib/ThemeContext';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <SafeAreaProvider>
          <RootNavigator />
        </SafeAreaProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
