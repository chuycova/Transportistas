// ─── RootNavigator.tsx ────────────────────────────────────────────────────────
// Navigator raíz. Escucha cambios de sesión de Supabase y decide
// qué stack mostrar: Auth (Login) o Driver (MainTabs → Tracking).
//
// Estructura:
//   RootStack
//   ├── MainTabs   (tab navigator con Rutas / Mapa / Historial / Ajustes)
//   └── Tracking   (pantalla full-screen empujada desde la tab de Rutas)

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@lib/supabase';
import { LoginScreen } from '@features/auth/screens/LoginScreen';
import { GeneralSettingsScreen } from '@features/settings/screens/GeneralSettingsScreen';
import { ProfileScreen } from '@features/profile/screens/ProfileScreen';
import { MainTabNavigator } from './MainTabNavigator';

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  GeneralSettings: undefined;
  DriverProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        // Refresh token inválido o expirado — limpiar sesión y mostrar Login
        void supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setSession(session);
      }
      // INITIAL_SESSION con error ya lo maneja getSession arriba
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            <Stack.Screen
              name="GeneralSettings"
              component={GeneralSettingsScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#12121C' },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: { fontWeight: '600', color: '#FFFFFF' },
                headerShadowVisible: false,
                title: 'Ajustes Generales',
                headerBackTitle: 'Volver',
              }}
            />
            <Stack.Screen
              name="DriverProfile"
              component={ProfileScreen}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: '#12121C' },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: { fontWeight: '600' },
                headerShadowVisible: false,
                title: 'Mi perfil',
                headerBackTitle: 'Ajustes',
              }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
