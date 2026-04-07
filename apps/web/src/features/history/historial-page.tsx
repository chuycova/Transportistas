'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { APIProvider, Map as GMap, AdvancedMarker, Pin, Polyline, useMap } from '@vis.gl/react-google-maps';
import { Play, Square, RotateCcw, Clock, Truck, AlertTriangle, Navigation } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useVehicles } from '../vehicles/use-vehicles';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 };

interface HistPoint {
  lat: number;
  lng: number;
  speedKmh?: number;
  headingDeg?: number;
  isOffRoute: boolean;
  recordedAt: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function localDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function MapBoundsFitter({ points }: { points: HistPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(15);
      return;
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) },
      80,
    );
  }, [map, points]);
  return null;
}

export function HistorialPage() {
  const apiKey = GOOGLE_MAPS_KEY;
  const { data: vehicles = [] } = useVehicles();

  const [vehicleId, setVehicleId] = useState('');
  const [fromDate, setFromDate] = useState(localDateString);
  const [toDate, setToDate] = useState(localDateString);

  const [points, setPoints] = useState<HistPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetched, setFetched] = useState(false);

  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);
  const replayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const replayIdxRef = useRef(0);

  const fetchHistory = async () => {
    if (!vehicleId) return;
    setLoading(true);
    setFetchError('');
    setPoints([]);
    setFetched(false);
    stopReplay();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');
      const from = new Date(`${fromDate}T00:00:00`).toISOString();
      const to = new Date(`${toDate}T23:59:59`).toISOString();
      const res = await fetch(
        `${BACKEND_URL}/api/v1/tracking/history/${vehicleId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const raw = await res.json() as Array<{
        coordinate: { lat: number; lng: number };
        speedKmh?: number;
        headingDeg?: number;
        isOffRoute: boolean;
        recordedAt: string;
      }>;
      setPoints(raw.map((r) => ({
        lat: r.coordinate.lat,
        lng: r.coordinate.lng,
        speedKmh: r.speedKmh,
        headingDeg: r.headingDeg,
        isOffRoute: r.isOffRoute,
        recordedAt: r.recordedAt,
      })));
      setFetched(true);
    } catch (err) {
      setFetchError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const stopReplay = useCallback(() => {
    if (replayRef.current) { clearInterval(replayRef.current); replayRef.current = null; }
    setReplaying(false);
    setReplayIdx(null);
    replayIdxRef.current = 0;
  }, []);

  const startReplay = useCallback((pts: HistPoint[]) => {
    if (pts.length === 0) return;
    replayIdxRef.current = 0;
    setReplayIdx(0);
    setReplaying(true);
    const id = setInterval(() => {
      const next = replayIdxRef.current + 1;
      if (next >= pts.length) {
        clearInterval(id);
        replayRef.current = null;
        setReplaying(false);
        return;
      }
      replayIdxRef.current = next;
      setReplayIdx(next);
    }, 80);
    replayRef.current = id;
  }, []);

  const offRouteCount = points.filter((p) => p.isOffRoute).length;
  const currentPoint = replayIdx !== null ? points[replayIdx] : null;
  const mapCenter = points.length > 0 ? { lat: points[0].lat, lng: points[0].lng } : DEFAULT_CENTER;
  const fullPath = points.map((p) => ({ lat: p.lat, lng: p.lng }));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border/50 bg-card/60 px-6 py-3">
        <h2 className="whitespace-nowrap text-sm font-semibold">Historial de trayectos</h2>

        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="rounded-lg border border-border/50 bg-background px-3 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
        >
          <option value="">— Vehículo —</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.alias ?? v.plate}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs focus:border-primary/50 focus:outline-none" />
          <span className="text-xs text-muted-foreground">—</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-border/50 bg-background px-2 py-1.5 text-xs focus:border-primary/50 focus:outline-none" />
        </div>

        <button type="button" onClick={() => void fetchHistory()} disabled={!vehicleId || loading}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {loading
            ? <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
            : <Navigation className="h-3 w-3" />}
          Buscar
        </button>

        {fetched && points.length > 0 && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {points.length} pings</span>
            {offRouteCount > 0 && (
              <span className="flex items-center gap-1 text-destructive/80">
                <AlertTriangle className="h-3 w-3" /> {offRouteCount} desvíos
              </span>
            )}
            <span className="text-muted-foreground/60">
              {fmtDate(points[0].recordedAt)} &nbsp;
              {fmtTime(points[0].recordedAt)} – {fmtTime(points[points.length - 1].recordedAt)}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Replay controls */}
        {fetched && points.length > 0 && (
          <div className="flex items-center gap-2">
            {replayIdx !== null && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {replayIdx + 1}/{points.length}
                {currentPoint && ` · ${Math.round(currentPoint.speedKmh ?? 0)} km/h`}
                {currentPoint && ` · ${fmtTime(currentPoint.recordedAt)}`}
              </span>
            )}
            {!replaying ? (
              <button type="button" onClick={() => startReplay(points)}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 transition-colors">
                <Play className="h-3 w-3" /> Replay
              </button>
            ) : (
              <button type="button" onClick={stopReplay}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20 transition-colors">
                <Square className="h-3 w-3" /> Detener
              </button>
            )}
            {replayIdx !== null && !replaying && (
              <button type="button" onClick={stopReplay}
                className="rounded-lg border border-border/50 p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Map area */}
      <div className="relative flex-1">
        {fetchError && (
          <div className="absolute inset-x-4 top-4 z-10 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {fetchError}
          </div>
        )}

        {fetched && points.length === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Truck className="h-10 w-10 opacity-20" />
            <p className="text-sm">Sin registros en este rango de fechas</p>
          </div>
        )}

        {!fetched && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-10 w-10 opacity-20" />
            <p className="text-sm">Selecciona un vehículo y rango de fechas</p>
          </div>
        )}

        <APIProvider apiKey={apiKey}>
          <GMap
            mapId="DEMO_MAP_ID"
            defaultZoom={13}
            defaultCenter={mapCenter}
            gestureHandling="greedy"
            disableDefaultUI={true}
            style={{ width: '100%', height: '100%' }}
          >
            <MapBoundsFitter points={points} />

            {/* Full path — indigo */}
            {fullPath.length >= 2 && (
              <Polyline path={fullPath} strokeColor="#6366f1" strokeWeight={3} strokeOpacity={0.65} />
            )}

            {/* Off-route points — red dots */}
            {points
              .filter((p) => p.isOffRoute)
              .map((p, i) => (
                <AdvancedMarker
                  key={`off-${i}-${p.lat}`}
                  position={{ lat: p.lat, lng: p.lng }}
                  title="Fuera de ruta"
                >
                  <div className="h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 shadow" />
                </AdvancedMarker>
              ))}

            {/* Start marker */}
            {points.length > 0 && (
              <AdvancedMarker position={{ lat: points[0].lat, lng: points[0].lng }} title="Inicio">
                <Pin background="#10b981" borderColor="white" glyphColor="white" glyph="A" />
              </AdvancedMarker>
            )}

            {/* End marker */}
            {points.length > 1 && (
              <AdvancedMarker
                position={{ lat: points[points.length - 1].lat, lng: points[points.length - 1].lng }}
                title="Fin"
              >
                <Pin background="#ef4444" borderColor="white" glyphColor="white" glyph="B" />
              </AdvancedMarker>
            )}

            {/* Replay cursor — amber arrow */}
            {currentPoint && (
              <AdvancedMarker position={{ lat: currentPoint.lat, lng: currentPoint.lng }} title="Replay">
                <div style={{ transform: `rotate(${currentPoint.headingDeg ?? 0}deg)` }}>
                  <svg width="28" height="34" viewBox="0 0 28 34" fill="none" aria-hidden="true">
                    <circle cx="14" cy="20" r="9" fill="#f59e0b" stroke="white" strokeWidth="2.5" />
                    <path d="M14 4 L10 14 L14 11 L18 14 Z" fill="#f59e0b" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </div>
              </AdvancedMarker>
            )}
          </GMap>
        </APIProvider>
      </div>
    </div>
  );
}
