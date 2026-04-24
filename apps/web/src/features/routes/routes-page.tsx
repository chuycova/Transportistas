'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Route, X, Trash2, ToggleLeft, ToggleRight, MapPin, Car, Navigation, UserCheck, User, ExternalLink } from 'lucide-react';
import { APIProvider, Map as GMap, AdvancedMarker, Pin, Polyline } from '@vis.gl/react-google-maps';
import { useVehicles } from '../vehicles/use-vehicles';
import { useUsers } from '../users/use-users';
import type { MapMouseEvent } from '@vis.gl/react-google-maps';
import {
  useRoutes,
  useCreateRoute,
  useUpdateRouteStatus,
  useDeleteRoute,
  type RouteRow,
  type Coordinate,
} from './use-routes';
import { AssignDriverModal } from './assign-driver-modal';

const STATUS_META: Record<string, { label: string; className: string }> = {
  active:    { label: 'Activa',      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  inactive:  { label: 'Inactiva',   className: 'bg-muted/30 text-muted-foreground border-border' },
  archived:  { label: 'Archivada',  className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  completed: { label: 'Completada', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
};

function fmtDistance(m: number | null) {
  if (!m) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function fmtDuration(s: number | null) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function decodePolyline(encoded: string): Coordinate[] {
  const pts: Coordinate[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    pts.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return pts;
}

type RoutesApiRoute = { polyline: { encodedPolyline: string }; duration: string; distanceMeters: number };

const DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 };
const ROUTES_API = 'https://routes.googleapis.com/directions/v2:computeRoutes';

// ── Waypoint helpers ─────────────────────────────────────────────────────────

type Waypoint = { id: string; coord: Coordinate; label: string };

function uid() { return Math.random().toString(36).slice(2, 10); }

async function reverseGeocode(coord: Coordinate): Promise<string> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  if (!key) return '';
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coord.lat},${coord.lng}&key=${key}&language=es&result_type=street_address|route|sublocality|locality`
    );
    const data = await res.json() as { results?: { formatted_address: string }[] };
    return data.results?.[0]?.formatted_address ?? '';
  } catch { return ''; }
}

// ── Map drawer (receives unified waypoints[]) ─────────────────────────────────

function RouteMapDrawer({
  waypoints, snappedPath, isCalculating, addingStop, onMapClick, onClear,
}: {
  waypoints: Waypoint[];
  snappedPath: Coordinate[] | null;
  isCalculating: boolean;
  addingStop: boolean;
  onMapClick: (c: Coordinate) => void;
  onClear: () => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const n = waypoints.length;

  const hint = n === 0
    ? 'Haz click en el mapa para colocar el origen'
    : n === 1
    ? 'Ahora coloca el destino'
    : addingStop
    ? 'Haz click en el mapa para agregar la parada'
    : isCalculating
    ? 'Calculando ruta por calles…'
    : null;

  const handleClick = (e: MapMouseEvent) => {
    if (!e.detail.latLng) return;
    onMapClick({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
  };

  const interactive = n < 2 || addingStop;

  const pinColor = (i: number) => i === 0 ? '#10b981' : i === n - 1 ? '#ef4444' : '#6366f1';
  const pinGlyph = (i: number) => i === 0 ? 'A' : i === n - 1 ? 'B' : String(i);
  const pinScale = (i: number) => (i === 0 || i === n - 1) ? 1.2 : 1.0;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border/50">
      {hint && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
          <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs text-white/90 backdrop-blur-sm flex items-center gap-1.5">
            {isCalculating && <span className="h-2.5 w-2.5 animate-spin rounded-full border border-white/30 border-t-white" />}
            {hint}
          </span>
        </div>
      )}
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        {snappedPath && !isCalculating && (
          <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1.5 text-xs text-emerald-400 backdrop-blur-sm shadow-lg">
            <Navigation className="h-3.5 w-3.5" /> Por calles
          </span>
        )}
        {n > 0 && (
          <button type="button" onClick={onClear}
            className="flex items-center gap-1.5 rounded-lg bg-destructive/20 border border-destructive/30 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/30 backdrop-blur-sm transition-colors shadow-lg">
            <X className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
      </div>
      <APIProvider apiKey={apiKey}>
        <GMap
          mapId="DEMO_MAP_ID"
          defaultZoom={12}
          defaultCenter={DEFAULT_CENTER}
          gestureHandling="greedy"
          disableDefaultUI={false}
          onClick={interactive ? handleClick : undefined}
          style={{ width: '100%', height: '100%', cursor: interactive ? 'crosshair' : 'default' }}
        >
          {snappedPath && snappedPath.length >= 2 && (
            <Polyline path={snappedPath} strokeColor="#10b981" strokeWeight={4} strokeOpacity={0.9} />
          )}
          {waypoints.map((w, i) => (
            <AdvancedMarker key={w.id} position={w.coord} title={w.label || `Punto ${i + 1}`}>
              <Pin background={pinColor(i)} borderColor="rgba(255,255,255,0.8)" glyphColor="white" glyph={pinGlyph(i)} scale={pinScale(i)} />
            </AdvancedMarker>
          ))}
        </GMap>
      </APIProvider>
    </div>
  );
}

// ── Create Modal ─────────────────────────────────────────────────────────────

function CreateRouteModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deviationThresholdM, setDeviationThresholdM] = useState('50');
  const [vehicleId, setVehicleId] = useState('');

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [snappedPath, setSnappedPath] = useState<Coordinate[] | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [durationS, setDurationS] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [addingStop, setAddingStop] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);

  const { data: vehicles = [] } = useVehicles();
  const create = useCreateRoute();

  const n = waypoints.length;
  const originLabel = waypoints[0]?.label ?? '';
  const destLabel = waypoints.at(-1)?.label ?? '';
  const canSubmit = Boolean(name.trim() && n >= 2 && originLabel.trim() && destLabel.trim() && snappedPath && !isCalculating);

  // ── Snap logic ──────────────────────────────────────────────────────────────
  const snapRoute = useCallback(async (wps: Waypoint[]) => {
    if (wps.length < 2) return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
    if (!key) return;
    setIsCalculating(true);
    setSnappedPath(null);
    try {
      const orig = wps[0].coord;
      const dest = wps[wps.length - 1].coord;
      const res = await fetch(ROUTES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.duration,routes.distanceMeters' },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: orig.lat, longitude: orig.lng } } },
          destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
          intermediates: wps.slice(1, -1).map((w) => ({ location: { latLng: { latitude: w.coord.lat, longitude: w.coord.lng } } })),
          travelMode: 'DRIVE', polylineQuality: 'HIGH_QUALITY',
        }),
      });
      if (!res.ok) { console.error('Routes API error:', res.status, await res.text()); return; }
      const data = await res.json() as { routes?: RoutesApiRoute[] };
      const route = data.routes?.[0];
      if (route) {
        setSnappedPath(decodePolyline(route.polyline.encodedPolyline));
        setDistanceM(route.distanceMeters ?? 0);
        setDurationS(Number.parseInt(route.duration.replace('s', ''), 10));
      }
    } catch (err) { console.error('Routes API error:', err); }
    finally { setIsCalculating(false); }
  }, []);

  // coordsKey changes only when a coordinate is added/moved/removed — NOT on label edits
  const coordsKey = waypoints.map((w) => `${w.coord.lat.toFixed(6)},${w.coord.lng.toFixed(6)}`).join('|');
  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — coordsKey is a coords-only fingerprint so label edits don't re-trigger snap
  useEffect(() => {
    const wps = waypointsRef.current;
    if (wps.length >= 2) void snapRoute(wps);
    else { setSnappedPath(null); setDistanceM(null); setDurationS(null); }
  }, [coordsKey, snapRoute]);

  // ── Waypoint management ──────────────────────────────────────────────────────
  const addWaypoint = useCallback(async (coord: Coordinate) => {
    const id = uid();
    setWaypoints((prev) => {
      if (prev.length < 2) return [...prev, { id, coord, label: '' }];
      return [...prev.slice(0, -1), { id, coord, label: '' }, prev[prev.length - 1]];
    });
    const label = await reverseGeocode(coord);
    setWaypoints((prev) => prev.map((w) => w.id === id ? { ...w, label } : w));
  }, []);

  const handleMapClick = useCallback((c: Coordinate) => {
    if (n < 2 || addingStop) {
      void addWaypoint(c);
      if (addingStop) setAddingStop(false);
    }
  }, [n, addingStop, addWaypoint]);

  const handleClear = () => {
    setWaypoints([]); setSnappedPath(null); setDistanceM(null); setDurationS(null);
    setAddingStop(false); setDragFrom(null); setDragTo(null);
  };

  const updateLabel = (id: string, label: string) =>
    setWaypoints((prev) => prev.map((w) => w.id === id ? { ...w, label } : w));

  const removeWaypoint = (id: string) =>
    setWaypoints((prev) => prev.filter((w) => w.id !== id));

  // ── Drag-and-drop ────────────────────────────────────────────────────────────
  const onDragStart = (e: React.DragEvent, i: number) => {
    setDragFrom(i);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragTo !== i) setDragTo(i);
  };
  const onDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragFrom !== null && dragFrom !== i) {
      setWaypoints((prev) => {
        const next = [...prev];
        const [item] = next.splice(dragFrom, 1);
        next.splice(i, 0, item);
        return next;
      });
    }
    setDragFrom(null); setDragTo(null);
  };
  const onDragEnd = () => { setDragFrom(null); setDragTo(null); };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !snappedPath) return;
    try {
      await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        polylinePoints: snappedPath,
        originName: originLabel.trim(),
        destinationName: destLabel.trim(),
        deviationThresholdM: Number(deviationThresholdM) || 50,
        totalDistanceM: distanceM ?? undefined,
        estimatedDurationS: durationS ?? undefined,
        vehicleId: vehicleId || undefined,
      });
      onClose();
    } catch { /* error shown via create.error */ }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="flex w-full max-w-5xl h-[88vh] rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden"
      >
        {/* ── Left: Map ── */}
        <div className="flex-1 p-3">
          <RouteMapDrawer
            waypoints={waypoints}
            snappedPath={snappedPath}
            isCalculating={isCalculating}
            addingStop={addingStop}
            onMapClick={handleMapClick}
            onClear={handleClear}
          />
        </div>

        {/* ── Right: Form ── */}
        <form noValidate onSubmit={handleSubmit} className="flex w-80 flex-shrink-0 flex-col border-l border-border/50 bg-background/60">
          <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
            <h3 className="font-semibold">Nueva Ruta</h3>
            <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="space-y-1">
              <label htmlFor="rname" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nombre *</label>
              <input id="rname" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                placeholder="Ruta Centro → AICM" />
            </div>

            <div className="space-y-1">
              <label htmlFor="rdesc" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descripción</label>
              <input id="rdesc" value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                placeholder="Opcional" />
            </div>

            {/* ── Waypoints (drag-and-drop) ── */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Paradas
              </p>

              {n === 0 && (
                <p className="text-[11px] text-muted-foreground/60 text-center py-3 rounded-lg border border-dashed border-border/40">
                  Haz click en el mapa para colocar el origen
                </p>
              )}

              {waypoints.map((w, i) => {
                const isOrigin = i === 0;
                const isDest = i === n - 1 && n >= 2;
                const badgeColor = isOrigin ? 'bg-emerald-500' : isDest ? 'bg-red-500' : 'bg-primary/80';
                const badgeLabel = isOrigin ? 'A' : isDest ? 'B' : String(i);
                const borderPulse = dragTo === i && dragFrom !== i
                  ? 'border-primary/70 ring-1 ring-primary/30'
                  : 'border-border/40';
                const dim = dragFrom === i ? 'opacity-40 scale-[0.98]' : 'opacity-100';
                return (
                  <div
                    key={w.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDrop={(e) => onDrop(e, i)}
                    onDragEnd={onDragEnd}
                    className={`flex items-center gap-2 rounded-lg border bg-card/60 p-2 cursor-grab active:cursor-grabbing transition-all ${borderPulse} ${dim}`}
                  >
                    <svg className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/40" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <circle cx="7" cy="4" r="1.5"/><circle cx="13" cy="4" r="1.5"/>
                      <circle cx="7" cy="10" r="1.5"/><circle cx="13" cy="10" r="1.5"/>
                      <circle cx="7" cy="16" r="1.5"/><circle cx="13" cy="16" r="1.5"/>
                    </svg>
                    <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${badgeColor} text-[10px] font-bold text-white`}>
                      {badgeLabel}
                    </span>
                    <input
                      value={w.label}
                      onChange={(e) => updateLabel(w.id, e.target.value)}
                      placeholder={isOrigin ? 'Nombre del origen' : isDest ? 'Nombre del destino' : 'Nombre de la parada'}
                      className="flex-1 min-w-0 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/50"
                    />
                    {n > 1 && (
                      <button type="button" onClick={() => removeWaypoint(w.id)}
                        className="flex-shrink-0 rounded p-0.5 text-destructive/40 hover:text-destructive transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {n >= 2 && (
                <button type="button" onClick={() => setAddingStop((v) => !v)}
                  className={`w-full rounded-lg border py-1.5 text-xs transition-colors ${addingStop ? 'border-primary/50 bg-primary/10 text-primary' : 'border-dashed border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary'}`}>
                  {addingStop ? '↩ Cancelar parada' : '+ Agregar parada'}
                </button>
              )}

              {isCalculating && (
                <p className="text-[10px] text-primary/80 flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border border-primary/40 border-t-primary" /> Calculando ruta…
                </p>
              )}
              {snappedPath && !isCalculating && (
                <p className="text-[10px] text-emerald-400/90 flex items-center gap-1.5">
                  <Navigation className="h-3 w-3" /> {fmtDistance(distanceM)} · {fmtDuration(durationS)}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="rvehicle" className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Car className="h-3 w-3" /> Vehículo asignado
              </label>
              <select id="rvehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none">
                <option value="">— Sin asignar —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.alias ?? v.plate} ({v.plate})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="rdev" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Umbral de desvío (m)</label>
              <input id="rdev" type="number" min="10" value={deviationThresholdM} onChange={(e) => setDeviationThresholdM(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
            </div>

            {create.error && (
              <p className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                Error: {(create.error as Error).message}
              </p>
            )}
          </div>

          <div className="border-t border-border/50 px-5 py-4 space-y-2">
            {!canSubmit && n >= 2 && (
              <p className="text-[10px] text-muted-foreground/60 text-center">
                {!name.trim() ? 'Escribe un nombre para la ruta' : !originLabel.trim() ? 'Escribe el nombre del origen (A)' : !destLabel.trim() ? 'Escribe el nombre del destino (B)' : isCalculating ? 'Espera a que se calcule la ruta' : !snappedPath ? 'La ruta aún no se calculó' : ''}
              </p>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={!canSubmit || create.isPending}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                {create.isPending ? 'Guardando...' : 'Crear Ruta'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function RoutesPage() {
  const { data: routes = [], isLoading, error } = useRoutes();
  const { data: vehicles = [] } = useVehicles();
  const { data: users = [] } = useUsers();
  const updateStatus = useUpdateRouteStatus();
  const deleteRoute = useDeleteRoute();

  // Lookups client-side para trazabilidad de asignación
  const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
  const userMap    = Object.fromEntries(users.map((u) => [u.id, u]));

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RouteRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<RouteRow | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const stats = {
    total:     routes.length,
    active:    routes.filter((r) => r.status === 'active').length,
    inactive:  routes.filter((r) => r.status === 'inactive').length,
    completed: routes.filter((r) => r.status === 'completed').length,
  };

  const filteredRoutes = statusFilter === 'all'
    ? routes
    : routes.filter((r) => r.status === statusFilter);

  const toggleStatus = (r: RouteRow) =>
    updateStatus.mutate({ id: r.id, status: r.status === 'active' ? 'inactive' : 'active' });

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rutas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Trazados de la flotilla</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" />
          Nueva Ruta
        </button>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: stats.total,     color: 'text-foreground' },
          { label: 'Activas',     value: stats.active,    color: 'text-emerald-400' },
          { label: 'Inactivas',   value: stats.inactive,  color: 'text-muted-foreground' },
          { label: 'Completadas', value: stats.completed, color: 'text-blue-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card/60 p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros por estado */}
      <div className="mb-5 flex gap-1.5">
        {[
          { key: 'all',       label: 'Todas' },
          { key: 'active',    label: 'Activas' },
          { key: 'inactive',  label: 'Inactivas' },
          { key: 'completed', label: 'Completadas' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            {label}
            {key === 'completed' && stats.completed > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-500/20 text-blue-400 px-1 text-[10px] font-bold">
                {stats.completed}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <AnimatePresence>
              {filteredRoutes.map((r) => {
                const meta = STATUS_META[r.status] ?? STATUS_META.inactive;
                const assignedVehicle  = r.vehicle_id ? vehicleMap[r.vehicle_id] : null;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const assignedDriverId = assignedVehicle ? (assignedVehicle as any).assigned_driver_id as string | null : null;
                const assignedDriver   = assignedDriverId ? userMap[assignedDriverId] : null;
                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="group relative flex flex-col gap-2.5 rounded-2xl border border-border/50 bg-card/60 p-4 transition-shadow hover:shadow-lg hover:shadow-black/20"
                  >
                    {/* Header: icono + nombre + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Route className="h-4 w-4" />
                        </div>
                        <p className="font-semibold text-sm leading-tight truncate">{r.name}</p>
                      </div>
                      <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>

                    {/* Origen → Destino */}
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      <span className="text-emerald-400/80">{r.origin_name}</span>
                      <span className="mx-1 text-muted-foreground/40">→</span>
                      <span className="text-red-400/80">{r.dest_name}</span>
                    </p>

                    {/* Badges conductor/vehículo (resumido) */}
                    <div className="flex flex-wrap gap-1.5">
                      {assignedVehicle ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          <Car className="h-2.5 w-2.5" />
                          {assignedVehicle.alias ?? assignedVehicle.plate}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted/20 border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                          Sin vehículo
                        </span>
                      )}
                      {assignedDriver ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <User className="h-2.5 w-2.5" />
                          {assignedDriver.full_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                          Sin conductor
                        </span>
                      )}
                    </div>

                    {/* Stat chips */}
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>{fmtDistance(r.total_distance_m)}</span>
                      <span className="text-border">·</span>
                      <span>{fmtDuration(r.estimated_duration_s)}</span>
                    </div>

                    {/* Footer: ver detalle + acciones quick */}
                    <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-border/30 mt-0.5">
                      <Link
                        href={`/routes/${r.id}`}
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver detalle
                      </Link>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => setAssignTarget(r)}
                          className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] text-primary hover:bg-primary/10 transition-colors"
                        >
                          Asignar
                        </button>
                        <button type="button" onClick={() => toggleStatus(r)}
                          className="rounded-md border border-border/50 px-2 py-1 text-[10px] hover:bg-muted transition-colors"
                        >
                          {r.status === 'active' ? 'Desactivar' : 'Activar'}
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(r)}
                          className="rounded-md border border-destructive/30 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredRoutes.length === 0 && (
            <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 text-muted-foreground">
              <Route className="h-8 w-8 opacity-30" />
              <p className="text-sm">
                {statusFilter === 'all' ? 'Sin rutas registradas' : `Sin rutas ${STATUS_META[statusFilter]?.label.toLowerCase() ?? statusFilter}s`}
              </p>
              {statusFilter === 'all' && (
                <button type="button" onClick={() => setCreateOpen(true)} className="text-xs text-primary hover:underline">
                  Crear la primera ruta
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {createOpen && <CreateRouteModal onClose={() => setCreateOpen(false)} />}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
            >
              <h3 className="font-semibold">Eliminar ruta</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                ¿Confirmas eliminar <span className="font-semibold text-foreground">{deleteTarget.name}</span>?
              </p>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="button"
                  onClick={async () => { await deleteRoute.mutateAsync(deleteTarget.id); setDeleteTarget(null); }}
                  disabled={deleteRoute.isPending}
                  className="flex-1 rounded-lg bg-destructive py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-60">
                  {deleteRoute.isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de asignación de conductor */}
      <AnimatePresence>
        {assignTarget && (() => {
          // Resolver asignación actual del assignTarget para pasarla al modal
          const aVehicle  = assignTarget.vehicle_id ? vehicleMap[assignTarget.vehicle_id] : null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const aDriverId = aVehicle ? (aVehicle as any).assigned_driver_id as string | null : null;
          const aDriver   = aDriverId ? userMap[aDriverId] : null;
          const currentAssignment = (aDriver && aVehicle)
            ? {
                driverId:     aDriverId!,
                driverName:   aDriver.full_name,
                vehiclePlate: (aVehicle as typeof aVehicle & { plate: string }).plate ?? '',
              }
            : null;
          return (
            <AssignDriverModal
              routeId={assignTarget.id}
              routeName={assignTarget.name}
              open={!!assignTarget}
              onClose={() => setAssignTarget(null)}
              currentAssignment={currentAssignment}
            />
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
