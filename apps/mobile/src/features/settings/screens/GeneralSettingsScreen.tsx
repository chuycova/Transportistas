// ─── GeneralSettingsScreen.tsx ────────────────────────────────────────────────
// Pantalla de ajustes generales: apariencia, notificaciones y sobre la app.
// El tema oscuro/claro se persiste en MMKV y se aplica globalmente via ThemeContext.

import React from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@lib/ThemeContext';

// ─── Sub-componente: fila de ajuste ──────────────────────────────────────────
interface SettingRowProps {
  icon: string;
  label: string;
  description?: string;
  rightElement: React.ReactNode;
  isLast?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}

function SettingRow({ icon, label, description, rightElement, isLast, colors }: SettingRowProps) {
  return (
    <View style={[
      rowStyles.container,
      { borderBottomColor: colors.border },
      isLast && rowStyles.last,
    ]}>
      <View style={[rowStyles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
        <Text style={rowStyles.icon}>{icon}</Text>
      </View>
      <View style={rowStyles.info}>
        <Text style={[rowStyles.label, { color: colors.text }]}>{label}</Text>
        {description && (
          <Text style={[rowStyles.description, { color: colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>
      <View style={rowStyles.right}>{rightElement}</View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  last: { borderBottomWidth: 0 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  icon: { fontSize: 18 },
  info: { flex: 1 },
  label: { fontSize: 15, fontWeight: '500' },
  description: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  right: { flexShrink: 0 },
});

// ─── Pantalla ─────────────────────────────────────────────────────────────────
export function GeneralSettingsScreen() {
  const { isDark, colors, toggleTheme } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { backgroundColor: colors.bg }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Sección: Apariencia ── */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APARIENCIA</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon={isDark ? '🌙' : '☀️'}
            label="Tema oscuro"
            description={isDark ? 'Modo oscuro activado' : 'Modo claro activado'}
            colors={colors}
            isLast
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={colors.border}
              />
            }
          />
        </View>

        {/* ── Preview del tema ── */}
        <View style={[styles.themePreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.previewDots}>
            <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
            <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
            <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
          </View>
          <View style={styles.previewContent}>
            <View style={[styles.previewBar, { backgroundColor: colors.accent, width: '70%', opacity: 0.8 }]} />
            <View style={[styles.previewBar, { backgroundColor: colors.textMuted, width: '50%', marginTop: 8 }]} />
            <View style={[styles.previewBar, { backgroundColor: colors.textMuted, width: '60%', marginTop: 6 }]} />
          </View>
          <Text style={[styles.previewLabel, { color: colors.textSecondary }]}>
            {isDark ? 'Modo oscuro' : 'Modo claro'}
          </Text>
        </View>

        {/* ── Sección: Sobre la app ── */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>INFORMACIÓN</Text>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="📱"
            label="Versión"
            colors={colors}
            rightElement={
              <Text style={[styles.valueText, { color: colors.textSecondary }]}>1.0.0</Text>
            }
          />
          <SettingRow
            icon="🏗️"
            label="Entorno"
            colors={colors}
            rightElement={
              <View style={[styles.badge, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '44' }]}>
                <Text style={[styles.badgeText, { color: colors.accent }]}>
                  {__DEV__ ? 'Desarrollo' : 'Producción'}
                </Text>
              </View>
            }
          />
          <SettingRow
            icon="⚙️"
            label="Plataforma"
            colors={colors}
            isLast
            rightElement={
              <Text style={[styles.valueText, { color: colors.textSecondary }]}>
                {Platform.OS === 'ios' ? 'iOS' : 'Android'}
              </Text>
            }
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { padding: 20, paddingBottom: 48, gap: 0 },

  sectionTitle: {
    fontSize: 11, letterSpacing: 1.5,
    fontWeight: '700', marginBottom: 8, marginTop: 20,
  },

  section: {
    borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 4,
  },

  // ── Preview ──
  themePreview: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, marginTop: 12, marginBottom: 4,
    alignItems: 'center', gap: 12,
  },
  previewDots: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  previewContent: { width: '100%', gap: 0 },
  previewBar: { height: 10, borderRadius: 5 },
  previewLabel: { fontSize: 12, fontWeight: '600' },

  // ── Valores ──
  valueText: { fontSize: 14 },
  badge: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
