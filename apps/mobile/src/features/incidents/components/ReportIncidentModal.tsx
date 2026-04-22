// ─── features/incidents/components/ReportIncidentModal.tsx ───────────────────
// Modal para reportar un incidente desde la pantalla de tracking.
// Diseño moderno y minimalista con iconos SVG (Ionicons).

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Image, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@lib/ThemeContext';
import { useReportIncident, type IncidentType, type IncidentSeverity } from '../hooks/useReportIncident';

// ─── Datos ───────────────────────────────────────────────────────────────────
const TYPE_OPTIONS: Array<{
  value: IncidentType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'mechanical',      label: 'Mecánico',  icon: 'construct-outline' },
  { value: 'route_deviation', label: 'Desvío',    icon: 'git-branch-outline' },
  { value: 'accident',        label: 'Accidente', icon: 'warning-outline' },
  { value: 'weather',         label: 'Clima',     icon: 'thunderstorm-outline' },
  { value: 'cargo',           label: 'Carga',     icon: 'cube-outline' },
  { value: 'other',           label: 'Otro',      icon: 'ellipsis-horizontal-outline' },
];

const SEVERITY_OPTIONS: Array<{
  value: IncidentSeverity;
  label: string;
  color: string;
}> = [
  { value: 'low',      label: 'Bajo',    color: '#10B981' },
  { value: 'medium',   label: 'Medio',   color: '#F59E0B' },
  { value: 'high',     label: 'Alto',    color: '#F97316' },
  { value: 'critical', label: 'Crítico', color: '#EF4444' },
];

// ─── Props ───────────────────────────────────────────────────────────────────
interface ReportIncidentModalProps {
  visible:     boolean;
  onClose:     () => void;
  onReported?: (incident: { code: string; type: IncidentType; severity: IncidentSeverity }) => void;
  tripId?:     string;
  vehicleId?:  string;
  lat?:        number;
  lng?:        number;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export function ReportIncidentModal({
  visible, onClose, onReported, tripId, vehicleId, lat, lng,
}: ReportIncidentModalProps) {
  const [type,        setType]        = useState<IncidentType>('other');
  const [severity,    setSeverity]    = useState<IncidentSeverity>('medium');
  const [description, setDescription] = useState('');
  const [images,      setImages]      = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { report, uploading, error } = useReportIncident();

  const reset = useCallback(() => {
    setType('other');
    setSeverity('medium');
    setDescription('');
    setImages([]);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const pickImage = useCallback(async (source: 'camera' | 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permiso requerido',
        source === 'camera'
          ? 'Activa el acceso a la cámara en Ajustes.'
          : 'Activa el acceso a la galería en Ajustes.',
      );
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.75, base64: true, allowsEditing: false, exif: false })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.75, base64: true,
          allowsMultipleSelection: true, selectionLimit: 5,
        });

    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, 5));
    }
  }, []);

  const handleAddImage = useCallback(() => {
    setActionSheetVisible(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    const result = await report({
      tripId, vehicleId, type, severity,
      description: description.trim() || undefined,
      lat, lng, images,
    });

    if (result) {
      onReported?.({ code: result.code, type, severity });
      Alert.alert(
        'Incidente reportado',
        `Código: ${result.code}\n\nEl equipo de control fue notificado.`,
        [{ text: 'OK', onPress: handleClose }],
      );
    }
  }, [report, tripId, vehicleId, type, severity, description, lat, lng, images, handleClose, onReported]);

  // ─── Render ──────────────────────────────────────────────────────────────

  const cardBg = isDark ? '#1C1C2E' : '#F6F8FA';
  const borderColor = isDark ? '#FFFFFF10' : '#0000000A';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Reportar incidente</Text>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.headerCloseBtn, { backgroundColor: cardBg }]}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Scrollable content: KAV sólo envuelve el scroll, el footer no se mueve ── */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // iOS: ajusta insets del scroll nativo sin mover el footer
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {/* ── Tipo ── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Tipo de incidente</Text>
          <View style={styles.typeGrid}>
            {TYPE_OPTIONS.map((opt) => {
              const active = type === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.typeBtn,
                    { backgroundColor: cardBg, borderColor: 'transparent' },
                    active && { backgroundColor: colors.accent + '15', borderColor: colors.accent + '40' },
                  ]}
                  onPress={() => setType(opt.value)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={active ? colors.accent : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      { color: active ? colors.accent : colors.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Gravedad ── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Gravedad</Text>
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((opt) => {
              const active = severity === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.severityBtn,
                    { backgroundColor: cardBg },
                    active && { backgroundColor: opt.color },
                  ]}
                  onPress={() => setSeverity(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.severityLabel, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Descripcion ── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Descripción <Text style={{ fontWeight: '400', opacity: 0.5 }}>(opcional)</Text>
          </Text>
          <TextInput
            style={[styles.textarea, {
              backgroundColor: cardBg,
              color: colors.text,
            }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe brevemente lo ocurrido..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          {/* ── Imagenes ── */}
          <View style={styles.imgHeader}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 0 }]}>
              Evidencias
            </Text>
            <Text style={[styles.imgCounter, { color: colors.textMuted }]}>{images.length}/5</Text>
          </View>

          {images.length === 0 ? (
            <TouchableOpacity
              style={[
                styles.imgEmpty,
                { backgroundColor: colors.accent + '08', borderColor: colors.accent + '30' }
              ]}
              onPress={handleAddImage}
              activeOpacity={0.7}
            >
              <View style={[styles.imgEmptyIconWrapper, { backgroundColor: colors.accent + '1A' }]}>
                <Ionicons name="camera" size={26} color={colors.accent} />
              </View>
              <View style={styles.imgEmptyTextContainer}>
                <Text style={[styles.imgEmptyTitle, { color: colors.accent }]}>Añadir fotografías</Text>
                <Text style={[styles.imgEmptySub, { color: colors.textMuted }]}>Sube hasta 5 imágenes como evidencia</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgRow} contentContainerStyle={styles.imgRowContent}>
              {images.map((img, i) => (
                <View key={img.uri} style={styles.imgThumb}>
                  <Image source={{ uri: img.uri }} style={styles.imgPreview} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.imgRemove}
                    onPress={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Ionicons name="close" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity
                  style={[styles.imgAddThumb, { backgroundColor: cardBg, borderColor }]}
                  onPress={handleAddImage}
                >
                  <Ionicons name="add" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
        </KeyboardAvoidingView>

        {/* ── Footer: fuera del KAV para que nunca rebote ── */}
        <View style={[styles.footer, {
          borderTopColor: isDark ? '#ffffff08' : '#00000008',
          paddingBottom: Math.max(insets.bottom, 16),
        }]}>
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.accent }, uploading && styles.submitBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.submitInner}>
                <Text style={styles.submitText}>Enviar Reporte</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Opciones de Imagen (Action Sheet) ── */}
      <Modal
        visible={actionSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => setActionSheetVisible(false)}
        >
          <View style={[styles.actionSheetContainer, { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.actionSheetHeader}>
              <Text style={[styles.actionSheetTitle, { color: colors.text }]}>Adjuntar evidencia</Text>
              <Text style={[styles.actionSheetSub, { color: colors.textSecondary }]}>Selecciona de dónde quieres subir la foto</Text>
            </View>

            <TouchableOpacity
              style={[styles.actionBtn, { borderBottomColor: borderColor }]}
              onPress={() => { setActionSheetVisible(false); void pickImage('camera'); }}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconWrapper, { backgroundColor: colors.accent + '15' }]}>
                <Ionicons name="camera" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Tomar foto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { borderBottomColor: 'transparent' }]}
              onPress={() => { setActionSheetVisible(false); void pickImage('library'); }}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconWrapper, { backgroundColor: colors.accent + '15' }]}>
                <Ionicons name="images" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.actionBtnText, { color: colors.text }]}>Elegir de galería</Text>
            </TouchableOpacity>

            <View style={styles.actionSheetFooter}>
              <TouchableOpacity
                style={[styles.actionCancelBtn, { backgroundColor: cardBg }]}
                onPress={() => setActionSheetVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.actionCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },

  // Body
  body: { paddingHorizontal: 24, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 14, fontWeight: '600',
    marginTop: 24, marginBottom: 12,
  },

  // Type grid
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeBtn: {
    flexBasis: '30%', flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 16, gap: 8,
    borderRadius: 16, borderWidth: 1,
  },
  typeLabel: { fontSize: 13, fontWeight: '500' },

  // Severity
  severityRow: { flexDirection: 'row', gap: 10 },
  severityBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
  },
  severityLabel: { fontSize: 14, fontWeight: '600' },

  // Textarea
  textarea: {
    borderRadius: 16,
    padding: 16, fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Images
  imgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imgCounter: { fontSize: 14, fontWeight: '500', marginTop: 12 },
  imgEmpty: {
    paddingVertical: 28, borderRadius: 16,
    borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    gap: 14,
  },
  imgEmptyIconWrapper: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  imgEmptyTextContainer: { alignItems: 'center', gap: 6 },
  imgEmptyTitle: { fontSize: 16, fontWeight: '700' },
  imgEmptySub: { fontSize: 13, textAlign: 'center' },

  imgRow: { marginTop: 4 },
  imgRowContent: { gap: 12 },
  imgThumb: { width: 100, height: 100, borderRadius: 16, overflow: 'visible' },
  imgPreview: { width: 100, height: 100, borderRadius: 16 },
  imgRemove:  {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#1E1E2E', borderRadius: 12, width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  imgAddThumb: {
    width: 100, height: 100, borderRadius: 16,
    borderWidth: 1, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EF444412', borderRadius: 12,
    padding: 12, marginTop: 16,
  },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1 },

  // Footer
  footer: {
    paddingHorizontal: 24, paddingTop: 16,
    borderTopWidth: 1,
  },
  submitBtn: {
    borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Action Sheet
  actionSheetOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingVertical: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  actionSheetHeader: { marginBottom: 24 },
  actionSheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  actionSheetSub: { fontSize: 14 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16, borderBottomWidth: 1,
  },
  actionIconWrapper: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { fontSize: 16, fontWeight: '600' },
  actionSheetFooter: { marginTop: 16 },
  actionCancelBtn: {
    paddingVertical: 16, borderRadius: 16, alignItems: 'center',
  },
  actionCancelText: { fontSize: 16, fontWeight: '600' },
});
