import { create } from 'zustand';
import type { LocationWebSocketPayload } from '@zona-zero/domain';

const TRAIL_MAX = 200;

export interface TrailPoint { lat: number; lng: number }

interface TrackingState {
  vehicles: Record<string, LocationWebSocketPayload>;
  trails: Record<string, TrailPoint[]>;
  activeRouteId: string | null;
  isConnected: boolean;

  /**
   * ID del vehículo cuyo marker debe parpadear brevemente en el mapa.
   * Se limpia automáticamente después de la animación.
   */
  flashVehicleId: string | null;

  /**
   * ID del vehículo al que el mapa debe hacer pan/focus (doble click).
   * El mapa lo consume y lo limpia después de hacer panTo.
   */
  focusModeVehicleId: string | null;

  updateVehicleLocation: (payload: LocationWebSocketPayload) => void;
  appendTrail: (vehicleId: string, lat: number, lng: number) => void;
  setActiveRoute: (routeId: string | null) => void;
  setConnected: (connected: boolean) => void;
  clearVehicles: () => void;

  /** Activa el parpadeo del marker — se auto-limpia en 2 segundos */
  flashVehicle: (vehicleId: string) => void;
  /** Ordena al mapa que haga pan a la posición del vehículo */
  focusVehicle: (vehicleId: string) => void;
  /** El mapa llama a esto después de hacer panTo para liberar el estado */
  clearFocus: () => void;
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  vehicles: {},
  trails: {},
  activeRouteId: null,
  isConnected: false,
  flashVehicleId: null,
  focusModeVehicleId: null,

  updateVehicleLocation: (payload) =>
    set((state) => ({
      vehicles: { ...state.vehicles, [payload.v]: payload },
    })),

  appendTrail: (vehicleId, lat, lng) =>
    set((state) => {
      const prev = state.trails[vehicleId] ?? [];
      const next = prev.length >= TRAIL_MAX ? prev.slice(prev.length - TRAIL_MAX + 1) : prev;
      return { trails: { ...state.trails, [vehicleId]: [...next, { lat, lng }] } };
    }),

  setActiveRoute: (routeId) => set({ activeRouteId: routeId }),
  setConnected: (connected) => set({ isConnected: connected }),
  clearVehicles: () => set({ vehicles: {}, trails: {} }),

  flashVehicle: (vehicleId) => {
    // Evitar limpiar un flash de un vehículo distinto que ya está corriendo
    set({ flashVehicleId: vehicleId });
    setTimeout(() => {
      // Solo limpiar si el vehicleId sigue siendo el mismo (no fue sobrescrito)
      if (get().flashVehicleId === vehicleId) {
        set({ flashVehicleId: null });
      }
    }, 2000);
  },

  focusVehicle: (vehicleId) => set({ focusModeVehicleId: vehicleId }),
  clearFocus: () => set({ focusModeVehicleId: null }),
}));
