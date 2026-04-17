// ─── SettingsScreen.tsx ───────────────────────────────────────────────────────
// Ajustes del conductor: info de sesión y cierre de sesión.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { signOut, supabase } from '@lib/supabase';
import type { User } from '@supabase/supabase-js';

type SettingsNavigationProp = NativeStackNavigationProp<any>;

export function SettingsScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<SettingsNavigationProp>();

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await signOut();
            // RootNavigator detecta el cambio de sesión y redirige a Login automáticamente
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Perfil */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileRole}>Conductor</Text>
          <Text style={styles.profileEmail} numberOfLines={1}>
            {user?.email ?? '—'}
          </Text>
        </View>
      </View>

      {/* Sección app */}
      <Text style={styles.sectionTitle}>Aplicación</Text>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Versión</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowLabel}>Entorno</Text>
          <Text style={styles.rowValue}>Desarrollo</Text>
        </View>
      </View>

      {/* Mi perfil */}
      <TouchableOpacity
        style={styles.profileBtn}
        onPress={() => navigation.navigate('DriverProfile')}
        accessibilityLabel="Mi perfil"
        accessibilityRole="button"
      >
        <Text style={styles.profileBtnText}>Mi perfil · Documentos</Text>
      </TouchableOpacity>

      {/* Ajustes Generales */}
      <TouchableOpacity
        style={styles.generalSettingsBtn}
        onPress={() => navigation.navigate('GeneralSettings')}
        accessibilityLabel="Ajustes Generales"
        accessibilityRole="button"
      >
        <Text style={styles.generalSettingsText}>Ajustes Generales</Text>
      </TouchableOpacity>

      {/* Cerrar sesión */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={handleLogout}
        disabled={loading}
        accessibilityLabel="Cerrar sesión"
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color="#FF4444" />
        ) : (
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  profileCard: {
    backgroundColor: '#12121C',
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#2A2A3F',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6C63FF22',
    borderWidth: 1,
    borderColor: '#6C63FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#6C63FF', fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1, gap: 2 },
  profileRole: { color: '#6C63FF', fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  profileEmail: { color: '#FFFFFF', fontSize: 14 },
  sectionTitle: {
    color: '#8888AA',
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#12121C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    marginBottom: 32,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#2A2A3F',
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: '#8888AA', fontSize: 14 },
  rowValue: { color: '#FFFFFF', fontSize: 14 },
  logoutBtn: {
    backgroundColor: '#FF444422',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF444444',
  },
  logoutText: { color: '#FF4444', fontSize: 16, fontWeight: '600' },
  profileBtn: {
    backgroundColor: '#6C63FF22',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6C63FF44',
    marginBottom: 12,
  },
  profileBtnText: { color: '#6C63FF', fontSize: 16, fontWeight: '600' },
  generalSettingsBtn: {
    backgroundColor: '#12121C',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3F',
    marginBottom: 16,
  },
  generalSettingsText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
