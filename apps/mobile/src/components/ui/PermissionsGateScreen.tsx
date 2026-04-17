// ─── PermissionsGateScreen.tsx ────────────────────────────────────────────────
// Pantalla de guardia que muestra el estado de cada permiso necesario y guía
// al usuario para activarlos. Se muestra en lugar del contenido normal si
// algún permiso REQUERIDO no está concedido.

import React, { useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Linking, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const isGranted = perm.status === 'granted';
  const isDenied  = perm.status === 'denied';

  return (
    <View style={[rowStyles.container, isGranted && rowStyles.containerGranted]}>
      <View style={rowStyles.iconWrap}>
        <Text style={rowStyles.icon}>{perm.icon}</Text>
      </View>

      <View style={rowStyles.info}>
        <View style={rowStyles.titleRow}>
          <Text style={rowStyles.label}>{perm.label}</Text>
          {perm.required && (
            <View style={rowStyles.requiredBadge}>
              <Text style={rowStyles.requiredText}>Requerido</Text>
            </View>
          )}
        </View>
        <Text style={rowStyles.description}>{perm.description}</Text>
      </View>

      <View style={rowStyles.action}>
        {isGranted ? (
          <View style={rowStyles.checkBadge}>
            <Text style={rowStyles.checkIcon}>✓</Text>
          </View>
        ) : isDenied ? (
          <TouchableOpacity style={rowStyles.settingsBtn} onPress={onOpenSettings}>
            <Text style={rowStyles.settingsBtnText}>Ajustes</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={rowStyles.activateBtn} onPress={onRequest}>
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
    backgroundColor: '#12121C',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2A2A3F',
  },
  containerGranted: {
    borderColor: '#10B98133',
    backgroundColor: '#10B98108',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#1E1E2E',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: 20 },
  info: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  requiredBadge: {
    backgroundColor: '#6C63FF22',
    borderRadius: 20, borderWidth: 1, borderColor: '#6C63FF44',
    paddingHorizontal: 7, paddingVertical: 2,
  },
  requiredText: { color: '#6C63FF', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  description: { color: '#6A6A8A', fontSize: 12, lineHeight: 16 },
  action: { flexShrink: 0 },
  checkBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#10B98122', borderWidth: 1.5, borderColor: '#10B981',
    alignItems: 'center', justifyContent: 'center',
  },
  checkIcon: { color: '#10B981', fontSize: 16, fontWeight: '700' },
  activateBtn: {
    backgroundColor: '#6C63FF', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  activateBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  settingsBtn: {
    backgroundColor: '#2A2A3F', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#3A3A5C',
  },
  settingsBtnText: { color: '#AAAACC', fontSize: 12, fontWeight: '600' },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export function PermissionsGateScreen({ permissions, loading, onRequestAll, onRefresh }: Props) {
  const handleOpenSettings = useCallback(() => { openSettings(); }, []);

  const allGranted = permissions
    .filter((p) => p.required)
    .every((p) => p.status === 'granted');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>🔐</Text>
          </View>
          <Text style={styles.title}>Permisos necesarios</Text>
          <Text style={styles.subtitle}>
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
          <View style={styles.note}>
            <Text style={styles.noteIcon}>ℹ️</Text>
            <Text style={styles.noteText}>
              En Android, el tracking en segundo plano funciona mediante un servicio en primer plano
              (notificación persistente). No requiere permiso adicional de ubicación.
            </Text>
          </View>
        )}

        {/* Botón principal */}
        {!allGranted && (
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
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

        {/* Botón refrescar (para cuando el usuario viene de Ajustes) */}
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Actualizar estado de permisos"
        >
          <Text style={styles.refreshBtnText}>
            {allGranted ? '✓ Todo listo — toca para continuar' : 'Ya los activé — actualizar'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { padding: 24, gap: 20, paddingBottom: 48 },

  header: { alignItems: 'center', gap: 12, paddingTop: 16 },
  headerIcon: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: '#6C63FF22',
    borderWidth: 1.5, borderColor: '#6C63FF44',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  headerIconText: { fontSize: 36 },
  title: {
    color: '#FFFFFF', fontSize: 22, fontWeight: '800',
    textAlign: 'center', letterSpacing: -0.3,
  },
  subtitle: {
    color: '#6A6A8A', fontSize: 14, textAlign: 'center',
    lineHeight: 20, maxWidth: 320,
  },

  list: { gap: 10 },

  note: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: '#12121C', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#2A2A3F',
  },
  noteIcon: { fontSize: 16 },
  noteText: { color: '#6A6A8A', fontSize: 12, lineHeight: 18, flex: 1 },

  primaryBtn: {
    backgroundColor: '#6C63FF', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 8,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  refreshBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A3F',
    backgroundColor: '#12121C',
  },
  refreshBtnText: { color: '#8888AA', fontSize: 13, fontWeight: '600' },
});
