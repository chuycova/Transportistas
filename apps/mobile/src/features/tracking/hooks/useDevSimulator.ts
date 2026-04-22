// ─── useDevSimulator.ts ───────────────────────────────────────────────────────
// Hook de simulación GPS para desarrollo.
// Reproduce los waypoints de la ruta como si el dispositivo se
// desplazara por ellos, interpolando posición y calculando heading
// entre puntos consecutivos.
//
// Cuando se provee `onTick`, cada posición simulada se envía al
// callback — esto permite alimentar el backend (emitLocationPing)
// para que el dashboard web vea el vehículo moverse en tiempo real.

import { useState, useEffect, useRef, useCallback } from 'react';

export interface SimPosition { lat: number; lng: number; speed?: number }

export interface DevSimulatorState {
  position:    SimPosition | null;
  heading:     number | null;
  isRunning:   boolean;
  progress:    number;   // 0–1 fraction of route completed
  segmentIdx:  number;
  speedKmh:    number;
  start:  () => void;
  pause:  () => void;
  reset:  () => void;
  setSpeedKmh: (v: number) => void;
}

export interface SimulatorOptions {
  onTick?: (pos: SimPosition, heading: number) => void;
}

// Haversine distance in metres between two points
function haversineDist(a: SimPosition, b: SimPosition): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const c = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

// Bearing in degrees (0 = north, clockwise)
function calcBearing(from: SimPosition, to: SimPosition): number {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat   = (to.lat   * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Linear interpolate between two points by fraction t ∈ [0,1]
function lerp(a: SimPosition, b: SimPosition, t: number): SimPosition {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

const TICK_MS = 200; // update interval

export function useDevSimulator(
  waypoints: Array<{ lat: number; lng: number }>,
  options?: SimulatorOptions,
): DevSimulatorState {
  const [isRunning,  setIsRunning]  = useState(false);
  const [position,   setPosition]   = useState<SimPosition | null>(null);
  const [heading,    setHeading]    = useState<number | null>(null);
  const [segmentIdx, setSegmentIdx] = useState(0);
  const [progress,   setProgress]   = useState(0);
  const [speedKmh,   setSpeedKmh]   = useState(30);

  // How far along the current segment we are (metres)
  const segOffsetRef = useRef(0);
  const segIdxRef    = useRef(0);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedRef     = useRef(speedKmh);
  const wpRef        = useRef(waypoints);
  const onTickRef    = useRef(options?.onTick);

  useEffect(() => { speedRef.current = speedKmh; }, [speedKmh]);
  useEffect(() => { wpRef.current = waypoints; }, [waypoints]);
  useEffect(() => { onTickRef.current = options?.onTick; }, [options?.onTick]);

  const emitPos = useCallback((pos: SimPosition, h: number) => {
    setPosition(pos);
    setHeading(h);
    // Notificar al backend
    onTickRef.current?.(
      { lat: pos.lat, lng: pos.lng, speed: speedRef.current / 3.6 },
      h,
    );
  }, []);

  const tick = useCallback(() => {
    const wps = wpRef.current;
    const idx = segIdxRef.current;
    if (wps.length < 2 || idx >= wps.length - 1) {
      setIsRunning(false);
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }

    const from = wps[idx]!;
    const to   = wps[idx + 1]!;
    const segLen = haversineDist(from, to);

    // Metres to advance per tick
    const mps = (speedRef.current * 1000) / 3600;
    segOffsetRef.current += mps * (TICK_MS / 1000);

    if (segOffsetRef.current >= segLen) {
      // Move to next segment
      segOffsetRef.current -= segLen;
      segIdxRef.current += 1;
      if (segIdxRef.current >= wps.length - 1) {
        // Reached end
        const endPos = { lat: wps[wps.length - 1]!.lat, lng: wps[wps.length - 1]!.lng };
        emitPos(endPos, calcBearing(from, to));
        setSegmentIdx(wps.length - 1);
        setProgress(1);
        setIsRunning(false);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        return;
      }
    }

    const currentFrom = wps[segIdxRef.current]!;
    const currentTo   = wps[segIdxRef.current + 1]!;
    const currentLen  = haversineDist(currentFrom, currentTo);
    const t = currentLen > 0 ? Math.min(segOffsetRef.current / currentLen, 1) : 0;
    const pos = lerp(currentFrom, currentTo, t);
    const h   = calcBearing(currentFrom, currentTo);

    emitPos(pos, h);
    setSegmentIdx(segIdxRef.current);

    // Total route progress
    let totalDist = 0;
    let coveredDist = 0;
    for (let i = 0; i < wps.length - 1; i++) {
      const d = haversineDist(wps[i]!, wps[i + 1]!);
      totalDist += d;
      if (i < segIdxRef.current) coveredDist += d;
    }
    coveredDist += segOffsetRef.current;
    setProgress(totalDist > 0 ? Math.min(coveredDist / totalDist, 1) : 0);
  }, [emitPos]);

  const start = useCallback(() => {
    const wps = wpRef.current;
    if (wps.length < 2) return;

    // Si no hay posición, inicializar en el primer waypoint de la ruta
    if (segIdxRef.current === 0 && segOffsetRef.current === 0) {
      const initialPos = { lat: wps[0]!.lat, lng: wps[0]!.lng };
      const initialH   = calcBearing(wps[0]!, wps[1]!);
      emitPos(initialPos, initialH);
    }

    setIsRunning(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(tick, TICK_MS);
  }, [tick, emitPos]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const reset = useCallback(() => {
    pause();
    segIdxRef.current = 0;
    segOffsetRef.current = 0;
    setSegmentIdx(0);
    setProgress(0);
    const wps = wpRef.current;
    if (wps.length >= 2) {
      emitPos({ lat: wps[0]!.lat, lng: wps[0]!.lng }, calcBearing(wps[0]!, wps[1]!));
    } else {
      setPosition(null);
      setHeading(null);
    }
  }, [pause, emitPos]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return { position, heading, isRunning, progress, segmentIdx, speedKmh, start, pause, reset, setSpeedKmh };
}
