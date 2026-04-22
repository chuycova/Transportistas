'use client';
// ─── features/history/historial-page.tsx ─────────────────────────────────────
// Historial con dos vistas:
//   • Principal: Viajes completados (trips con status completed/closed)
//   • Secundaria: Replay de trayecto GPS en mapa, filtrado por vehículo y fechas
//
// NOTA: La app móvil completa VIAJES (trips), no cambia el status de routes.
// Por eso el historial lee de la tabla trips, no de routes.status.

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  APIProvider, Map as GMap, AdvancedMarker, Pin,
  Polyline, useMap,
} from '@vis.gl/react-google-maps';
import {
  Play, Square, RotateCcw, Clock, Truck, AlertTriangle,
  Navigation, Flag, Calendar, MapPin, ChevronRight,
  CheckCircle2, Package,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useVehicles } from '../vehicles/use-vehicles';
import { useTrips } from '../trips/use-trips';
import type { TripRow } from '../trips/use-trips';

const BACKEND_URL     = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const DEFAULT_CENTER  = { lat: 19.4326, lng: -99.1332 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface HistPoint {
  lat: number; lng: number;
  speedKmh?: number; headingDeg?: number;
  isOffRoute: boolean; recordedAt: string;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDuration(startIso: string, endIso: string): string {
  const ms   = new Date(endIso).getTime() - new Date(startIso).getTime();
  const min  = Math.floor(ms / 60_000);
  const h    = Math.floor(min / 60);
  const m    = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function fmtDistance(km: number | null): string {
  if (!km) return '—';
  return km >= 1 ? `${km.toFixed(1)} km` : `${(km * 1000).toFixed(0)} m`;
}

function localDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ─── MapBoundsFitter ──────────────────────────────────────────────────────────

function MapBoundsFitter({ points }: { points: HistPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) { map.setCenter({ lat: points[0].lat, lng: points[0].lng }); map.setZoom(15); return; }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds({ north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) }, 80);
  }, [map, points]);
  return null;
}

// ─── Completed Trip Card ──────────────────────────────────────────────────────

function CompletedTripCard({ trip, onClick }: { trip: TripRow; onClick: () => void }) {
  const duration = trip.started_at && trip.completed_at
    ? fmtDuration(trip.started_at, trip.completed_at)
    : '—';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-4 w-full rounded-2xl border border-border/50 bg-card/60 p-4 text-left transition-all hover:shadow-lg hover:shadow-black/10 hover:border-border/80"
    >
      {/* Icon */}
      <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm truncate">
            {trip.route?.name ?? `${trip.origin_name} → ${trip.dest_name}`}
          </p>
          <span className="flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
            Completado
          </span>
          {trip.code && (
            <span className="text-[10px] text-muted-foreground font-mono">{trip.code}</span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground mt-0.5">
          <span className="text-emerald-400/80">{trip.origin_name}</span>
          <span className="mx-1 text-muted-foreground/40">→</span>
          <span className="text-red-400/80">{trip.dest_name}</span>
        </p>

        {/* Vehicle / Driver */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {trip.vehicle && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {trip.vehicle.alias ?? trip.vehicle.plate}
            </span>
          )}
          {trip.driver && (
            <span className="text-[11px] text-muted-foreground">· {trip.driver.full_name}</span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
          {trip.actual_distance_km != null && (
            <span className="flex items-center gap-1">
              <Navigation className="h-3 w-3" />{fmtDistance(trip.actual_distance_km)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />{duration}
          </span>
          {trip.completed_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />{fmtDate(trip.completed_at)}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="flex-shrink-0 h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1" />
    </button>
  );
}

// ─── Map Replay View ──────────────────────────────────────────────────────────

function MapReplayView({ initialVehicleId }: { initialVehicleId?: string }) {
  const { data: vehicles = [] } = useVehicles();

  const [vehicleId, setVehicleId] = useState(initialVehicleId ?? '');
  const [fromDate, setFromDate]   = useState(localDateString);
  const [toDate, setToDate]       = useState(localDateString);

  const [points, setPoints]         = useState<HistPoint[]>([]);
  const [loading, setLoading]       = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetched, setFetched]       = useState(false);

  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);
  const replayRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const replayIdxRef = useRef(0);

  const stopReplay = useCallback(() => {
    if (replayRef.current) { clearInterval(replayRef.current); replayRef.current = null; }
    setReplaying(false); setReplayIdx(null); replayIdxRef.current = 0;
  }, []);

  const startReplay = useCallback((pts: HistPoint[]) => {
    if (pts.length === 0) return;
    replayIdxRef.current = 0; setReplayIdx(0); setReplaying(true);
    const id = setInterval(() => {
      const next = replayIdxRef.current + 1;
      if (next >= pts.length) { clearInterval(id); replayRef.current = null; setReplaying(false); return; }
      replayIdxRef.current = next; setReplayIdx(next);
    }, 80);
    replayRef.current = id;
  }, []);

  const fetchHistory = async () => {
    if (!vehicleId) return;
    setLoading(true); setFetchError(''); setPoints([]); setFetched(false); stopReplay();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');
      const from = new Date(`${fromDate}T00:00:00`).toISOString();
      const to   = new Date(`${toDate}T23:59:59`).toISOString();
      const res  = await fetch(
        `${BACKEND_URL}/api/v1/tracking/history/${vehicleId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const raw = await res.json() as Array<{
        coordinate: { lat: number; lng: number };
        speedKmh?: number; headingDeg?: number;
        isOffRoute: boolean; recordedAt: string;
      }>;
      setPoints(raw.map((r) => ({
        lat: r.coordinate.lat, lng: r.coordinate.lng,
        speedKmh: r.speedKmh, headingDeg: r.headingDeg,
        isOffRoute: r.isOffRoute, recordedAt: r.recordedAt,
      })));
      setFetched(true);
    } catch (err) { setFetchError((err as Error).message); }
    finally { setLoading(false); }
  };

  const offRouteCount = points.filter((p) => p.isOffRoute).length;
  const currentPoint  = replayIdx !== null ? points[replayIdx] : null;
  const mapCenter     = points.length > 0 ? { lat: points[0].lat, lng: points[0].lng } : DEFAULT_CENTER;
  const fullPath      = points.map((p) => ({ lat: p.lat, lng: p.lng }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-border/50 bg-card/40 px-5 py-3">
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
              {fmtDate(points[0].recordedAt)}&nbsp;
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

      {/* Map */}
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
        <APIProvider apiKey={GOOGLE_MAPS_KEY}>
          <GMap mapId="DEMO_MAP_ID" defaultZoom={13} defaultCenter={mapCenter}
            gestureHandling="greedy" disableDefaultUI={true}
            style={{ width: '100%', height: '100%' }}>
            <MapBoundsFitter points={points} />
            {fullPath.length >= 2 && (
              <Polyline path={fullPath} strokeColor="#6366f1" strokeWeight={3} strokeOpacity={0.65} />
            )}
            {points.filter((p) => p.isOffRoute).map((p, i) => (
              <AdvancedMarker key={`off-${i}`} position={{ lat: p.lat, lng: p.lng }} title="Fuera de ruta">
                <div className="h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500 shadow" />
              </AdvancedMarker>
            ))}
            {points.length > 0 && (
              <AdvancedMarker position={{ lat: points[0].lat, lng: points[0].lng }} title="Inicio">
                <Pin background="#10b981" borderColor="white" glyphColor="white" glyph="A" />
              </AdvancedMarker>
            )}
            {points.length > 1 && (
              <AdvancedMarker position={{ lat: points[points.length - 1].lat, lng: points[points.length - 1].lng }} title="Fin">
                <Pin background="#ef4444" borderColor="white" glyphColor="white" glyph="B" />
              </AdvancedMarker>
            )}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export function HistorialPage() {
  const { data: trips = [], isLoading } = useTrips();
  const completedTrips = trips.filter(
    (t) => t.status === 'completed' || t.status === 'closed'
  );

  const [view, setView] = useState<'trips' | 'map'>('trips');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();

  const handleOpenMap = (trip: TripRow) => {
    setSelectedVehicleId(trip.vehicle_id ?? undefined);
    setView('map');
  };

  // Aggregate stats
  const totalDistKm = completedTrips.reduce((s, t) => s + (t.actual_distance_km ?? t.estimated_distance_km ?? 0), 0);
  const totalDurMin = completedTrips.reduce((s, t) => {
    if (!t.started_at || !t.completed_at) return s;
    return s + (new Date(t.completed_at).getTime() - new Date(t.started_at).getTime()) / 60_000;
  }, 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header / tab bar */}
      <div className="flex-shrink-0 border-b border-border/50 bg-card/60 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {view === 'trips' ? <Flag className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
          </div>
          <h1 className="text-sm font-bold">Historial</h1>
        </div>

        {/* Segmented tabs */}
        <div className="flex gap-1 rounded-lg border border-border/50 bg-muted/20 p-0.5">
          <button
            type="button"
            onClick={() => setView('trips')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              view === 'trips'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Viajes completados
            {completedTrips.length > 0 && (
              <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-1.5 text-[10px] font-bold">
                {completedTrips.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setView('map')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              view === 'map'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Navigation className="h-3.5 w-3.5" />
            Replay en mapa
          </button>
        </div>
      </div>

      {/* ── Vista: Viajes completados ── */}
      {view === 'trips' && (
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
            </div>
          )}

          {!isLoading && completedTrips.length === 0 && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <Package className="h-12 w-12 opacity-15" />
              <p className="text-sm font-medium">Sin viajes completados aún</p>
              <p className="text-xs text-muted-foreground/60 text-center max-w-xs">
                Los viajes completados por los conductores desde la app móvil aparecerán aquí.
              </p>
            </div>
          )}

          {!isLoading && completedTrips.length > 0 && (
            <>
              {/* Aggregate stats */}
              <div className="mb-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Viajes completados', value: completedTrips.length, unit: '', color: 'text-emerald-400' },
                  { label: 'Distancia total', value: totalDistKm.toFixed(1), unit: ' km', color: 'text-foreground' },
                  { label: 'Tiempo en ruta', value: totalDurMin >= 60 ? `${Math.floor(totalDurMin / 60)}h ${Math.round(totalDurMin % 60)}m` : `${Math.round(totalDurMin)} min`, unit: '', color: 'text-foreground' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border/50 bg-card/60 p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}{s.unit}</p>
                  </div>
                ))}
              </div>

              {/* Trip list */}
              <div className="flex flex-col gap-2">
                {completedTrips.map((trip) => (
                  <CompletedTripCard
                    key={trip.id}
                    trip={trip}
                    onClick={() => handleOpenMap(trip)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Vista: Replay en mapa ── */}
      {view === 'map' && (
        <div className="flex-1 overflow-hidden">
          <MapReplayView initialVehicleId={selectedVehicleId} />
        </div>
      )}
    </div>
  );
}
