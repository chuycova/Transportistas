'use client';
// ─── features/dashboard/socket-manager.ts ───────────────────────────────
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuth } from '../auth/auth-provider';
import { useTrackingStore } from '../../stores/use-tracking-store';
import type { LocationWebSocketPayload } from '@zona-zero/domain';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function useSocketManager() {
  const { session } = useAuth();
  const updateVehicle = useTrackingStore((s) => s.updateVehicleLocation);
  const appendTrail = useTrackingStore((s) => s.appendTrail);
  const setConnected = useTrackingStore((s) => s.setConnected);

  useEffect(() => {
    if (!session?.access_token) {
      if (socket) {
        socket.disconnect();
        socket = null;
        setConnected(false);
      }
      return;
    }

    const tenantId = session.user.user_metadata?.tenant_id as string | undefined;

    socket = io(BACKEND_URL, {
      extraHeaders: { Authorization: `Bearer ${session.access_token}` },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      if (tenantId) socket?.emit('join:tenant', { tenantId });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('exception', (error: unknown) => {
      console.error('WS exception:', error);
    });

    socket.on('location:update', (payload: LocationWebSocketPayload) => {
      updateVehicle(payload);
      appendTrail(payload.v, payload.lat, payload.lng);
    });

    socket.on('alert:deviation', (data: { vehicleId: string; deviationM: number; timestamp: string }) => {
      toast.warning('Desvío detectado', {
        description: `Vehículo fuera de ruta por ${Math.round(data.deviationM)} m`,
        duration: 8000,
      });
    });

    socket.on('alert:emergency', (data: { vehicleId: string; coordinate?: { lat: number; lng: number }; timestamp: string }) => {
      toast.error('🆘 ALERTA DE EMERGENCIA', {
        description: `El conductor del vehículo ${data.vehicleId} activó el botón de pánico`,
        duration: 0, // Persiste hasta que se cierre manualmente
      });
      // Sonido de alerta via Web Audio API si está disponible
      try {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 1.5);
      } catch { /* ignore audio errors */ }
    });

    socket.on('alert:geofence', (data: { vehicleId: string; eventType: 'geofence_entry' | 'geofence_exit'; geofenceName: string; timestamp: string }) => {
      const isEntry = data.eventType === 'geofence_entry';
      toast.info(isEntry ? '📍 Entrada a geocerca' : '📍 Salida de geocerca', {
        description: `Vehículo ${data.vehicleId} ${isEntry ? 'entró a' : 'salió de'} "${data.geofenceName}"`,
        duration: 6000,
      });
    });

    return () => {
      socket?.disconnect();
      socket = null;
      setConnected(false);
    };
  }, [session?.access_token, session?.user.user_metadata?.tenant_id, updateVehicle, appendTrail, setConnected]);
}

export function SocketInitialize() {
  useSocketManager();
  return null;
}
