'use client';
// ─── features/geofences/geofences-page.tsx ───────────────────────────────────
// Gestión de geocercas. Permite dibujar polígonos en el mapa, configurar
// alertas de entrada/salida y ver la lista de geocercas activas.

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  APIProvider,
  Map as GMap,
  AdvancedMarker,
  useMap,
} from '@vis.gl/react-google-maps';
import type { MapMouseEvent } from '@vis.gl/react-google-maps';
import {
  ShieldAlert, Plus, Trash2, Edit2, ToggleLeft, ToggleRight,
  Check, X, MapPin, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useGeofences,
  useCreateGeofence,
  useUpdateGeofence,
  useDeleteGeofence,
  useToggleGeofence,
  type Geofence,
  type GeofenceType,
  type CreateGeofenceInput,
} from './use-geofences';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// ─── Constantes de tipo ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<GeofenceType, string> = {
  base:       'Base',
  client:     'Cliente',
  risk_zone:  'Zona de Riesgo',
  restricted: 'Restringida',
  generic:    'Genérica',
};

const TYPE_COLORS: Record<GeofenceType, string> = {
  base:       'bg-blue-500/20 text-blue-400 border-blue-500/40',
  client:     'bg-green-500/20 text-green-400 border-green-500/40',
  risk_zone:  'bg-red-500/20 text-red-400 border-red-500/40',
  restricted: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  generic:    'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
};

const DEFAULT_COLORS: Record<GeofenceType, string> = {
  base:       '#3B82F6',
  client:     '#22C55E',
  risk_zone:  '#EF4444',
  restricted: '#F97316',
  generic:    '#6C63FF',
};

// ─── Componente de polígono imperativo ────────────────────────────────────────
// @vis.gl/react-google-maps no tiene un componente Polygon declarativo robusto,
// así que usamos una instancia imperativa de google.maps.Polygon.

function GeofencePolygon({
  coords,
  color,
  clickable = false,
  onClick,
}: {
  coords: [number, number][];
  color: string;
  clickable?: boolean;
  onClick?: () => void;
}) {
  const map = useMap();
  const polyRef = useRef<google.maps.Polygon | null>(null);
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null);

  useEffect(() => {
    if (!map) return;

    const paths = coords.map(([lng, lat]) => ({ lat, lng }));

    if (!polyRef.current) {
      polyRef.current = new google.maps.Polygon({
        paths,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 0.15,
        clickable,
        map,
      });
    } else {
      polyRef.current.setPaths(paths);
      polyRef.current.setOptions({ strokeColor: color, fillColor: color, clickable });
      polyRef.current.setMap(map);
    }

    // Re-registrar listener de click
    if (listenerRef.current) {
      listenerRef.current.remove();
      listenerRef.current = null;
    }
    if (onClick && polyRef.current) {
      listenerRef.current = polyRef.current.addListener('click', onClick);
    }

    return () => {
      listenerRef.current?.remove();
      listenerRef.current = null;
      polyRef.current?.setMap(null);
      polyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Actualizar coords/color/clickable sin recrear el polígono
  useEffect(() => {
    if (!polyRef.current) return;
    const paths = coords.map(([lng, lat]) => ({ lat, lng }));
    polyRef.current.setPaths(paths);
    polyRef.current.setOptions({ strokeColor: color, fillColor: color, clickable });
  }, [coords, color, clickable]);

  // Actualizar onClick listener
  useEffect(() => {
    if (!polyRef.current) return;
    if (listenerRef.current) {
      listenerRef.current.remove();
      listenerRef.current = null;
    }
    if (onClick) {
      listenerRef.current = polyRef.current.addListener('click', onClick);
    }
  }, [onClick]);

  return null;
}

// ─── Formulario de creación/edición ──────────────────────────────────────────

interface GeofenceForm {
  name: string;
  description: string;
  type: GeofenceType;
  color: string;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
}

const EMPTY_FORM: GeofenceForm = {
  name: '',
  description: '',
  type: 'generic',
  color: DEFAULT_COLORS.generic,
  alert_on_enter: true,
  alert_on_exit: true,
};

// ─── Página principal ─────────────────────────────────────────────────────────

export function GeofencesPage() {
  const { data: geofences = [], isLoading } = useGeofences();
  const createGeofence = useCreateGeofence();
  const updateGeofence = useUpdateGeofence();
  const deleteGeofence = useDeleteGeofence();
  const toggleGeofence = useToggleGeofence();

  // Estado del formulario / modo
  const [mode, setMode] = useState<'list' | 'drawing' | 'editing'>('list');
  const [form, setForm] = useState<GeofenceForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ─── Dibujar polígono al hacer click en el mapa ───────────────────────────

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (mode !== 'drawing') return;
      const lat = e.detail.latLng?.lat;
      const lng = e.detail.latLng?.lng;
      if (lat === undefined || lng === undefined) return;
      setDrawingPoints((prev) => [...prev, [lng, lat]]);
    },
    [mode],
  );

  const startDrawing = () => {
    setMode('drawing');
    setDrawingPoints([]);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const cancelDrawing = () => {
    setMode('list');
    setDrawingPoints([]);
    setEditingId(null);
  };

  const undoLastPoint = () => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  };

  const handleTypeChange = (type: GeofenceType) => {
    setForm((f) => ({ ...f, type, color: DEFAULT_COLORS[type] }));
  };

  // ─── Guardar geocerca ─────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    if (drawingPoints.length < 3) {
      toast.error('Dibuja al menos 3 puntos en el mapa');
      return;
    }

    // Cerrar el polígono (repetir el primer punto)
    const closed: [number, number][] = [...drawingPoints];
    if (
      closed[0][0] !== closed[closed.length - 1][0] ||
      closed[0][1] !== closed[closed.length - 1][1]
    ) {
      closed.push(closed[0]);
    }

    const input: CreateGeofenceInput = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      type: form.type,
      color: form.color,
      polygon_coords: closed,
      alert_on_enter: form.alert_on_enter,
      alert_on_exit: form.alert_on_exit,
    };

    try {
      if (editingId) {
        await updateGeofence.mutateAsync({ id: editingId, ...input });
        toast.success('Geocerca actualizada');
      } else {
        await createGeofence.mutateAsync(input);
        toast.success('Geocerca creada');
      }
      setMode('list');
      setDrawingPoints([]);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error((err as Error).message ?? 'Error al guardar geocerca');
    }
  };

  // ─── Editar geocerca ──────────────────────────────────────────────────────

  const handleEdit = (gf: Geofence) => {
    setEditingId(gf.id);
    setForm({
      name: gf.name,
      description: gf.description ?? '',
      type: gf.type,
      color: gf.color,
      alert_on_enter: gf.alert_on_enter,
      alert_on_exit: gf.alert_on_exit,
    });
    // Quitar el punto de cierre del polígono (si está duplicado)
    const pts = gf.polygon_coords;
    const open =
      pts.length > 1 &&
      pts[0][0] === pts[pts.length - 1][0] &&
      pts[0][1] === pts[pts.length - 1][1]
        ? pts.slice(0, -1)
        : pts;
    setDrawingPoints(open);
    setMode('drawing');
  };

  // ─── Eliminar geocerca ────────────────────────────────────────────────────

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la geocerca "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteGeofence.mutateAsync(id);
      toast.success('Geocerca eliminada');
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      toast.error((err as Error).message ?? 'Error al eliminar');
    }
  };

  // ─── Toggle activo ────────────────────────────────────────────────────────

  const handleToggle = async (gf: Geofence) => {
    try {
      await toggleGeofence.mutateAsync({ id: gf.id, is_active: !gf.is_active });
    } catch (err) {
      toast.error((err as Error).message ?? 'Error al cambiar estado');
    }
  };

  const isDrawingMode = mode === 'drawing';
  const isSaving = createGeofence.isPending || updateGeofence.isPending;

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ── Panel lateral ─────────────────────────────────────────────────── */}
      <aside className="w-80 flex-shrink-0 flex flex-col border-r border-border/50 bg-card/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <h1 className="text-base font-semibold text-foreground">Geocercas</h1>
          </div>
          {mode === 'list' && (
            <button
              type="button"
              onClick={startDrawing}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva
            </button>
          )}
        </div>

        {/* Formulario de creación/edición */}
        {isDrawingMode && (
          <div className="flex flex-col gap-3 px-4 py-4 border-b border-border/50 bg-card/60">
            <p className="text-xs text-muted-foreground">
              {drawingPoints.length < 3
                ? `Haz click en el mapa para añadir vértices (${drawingPoints.length}/3 mínimo)`
                : `${drawingPoints.length} vértices — puedes continuar añadiendo o guardar`}
            </p>

            <input
              type="text"
              placeholder="Nombre de la geocerca *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <input
              type="text"
              placeholder="Descripción (opcional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <select
              value={form.type}
              onChange={(e) => handleTypeChange(e.target.value as GeofenceType)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {(Object.keys(TYPE_LABELS) as GeofenceType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Color:</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="h-8 w-14 cursor-pointer rounded border border-border bg-transparent"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.alert_on_enter}
                onChange={(e) => setForm((f) => ({ ...f, alert_on_enter: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-xs text-foreground">Alerta al entrar</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.alert_on_exit}
                onChange={(e) => setForm((f) => ({ ...f, alert_on_exit: e.target.checked }))}
                className="rounded border-border"
              />
              <span className="text-xs text-foreground">Alerta al salir</span>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={undoLastPoint}
                disabled={drawingPoints.length === 0}
                className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
              >
                ↩ Deshacer
              </button>
              <button
                type="button"
                onClick={cancelDrawing}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || drawingPoints.length < 3 || !form.name.trim()}
                className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {isSaving ? 'Guardando…' : <><Check className="h-3.5 w-3.5 inline mr-1" />Guardar</>}
              </button>
            </div>
          </div>
        )}

        {/* Lista de geocercas */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Cargando…
            </div>
          ) : geofences.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-6">
              <ShieldAlert className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                Sin geocercas. Crea una para empezar a detectar entradas y salidas.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {geofences.map((gf) => (
                <GeofenceListItem
                  key={gf.id}
                  geofence={gf}
                  isSelected={selectedId === gf.id}
                  onSelect={() => setSelectedId(selectedId === gf.id ? null : gf.id)}
                  onEdit={() => handleEdit(gf)}
                  onDelete={() => handleDelete(gf.id, gf.name)}
                  onToggle={() => handleToggle(gf)}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Mapa ──────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        {!GOOGLE_MAPS_KEY ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <MapPin className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Configura <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> para habilitar el mapa.
            </p>
          </div>
        ) : (
          <APIProvider apiKey={GOOGLE_MAPS_KEY}>
            <GMap
              mapId="geofences-map"
              defaultCenter={{ lat: 20.6597, lng: -103.3496 }}
              defaultZoom={12}
              gestureHandling="greedy"
              disableDefaultUI={false}
              onClick={handleMapClick}
              style={{ width: '100%', height: '100%' }}
              mapTypeId="roadmap"
            >
              {/* Polígonos de geocercas existentes */}
              {geofences.map((gf) => (
                <GeofencePolygon
                  key={gf.id}
                  coords={gf.polygon_coords}
                  color={selectedId === gf.id ? '#FFFFFF' : gf.color}
                  clickable
                  onClick={() => setSelectedId(selectedId === gf.id ? null : gf.id)}
                />
              ))}

              {/* Polígono en construcción */}
              {isDrawingMode && drawingPoints.length >= 2 && (
                <GeofencePolygon
                  coords={[...drawingPoints, drawingPoints[0]]}
                  color={form.color}
                />
              )}

              {/* Marcadores de los puntos en construcción */}
              {isDrawingMode &&
                drawingPoints.map(([lng, lat], i) => (
                  <AdvancedMarker
                    key={i}
                    position={{ lat, lng }}
                    title={`Punto ${i + 1}`}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: i === 0 ? '#22C55E' : form.color,
                        border: '2px solid white',
                        boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                      }}
                    />
                  </AdvancedMarker>
                ))}
            </GMap>

            {/* Hint de dibujo */}
            {isDrawingMode && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-4 py-2 rounded-full backdrop-blur-sm pointer-events-none">
                Haz click en el mapa para agregar vértices • Primer punto (verde) cierra el polígono
              </div>
            )}
          </APIProvider>
        )}
      </div>
    </div>
  );
}

// ─── Item de lista ────────────────────────────────────────────────────────────

function GeofenceListItem({
  geofence: gf,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onToggle,
}: {
  geofence: Geofence;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <li
      className={`px-4 py-3 cursor-pointer transition-colors ${
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Color swatch */}
          <div
            className="h-3 w-3 rounded-full flex-shrink-0 mt-0.5"
            style={{ backgroundColor: gf.color }}
          />
          <div className="min-w-0">
            <p
              className={`text-sm font-medium truncate ${
                gf.is_active ? 'text-foreground' : 'text-muted-foreground line-through'
              }`}
            >
              {gf.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  TYPE_COLORS[gf.type]
                }`}
              >
                {TYPE_LABELS[gf.type]}
              </span>
              {gf.alert_on_enter && (
                <span className="text-[10px] text-emerald-400">↓ entrada</span>
              )}
              {gf.alert_on_exit && (
                <span className="text-[10px] text-amber-400">↑ salida</span>
              )}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onToggle}
            title={gf.is_active ? 'Desactivar' : 'Activar'}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            {gf.is_active
              ? <ToggleRight className="h-4 w-4 text-primary" />
              : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onEdit}
            title="Editar"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar"
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {gf.description && isSelected && (
        <p className="text-xs text-muted-foreground mt-1.5 ml-5">{gf.description}</p>
      )}
    </li>
  );
}
