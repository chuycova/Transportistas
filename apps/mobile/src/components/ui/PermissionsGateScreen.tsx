// ─── PermissionsGateScreen.tsx ────────────────────────────────────────────────
// Pantalla de guardia que muestra el estado de cada permiso necesario.

import React, { useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Linking, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@lib/ThemeContext';
import type { PermissionInfo } from '@lib/usePermissions';

interface Props {
  permissions: PermissionInfo[];
  loading: boolean;
  onRequestAll: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

function openSettings() {
  void Linking.openSettings();
}

function PermissionRow({ perm, onRequest, onOpenSettings }: {
  perm: PermissionInfo;
  onRequest: () => Promise<void>;
  onOpenSettings: () => void;
}) {
  const { colors } = useTheme();
  const isGranted = perm.status === 'granted';
  const isDenied  = perm.status === 'denied';

  return (
    <View style={[
      rowStyles.container,
      { backgroundColor: colors.surface, borderColor: colors.border },
      isGranted && { borderColor: '#10B98133', backgroundColor: '#10B98108' },
    ]}>
      <View style={[rowStyles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={rowStyles.icon}>{perm.icon}</Text>
      </View>

      <View style={rowStyles.info}>
        <View style={rowStyles.titleRow}>
          <Text style={[rowStyles.label, { color: colors.text }]}>{perm.label}</Text>
          {perm.required && (
            <View style={[rowStyles.requiredBadge, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
              <Text style={[rowStyles.requiredText, { color: colors.accent }]}>Requerido</Text>
            </View>
          )}
        </View>
        <Text style={[rowStyles.description, { color: colors.textSecondary }]}>{perm.description}</Text>
      </View>

      <View style={rowStyles.action}>
        {isGranted ? (
          <View style={rowStyles.checkBadge}>
            <Text style={rowStyles.checkIcon}>✓</Text>
          </View>
        ) : isDenied ? (
          <TouchableOpacity
            style={[rowStyles.settingsBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.borderLight }]}
            onPress={onOpenSettings}
          >
            <Text style={[rowStyles.settingsBtnText, { color: colors.textSecondary }]}>Ajustes</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[rowStyles.activateBtn, { backgroundColor: colors.accent }]}
            onPress={onRequest}
          >
            <Text style={rowStyles.activateBtnText}>Activar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: 20 },
  info: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '600' },
  requiredBadge: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  requiredText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  description: { fontSize: 12, lineHeight: 16 },
  action: { flexShrink: 0 },
  checkBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#10B98122', borderWidth: 1.5, borderColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { color: '#10B981', fontSize: 16, fontWeight: '700' },
  activateBtn: {
    borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  activateBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  settingsBtn: {
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1,
  },
  settingsBtnText: { fontSize: 12, fontWeight: '600' },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export function PermissionsGateScreen({ permissions, loading, onRequestAll, onRefresh }: Props) {
  const handleOpenSettings = useCallback(() => { openSettings(); }, []);
  const { colors } = useTheme();

  const allGranted = permissions
    .filter((p) => p.required)
    .every((p) => p.status === 'granted');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { backgroundColor: colors.bg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
            <Text style={styles.headerIconText}>🔐</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Permisos necesarios</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            ZonaZero necesita acceso a los siguientes servicios para funcionar correctamente.
            Los permisos requeridos son indispensables para iniciar una ruta.
          </Text>
        </View>

        {/* Lista de permisos */}
        <View style={styles.list}>
          {permissions.map((perm) => (
            <PermissionRow
              key={perm.key}
              perm={perm}
              onRequest={onRequestAll}
              onOpenSettings={handleOpenSettings}
            />
          ))}
        </View>

        {/* Nota Android bg */}
        {Platform.OS === 'android' && (
          <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.noteIcon}>ℹ️</Text>
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              En Android, el tracking en segundo plano funciona mediante un servicio en primer plano
              (notificación persistente). No requiere permiso adicional de ubicación.
            </Text>
          </View>
        )}

        {/* Botón principal */}
        {!allGranted && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.accent }, loading && styles.primaryBtnDisabled]}
            onPress={onRequestAll}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Conceder todos los permisos"
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.primaryBtnText}>Conceder permisos</Text>
            }
          </TouchableOpacity>
        )}

        {/* Botón refrescar */}
        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={onRefresh}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Actualizar estado de permisos"
        >
          <Text style={[styles.refreshBtnText, { color: colors.textSecondary }]}>
            {allGranted ? '✓ Todo listo — toca para continuar' : 'Ya los activé — actualizar'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { padding: 24, gap: 20, paddingBottom: 48 },

  header: { alignItems: 'center', gap: 12, paddingTop: 16 },
  headerIcon: {
    width: 72, height: 72, borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  headerIconText: { fontSize: 36 },
  title: {
    fontSize: 22, fontWeight: '800',
    textAlign: 'center', letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14, textAlign: 'center',
    lineHeight: 20, maxWidth: 320,
  },

  list: { gap: 10 },

  note: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    borderRadius: 12, padding: 14,
    borderWidth: 1,
  },
  noteIcon: { fontSize: 16 },
  noteText: { fontSize: 12, lineHeight: 18, flex: 1 },

  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  refreshBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1,
  },
  refreshBtnText: { fontSize: 13, fontWeight: '600' },
});
