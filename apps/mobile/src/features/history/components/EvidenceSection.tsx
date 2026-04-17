// ─── EvidenceSection.tsx ──────────────────────────────────────────────────────
// Sección reutilizable para adjuntar evidencia (fotos, videos, archivos) a una
// ruta o alerta. La subida real requiere Supabase Storage + expo-image-picker.
//
// Para activar los pickers reales, instalar:
//   npx expo install expo-image-picker expo-document-picker
// y descomentar las importaciones y llamadas correspondientes.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, Image,
} from 'react-native';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type EvidenceItem = {
  id: string;
  type: 'image' | 'video' | 'file';
  uri: string;
  name: string;
};

// ─── Picker simulado ──────────────────────────────────────────────────────────
// Devuelve un ítem de placeholder. Reemplazar por expo-image-picker cuando
// se tenga Supabase Storage configurado.
function simulatePick(source: 'camera' | 'gallery' | 'file'): EvidenceItem {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (source === 'file') {
    return { id, type: 'file', uri: '', name: `documento_${id.slice(0, 6)}.pdf` };
  }
  return {
    id,
    type: 'image',
    // URI de placeholder (imagen pública de prueba)
    uri: `https://picsum.photos/seed/${id}/300/200`,
    name: `foto_${id.slice(0, 6)}.jpg`,
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────
interface Props {
  contextLabel: string; // "esta ruta" | "esta alerta"
}

export function EvidenceSection({ contextLabel }: Props) {
  const [items, setItems] = useState<EvidenceItem[]>([]);

  const addItem = (source: 'camera' | 'gallery' | 'file') => {
    // TODO: cuando expo-image-picker esté instalado, usar:
    //   const result = await ImagePicker.launchCameraAsync({ ... })
    //   if (!result.canceled) setItems(prev => [...prev, mapResult(result)])
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
        {
          text: '📷  Cámara',
          onPress: () => addItem('camera'),
        },
        {
          text: '🖼️  Galería',
          onPress: () => addItem('gallery'),
        },
        {
          text: '📄  Archivo',
          onPress: () => addItem('file'),
        },
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
    <View style={styles.container}>

      {/* ── Encabezado ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Evidencia</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {/* ── Grid de archivos ── */}
      {items.length === 0 ? (
        <TouchableOpacity style={styles.emptyBox} onPress={handleAdd} activeOpacity={0.75}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyText}>Toca para adjuntar fotos, videos o archivos</Text>
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
                <Image source={{ uri: item.uri }} style={styles.thumbImage} resizeMode="cover" />
              ) : (
                <View style={styles.thumbFile}>
                  <Text style={styles.thumbFileIcon}>
                    {item.type === 'video' ? '🎬' : '📄'}
                  </Text>
                </View>
              )}
              {/* Botón eliminar */}
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeItem(item.id)}
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
              {/* Nombre */}
              <Text style={styles.thumbName} numberOfLines={1}>{item.name}</Text>
            </View>
          ))}

          {/* Botón "+" al final del grid */}
          <TouchableOpacity style={styles.addThumb} onPress={handleAdd} activeOpacity={0.75}>
            <Text style={styles.addThumbIcon}>+</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Acción guardar ── */}
      {items.length > 0 && (
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>
            Guardar evidencia ({items.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const THUMB_SIZE = 100;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#12121C',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: '#6C63FF22',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#6C63FF55',
  },
  addBtnText: {
    color: '#6C63FF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Estado vacío
  emptyBox: {
    height: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A3F',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0A0A0F',
  },
  emptyIcon: { fontSize: 28 },
  emptyText: {
    color: '#8888AA',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 220,
  },

  // Grid horizontal
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
    backgroundColor: '#1C1C2E',
  },
  thumbFile: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    backgroundColor: '#1C1C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFileIcon: { fontSize: 32 },
  thumbName: {
    color: '#8888AA',
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
    borderColor: '#2A2A3F',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0F',
  },
  addThumbIcon: {
    color: '#6C63FF',
    fontSize: 28,
    fontWeight: '300',
  },

  // Botón guardar
  saveBtn: {
    backgroundColor: '#6C63FF',
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
