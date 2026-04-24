import { create } from 'zustand';
import type { LocationWebSocketPayload } from '@zona-zero/domain';

const TRAIL_MAX = 200;

export interface TrailPoint { lat: number; lng: number; off?: boolean }

interface TrackingState {
  vehicles: Record<string, LocationWebSocketPayload>;
  trails: Record<string, TrailPoint[]>;
  activeRouteId: string | null;
  /** vehicleId -> routeId: ruta actualmente en tracking por vehículo */
  activeRoutes: Record<string, string>;
  /** vehicleId -> polyline de navegación al primer punto (Directions API) */
  navRoutes: Record<string, { lat: number; lng: number }[]>;
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
  appendTrail: (vehicleId: string, lat: number, lng: number, off?: boolean) => void;
  setActiveRoute: (routeId: string | null) => void;
  setConnected: (connected: boolean) => void;
  clearVehicles: () => void;

  /** Activa el parpadeo del marker — se auto-limpia en 2 segundos */
  flashVehicle: (vehicleId: string) => void;
  /** Ordena al mapa que haga pan a la posición del vehículo */
  focusVehicle: (vehicleId: string) => void;
  /** El mapa llama a esto después de hacer panTo para liberar el estado */
  clearFocus: () => void;

  /** Registra que ruta está activa para un vehículo (tracking:started) */
  setActiveVehicleRoute: (vehicleId: string, routeId: string) => void;
  /** Limpia la ruta activa de un vehículo */
  clearActiveVehicleRoute: (vehicleId: string) => void;

  /** Guarda la polyline de navegación al primer punto (Directions API) */
  setNavRoute: (vehicleId: string, path: { lat: number; lng: number }[]) => void;
  /** Limpia la polyline de navegación */
  clearNavRoute: (vehicleId: string) => void;
  /** Limpia el trail de un vehículo sin borrar su posición en vivo */
  clearVehicleTrail: (vehicleId: string) => void;
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  vehicles: {},
  trails: {},
  activeRouteId: null,
  activeRoutes: {},
  navRoutes: {},
  isConnected: false,
  flashVehicleId: null,
  focusModeVehicleId: null,

  updateVehicleLocation: (payload) =>
    set((state) => ({
      vehicles: { ...state.vehicles, [payload.v]: payload },
    })),

  appendTrail: (vehicleId, lat, lng, off) =>
    set((state) => {
      const prev = state.trails[vehicleId] ?? [];
      const next = prev.length >= TRAIL_MAX ? prev.slice(prev.length - TRAIL_MAX + 1) : prev;
      return { trails: { ...state.trails, [vehicleId]: [...next, { lat, lng, off }] } };
    }),

  setActiveRoute: (routeId) => set({ activeRouteId: routeId }),
  setConnected: (connected) => set({ isConnected: connected }),
  clearVehicles: () => set({ vehicles: {}, trails: {} }),

  clearVehicleTrail: (vehicleId) =>
    set((state) => {
      const { [vehicleId]: _, ...rest } = state.trails;
      return { trails: rest };
    }),

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

  setActiveVehicleRoute: (vehicleId, routeId) =>
    set((state) => ({
      activeRoutes: { ...state.activeRoutes, [vehicleId]: routeId },
    })),
  clearActiveVehicleRoute: (vehicleId) =>
    set((state) => {
      const { [vehicleId]: _, ...rest } = state.activeRoutes;
      return { activeRoutes: rest };
    }),

  setNavRoute: (vehicleId, path) =>
    set((state) => ({
      navRoutes: { ...state.navRoutes, [vehicleId]: path },
    })),
  clearNavRoute: (vehicleId) =>
    set((state) => {
      const { [vehicleId]: _, ...rest } = state.navRoutes;
      return { navRoutes: rest };
    }),
}));
