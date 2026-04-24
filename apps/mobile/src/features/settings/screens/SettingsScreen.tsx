// ─── SettingsScreen.tsx ───────────────────────────────────────────────────────
// Ajustes del conductor: info de sesión y cierre de sesión.

import React, { useState } from 'react';
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
import { signOut } from '@lib/supabase';
import { useCurrentUser } from '@lib/useCurrentUser';
import { useTheme } from '@lib/ThemeContext';

type SettingsNavigationProp = NativeStackNavigationProp<any>;

export function SettingsScreen() {
  const user = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<SettingsNavigationProp>();
  const { colors } = useTheme();

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
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Perfil */}
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent + '22', borderColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>
            {user?.email?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileRole, { color: colors.accent }]}>Conductor</Text>
          <Text style={[styles.profileEmail, { color: colors.text }]} numberOfLines={1}>
            {user?.email ?? '—'}
          </Text>
        </View>
      </View>

      {/* Sección app */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Aplicación</Text>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.row, { borderColor: colors.border }]}>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Versión</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>1.0.0</Text>
        </View>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Entorno</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>Desarrollo</Text>
        </View>
      </View>

      {/* Mi perfil */}
      <TouchableOpacity
        style={[styles.profileBtn, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '44' }]}
        onPress={() => navigation.navigate('DriverProfile')}
        accessibilityLabel="Mi perfil"
        accessibilityRole="button"
      >
        <Text style={[styles.profileBtnText, { color: colors.accent }]}>Mi perfil · Documentos</Text>
      </TouchableOpacity>

      {/* Ajustes Generales */}
      <TouchableOpacity
        style={[styles.generalSettingsBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('GeneralSettings')}
        accessibilityLabel="Ajustes Generales"
        accessibilityRole="button"
      >
        <Text style={[styles.generalSettingsText, { color: colors.text }]}>Ajustes Generales</Text>
      </TouchableOpacity>

      {/* Cerrar sesión */}
      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.danger + '18', borderColor: colors.danger + '44' }]}
        onPress={handleLogout}
        disabled={loading}
        accessibilityLabel="Cerrar sesión"
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <Text style={[styles.logoutText, { color: colors.danger }]}>Cerrar sesión</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  profileCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1, gap: 2 },
  profileRole: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  profileEmail: { fontSize: 14 },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 32,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14 },
  logoutBtn: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
  },
  logoutText: { fontSize: 16, fontWeight: '600' },
  profileBtn: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 12,
  },
  profileBtnText: { fontSize: 16, fontWeight: '600' },
  generalSettingsBtn: {
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
  },
  generalSettingsText: { fontSize: 16, fontWeight: '600' },
});
