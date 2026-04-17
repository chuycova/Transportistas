// ─── features/incidents/components/ReportIncidentModal.tsx ───────────────────
// Modal bottom-sheet para reportar un incidente desde la pantalla de tracking.
// Incluye: tipo, gravedad, descripción y adjuntar fotos/galería.

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, Image, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useReportIncident, type IncidentType, type IncidentSeverity } from '../hooks/useReportIncident';

// ─── Constantes de opciones ───────────────────────────────────────────────────

const TYPE_OPTIONS: Array<{ value: IncidentType; label: string; emoji: string }> = [
  { value: 'mechanical',      label: 'Mecánico',   emoji: '🔧' },
  { value: 'route_deviation', label: 'Desvío',     emoji: '🗺️' },
  { value: 'accident',        label: 'Accidente',  emoji: '🚨' },
  { value: 'weather',         label: 'Clima',      emoji: '⛈️' },
  { value: 'cargo',           label: 'Carga',      emoji: '📦' },
  { value: 'other',           label: 'Otro',       emoji: '📝' },
];

const SEVERITY_OPTIONS: Array<{ value: IncidentSeverity; label: string; color: string }> = [
  { value: 'low',      label: 'Bajo',     color: '#10B981' },
  { value: 'medium',   label: 'Medio',    color: '#F59E0B' },
  { value: 'high',     label: 'Alto',     color: '#F97316' },
  { value: 'critical', label: 'Crítico',  color: '#EF4444' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReportIncidentModalProps {
  visible:    boolean;
  onClose:    () => void;
  tripId?:    string;
  vehicleId?: string;
  lat?:       number;
  lng?:       number;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ReportIncidentModal({
  visible, onClose, tripId, vehicleId, lat, lng,
}: ReportIncidentModalProps) {
  const [type,        setType]        = useState<IncidentType>('other');
  const [severity,    setSeverity]    = useState<IncidentSeverity>('medium');
  const [description, setDescription] = useState('');
  const [images,      setImages]      = useState<ImagePicker.ImagePickerAsset[]>([]);

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

  // ── Selección de imagen ────────────────────────────────────────────────────
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
      ? await ImagePicker.launchCameraAsync({
          quality:            0.75,
          base64:             true,
          allowsEditing:      false,
          exif:               false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes:         ImagePicker.MediaTypeOptions.Images,
          quality:            0.75,
          base64:             true,
          allowsMultipleSelection: true,
          selectionLimit:     5,
        });

    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, 5));
    }
  }, []);

  const handleAddImage = useCallback(() => {
    Alert.alert(
      'Adjuntar imagen',
      '',
      [
        { text: '📷  Cámara',  onPress: () => void pickImage('camera') },
        { text: '🖼️  Galería', onPress: () => void pickImage('library') },
        { text: 'Cancelar',   style: 'cancel' },
      ],
    );
  }, [pickImage]);

  // ── Enviar ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const result = await report({
      tripId, vehicleId, type, severity,
      description: description.trim() || undefined,
      lat, lng, images,
    });

    if (result) {
      Alert.alert(
        '✅ Incidente reportado',
        `Código: ${result.code}\n\nEl equipo de control fue notificado.`,
        [{ text: 'OK', onPress: handleClose }],
      );
    }
  }, [report, tripId, vehicleId, type, severity, description, lat, lng, images, handleClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reportar incidente</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Text style={styles.headerClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

          {/* Tipo */}
          <Text style={styles.sectionLabel}>Tipo de incidente</Text>
          <View style={styles.typeGrid}>
            {TYPE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.typeBtn, type === opt.value && styles.typeBtnActive]}
                onPress={() => setType(opt.value)}
              >
                <Text style={styles.typeEmoji}>{opt.emoji}</Text>
                <Text style={[styles.typeLabel, type === opt.value && styles.typeLabelActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Gravedad */}
          <Text style={styles.sectionLabel}>Gravedad</Text>
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.severityBtn,
                  severity === opt.value && { backgroundColor: opt.color + '22', borderColor: opt.color },
                ]}
                onPress={() => setSeverity(opt.value)}
              >
                <Text style={[styles.severityLabel, severity === opt.value && { color: opt.color }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Descripción */}
          <Text style={styles.sectionLabel}>Descripción <Text style={styles.optional}>(opcional)</Text></Text>
          <TextInput
            style={styles.textarea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe brevemente lo ocurrido…"
            placeholderTextColor="#666680"
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          {/* Imágenes */}
          <View style={styles.imgHeader}>
            <Text style={styles.sectionLabel}>Evidencias fotográficas <Text style={styles.optional}>(máx. 5)</Text></Text>
            {images.length < 5 && (
              <TouchableOpacity onPress={handleAddImage}>
                <Text style={styles.addImgBtn}>+ Agregar</Text>
              </TouchableOpacity>
            )}
          </View>

          {images.length === 0 ? (
            <TouchableOpacity style={styles.imgEmpty} onPress={handleAddImage} activeOpacity={0.75}>
              <Text style={styles.imgEmptyIcon}>📷</Text>
              <Text style={styles.imgEmptyText}>Toca para adjuntar fotos</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgRow}>
              {images.map((img, i) => (
                <View key={img.uri} style={styles.imgThumb}>
                  <Image source={{ uri: img.uri }} style={styles.imgPreview} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.imgRemove}
                    onPress={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                    hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
                  >
                    <Text style={styles.imgRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity style={styles.imgAddThumb} onPress={handleAddImage}>
                  <Text style={styles.imgAddIcon}>+</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={uploading}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={styles.submitText}>Reportar incidente</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#2A2A3F',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  headerClose: { color: '#8888AA', fontSize: 18, fontWeight: '600' },

  body:    { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 4 },
  sectionLabel: { color: '#8888AA', fontSize: 11, letterSpacing: 1.2, fontWeight: '600', textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  optional: { color: '#555570', fontWeight: '400' },

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    backgroundColor: '#12121C',
    gap: 4,
  },
  typeBtnActive:  { borderColor: '#6C63FF', backgroundColor: '#6C63FF22' },
  typeEmoji:      { fontSize: 22 },
  typeLabel:      { color: '#8888AA', fontSize: 11, fontWeight: '600' },
  typeLabelActive: { color: '#6C63FF' },

  severityRow: { flexDirection: 'row', gap: 8 },
  severityBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    backgroundColor: '#12121C',
  },
  severityLabel: { color: '#8888AA', fontSize: 12, fontWeight: '600' },

  textarea: {
    backgroundColor: '#12121C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    color: '#FFFFFF',
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  imgHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addImgBtn: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },
  imgEmpty: {
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2A2A3F',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  imgEmptyIcon: { fontSize: 20 },
  imgEmptyText: { color: '#8888AA', fontSize: 13 },

  imgRow:     { marginTop: 8 },
  imgThumb:   { width: 80, height: 80, borderRadius: 10, overflow: 'visible', marginRight: 8, position: 'relative' },
  imgPreview: { width: 80, height: 80, borderRadius: 10 },
  imgRemove:  {
    position: 'absolute', top: -8, right: -8,
    backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  imgRemoveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  imgAddThumb: {
    width: 80, height: 80, borderRadius: 10,
    borderWidth: 1, borderStyle: 'dashed', borderColor: '#2A2A3F',
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  imgAddIcon: { color: '#6C63FF', fontSize: 28, fontWeight: '300' },

  errorBox: { backgroundColor: '#EF444420', borderRadius: 10, borderWidth: 1, borderColor: '#EF444440', padding: 12, marginTop: 12 },
  errorText: { color: '#EF4444', fontSize: 12 },

  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: '#2A2A3F',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#12121C',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A3F',
  },
  cancelText: { color: '#8888AA', fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 2,
    backgroundColor: '#6C63FF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
