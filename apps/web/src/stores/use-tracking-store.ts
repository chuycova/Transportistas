import { create } from 'zustand';
import type { LocationWebSocketPayload } from '@zona-zero/domain';

const TRAIL_MAX = 200;
const HIDDEN_VEHICLES_KEY = 'zz-hidden-vehicles';

export interface TrailPoint { lat: number; lng: number; off?: boolean }

// ── localStorage helpers (safe for SSR) ──────────────────────────────────────
function loadHiddenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(HIDDEN_VEHICLES_KEY);
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveHiddenIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(HIDDEN_VEHICLES_KEY, JSON.stringify([...ids])); }
  catch { /* ignore quota errors */ }
}

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

  /**
   * Vehículos ocultos en el mapa. Persiste en localStorage.
   * Al ocultar un vehículo también se ocultan sus rutas y trail.
   */
  hiddenVehicleIds: Set<string>;

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

  /** Alterna visibilidad de un vehículo en el mapa; persiste en localStorage */
  toggleVehicleVisibility: (vehicleId: string) => void;
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
  hiddenVehicleIds: loadHiddenIds(),

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
    set({ flashVehicleId: vehicleId });
    setTimeout(() => {
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

  toggleVehicleVisibility: (vehicleId) =>
    set((state) => {
      const next = new Set(state.hiddenVehicleIds);
      if (next.has(vehicleId)) { next.delete(vehicleId); }
      else { next.add(vehicleId); }
      saveHiddenIds(next);
      return { hiddenVehicleIds: next };
    }),
}));
