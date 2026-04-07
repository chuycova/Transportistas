import { create } from 'zustand';
import type { LocationWebSocketPayload } from '@zona-zero/domain';

const TRAIL_MAX = 200;

export interface TrailPoint { lat: number; lng: number }

interface TrackingState {
  vehicles: Record<string, LocationWebSocketPayload>;
  trails: Record<string, TrailPoint[]>;
  activeRouteId: string | null;
  isConnected: boolean;

  updateVehicleLocation: (payload: LocationWebSocketPayload) => void;
  appendTrail: (vehicleId: string, lat: number, lng: number) => void;
  setActiveRoute: (routeId: string | null) => void;
  setConnected: (connected: boolean) => void;
  clearVehicles: () => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  vehicles: {},
  trails: {},
  activeRouteId: null,
  isConnected: false,

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
}));
