// ─── usePermissions.ts ────────────────────────────────────────────────────────
// Centraliza la solicitud y seguimiento de todos los permisos que ZonaZero
// necesita para funcionar correctamente.
//
// Permisos gestionados:
//   - Ubicación en primer plano (obligatorio para tracking)
//   - Ubicación en segundo plano (obligatorio para background GPS en iOS)
//   - Notificaciones (necesario para alertas de desvío, SOS, etc.)
//   - Cámara (necesario para adjuntar fotos en incidentes)

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PermissionKey = 'locationFg' | 'locationBg' | 'notifications' | 'camera';
export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'limited';

export interface PermissionInfo {
  key: PermissionKey;
  label: string;
  description: string;
  icon: string;
  status: PermissionStatus;
  /** true = sin este permiso la app no puede funcionar */
  required: boolean;
}

export interface UsePermissionsResult {
  /** true cuando todos los permisos REQUERIDOS están granted */
  allRequiredGranted: boolean;
  permissions: PermissionInfo[];
  loading: boolean;
  /** Solicita todos los permisos pendientes en secuencia */
  requestAll: () => Promise<void>;
  /** Refresca el estado actual (después de volver de Ajustes) */
  refresh: () => Promise<void>;
}

function toStatus(raw: string): PermissionStatus {
  if (raw === 'granted') return 'granted';
  if (raw === 'denied') return 'denied';
  if (raw === 'limited') return 'limited';
  return 'undetermined';
}

export function usePermissions(): UsePermissionsResult {
  const [permissions, setPermissions] = useState<PermissionInfo[]>([
    {
      key: 'locationFg',
      label: 'Ubicación',
      description: 'Necesaria para registrar tu posición durante la ruta.',
      icon: '📍',
      status: 'undetermined',
      required: true,
    },
    {
      key: 'locationBg',
      label: 'Ubicación en segundo plano',
      description: 'Permite registrar la ruta aunque la app esté minimizada.',
      icon: '🗺️',
      status: 'undetermined',
      required: Platform.OS === 'ios', // Android usa foreground service, no necesita bg perm
    },
    {
      key: 'notifications',
      label: 'Notificaciones',
      description: 'Recibe alertas de desvío y avisos importantes.',
      icon: '🔔',
      status: 'undetermined',
      required: false,
    },
    {
      key: 'camera',
      label: 'Cámara',
      description: 'Para adjuntar fotos al reportar incidentes.',
      icon: '📷',
      status: 'undetermined',
      required: false,
    },
  ]);
  const [loading, setLoading] = useState(true);

  const checkAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fgPerm, bgPerm, notifPerm, camPerm] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Location.getBackgroundPermissionsAsync(),
        Notifications.getPermissionsAsync(),
        ImagePicker.getCameraPermissionsAsync(),
      ]);

      setPermissions((prev) =>
        prev.map((p) => {
          switch (p.key) {
            case 'locationFg':   return { ...p, status: toStatus(fgPerm.status) };
            case 'locationBg':   return { ...p, status: toStatus(bgPerm.status) };
            case 'notifications': return { ...p, status: toStatus(notifPerm.status) };
            case 'camera':       return { ...p, status: toStatus(camPerm.status) };
            default:             return p;
          }
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Comprueba al montar
  useEffect(() => { void checkAll(); }, [checkAll]);

  const requestAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Ubicación foreground (obligatorio)
      const fg = await Location.requestForegroundPermissionsAsync();

      // 2. Ubicación background (solo si fg fue granted)
      let bg = await Location.getBackgroundPermissionsAsync();
      if (fg.status === 'granted') {
        bg = await Location.requestBackgroundPermissionsAsync();
      }

      // 3. Notificaciones
      const notif = await Notifications.requestPermissionsAsync();

      // 4. Cámara
      const cam = await ImagePicker.requestCameraPermissionsAsync();

      setPermissions((prev) =>
        prev.map((p) => {
          switch (p.key) {
            case 'locationFg':    return { ...p, status: toStatus(fg.status) };
            case 'locationBg':    return { ...p, status: toStatus(bg.status) };
            case 'notifications': return { ...p, status: toStatus(notif.status) };
            case 'camera':        return { ...p, status: toStatus(cam.status) };
            default:              return p;
          }
        }),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const allRequiredGranted = permissions
    .filter((p) => p.required)
    .every((p) => p.status === 'granted');

  return { allRequiredGranted, permissions, loading, requestAll, refresh: checkAll };
}
