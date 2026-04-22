// ─── EvidenceSection.tsx ──────────────────────────────────────────────────────
// Sección reutilizable para adjuntar evidencia (fotos, videos, archivos).

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, Image,
} from 'react-native';
import { useTheme } from '@lib/ThemeContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type EvidenceItem = {
  id: string;
  type: 'image' | 'video' | 'file';
  uri: string;
  name: string;
};

function simulatePick(source: 'camera' | 'gallery' | 'file'): EvidenceItem {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (source === 'file') {
    return { id, type: 'file', uri: '', name: `documento_${id.slice(0, 6)}.pdf` };
  }
  return {
    id,
    type: 'image',
    uri: `https://picsum.photos/seed/${id}/300/200`,
    name: `foto_${id.slice(0, 6)}.jpg`,
  };
}

interface Props {
  contextLabel: string;
}

export function EvidenceSection({ contextLabel }: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const { colors } = useTheme();

  const addItem = (source: 'camera' | 'gallery' | 'file') => {
    const item = simulatePick(source);
    setItems((prev) => [...prev, item]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAdd = () => {
    Alert.alert(
      'Agregar evidencia',
      `Adjunta una prueba a ${contextLabel}`,
      [
        { text: '📷  Cámara',  onPress: () => addItem('camera') },
        { text: '🖼️  Galería', onPress: () => addItem('gallery') },
        { text: '📄  Archivo', onPress: () => addItem('file') },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const handleSave = () => {
    if (items.length === 0) {
      Alert.alert('Sin evidencia', 'Agrega al menos un archivo antes de guardar.');
      return;
    }
    Alert.alert(
      'Próximamente',
      `Se subirán ${items.length} archivo${items.length !== 1 ? 's' : ''} a Supabase Storage cuando el módulo esté habilitado.`,
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>

      {/* ── Encabezado ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Evidencia</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '55' }]}
          onPress={handleAdd}
          activeOpacity={0.8}
        >
          <Text style={[styles.addBtnText, { color: colors.accent }]}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {/* ── Grid de archivos ── */}
      {items.length === 0 ? (
        <TouchableOpacity
          style={[styles.emptyBox, { borderColor: colors.border, backgroundColor: colors.bg }]}
          onPress={handleAdd}
          activeOpacity={0.75}
        >
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Toca para adjuntar fotos, videos o archivos
          </Text>
        </TouchableOpacity>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.grid}
        >
          {items.map((item) => (
            <View key={item.id} style={styles.thumb}>
              {item.type === 'image' && item.uri ? (
                <Image source={{ uri: item.uri }} style={[styles.thumbImage, { backgroundColor: colors.surfaceAlt }]} resizeMode="cover" />
              ) : (
                <View style={[styles.thumbFile, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.thumbFileIcon}>
                    {item.type === 'video' ? '🎬' : '📄'}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeItem(item.id)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
              <Text style={[styles.thumbName, { color: colors.textSecondary }]} numberOfLines={1}>{item.name}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addThumb, { borderColor: colors.border, backgroundColor: colors.bg }]}
            onPress={handleAdd}
            activeOpacity={0.75}
          >
            <Text style={[styles.addThumbIcon, { color: colors.accent }]}>+</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Acción guardar ── */}
      {items.length > 0 && (
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>
            Guardar evidencia ({items.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const THUMB_SIZE = 100;

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  addBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    height: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyIcon: { fontSize: 28 },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 220,
  },
  grid: {
    gap: 10,
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  thumb: {
    width: THUMB_SIZE,
    gap: 4,
  },
  thumbImage: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
  },
  thumbFile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFileIcon: { fontSize: 32 },
  thumbName: {
    fontSize: 10,
    textAlign: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  addThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumbIcon: {
    fontSize: 28,
    fontWeight: '300',
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
