'use client';
// ─── features/routes/assign-driver-modal.tsx ─────────────────────────────────
// Modal para asignar conductores a una ruta.
// Soporta múltiples asignaciones activas simultáneas: cada conductor puede
// tener su propia asignación independiente sobre la misma ruta.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, UserCheck, Smartphone, Truck, AlertTriangle, CheckCircle2,
  Users,
} from 'lucide-react';
import { useDrivers } from '../drivers/use-drivers';
import { useVehicles } from '../vehicles/use-vehicles';
import { useAssignDriverToRoute } from './use-routes';

interface ActiveAssignment {
  driverName: string;
  driverId: string;
  vehiclePlate: string;
}

interface AssignDriverModalProps {
  routeId: string;
  routeName: string;
  open: boolean;
  onClose: () => void;
  /** All current active assignments for the route */
  activeAssignments?: ActiveAssignment[];
}

export function AssignDriverModal({
  routeId, routeName, open, onClose, activeAssignments = [],
}: AssignDriverModalProps) {
  const { data: drivers = [], isLoading: driversLoading, error: driversError } = useDrivers();
  const { data: vehicles = [] } = useVehicles();
  const assign = useAssignDriverToRoute();

  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);

  // Set of driver IDs already assigned to this route
  const assignedDriverIds = new Set(activeAssignments.map((a) => a.driverId));

  // Enriquecer conductores con el vehículo que tienen asignado
  const driversWithVehicle = drivers.map((d) => ({
    ...d,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicle: vehicles.find((v) => (v as any).assigned_driver_id === d.id) ?? null,
  }));

  const selectedDriver = driversWithVehicle.find((d) => d.id === selectedDriverId);
  const selectedHasNoVehicle = selectedDriver?.vehicle === null;
  const isAlreadyAssigned = assignedDriverIds.has(selectedDriverId);

  const handleAssign = async () => {
    if (!selectedDriverId || selectedHasNoVehicle) return;
    await assign.mutateAsync({
      routeId,
      driverId: selectedDriverId,
      notes: notes.trim() || undefined,
    });
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setSelectedDriverId('');
      setNotes('');
      onClose();
    }, 1200);
  };

  const handleClose = () => {
    setSelectedDriverId('');
    setNotes('');
    setSuccess(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" /> Asignar conductor
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">{routeName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Active assignments banner ── */}
        {activeAssignments.length > 0 && (
          <div className="mb-4 rounded-xl border border-border/40 bg-muted/10 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Conductores asignados ({activeAssignments.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {activeAssignments.map((a) => (
                <span
                  key={a.driverId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2 py-1 text-[10px] font-medium text-primary"
                >
                  <span className="h-4 w-4 rounded-md bg-primary/15 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                    {a.driverName.charAt(0).toUpperCase()}
                  </span>
                  {a.driverName}
                  <span className="text-primary/50 text-[9px]">{a.vehiclePlate}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Driver list ── */}
        {driversLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : driversError ? (
          <div className="flex flex-col items-center py-8 gap-2 text-destructive">
            <AlertTriangle className="h-8 w-8 opacity-50" />
            <p className="text-sm font-medium">Error al cargar conductores</p>
            <p className="text-xs opacity-70 text-center max-w-[260px]">
              {driversError.message ?? 'No se pudo conectar con el servidor. Verifica que el API este corriendo.'}
            </p>
          </div>
        ) : drivers.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2 text-muted-foreground">
            <UserCheck className="h-8 w-8 opacity-30" />
            <p className="text-sm">No hay conductores registrados.</p>
            <p className="text-xs opacity-70">Invita conductores desde la pantalla de flotilla.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5 mb-4">
            {driversWithVehicle.map((d) => {
              const isAssigned = assignedDriverIds.has(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDriverId(d.id)}
                  className={`w-full text-left flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                    selectedDriverId === d.id
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border/40 bg-background/40 hover:bg-muted/30'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    selectedDriverId === d.id ? 'bg-primary/20 text-primary' : 'bg-muted/60 text-muted-foreground'
                  }`}>
                    {d.full_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                      {d.full_name}
                      {isAssigned && (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 rounded-full px-1.5 py-0.5 border border-emerald-500/20">
                          asignado
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {d.vehicle ? (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Truck className="h-2.5 w-2.5" />
                          {(d.vehicle as typeof d.vehicle & { plate: string }).plate}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400/70 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Sin vehiculo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className={`flex items-center gap-1 text-[9px] font-bold rounded-full px-1.5 py-0.5 ${
                      d.has_device
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-muted/30 text-muted-foreground'
                    }`}>
                      <Smartphone className="h-2.5 w-2.5" />
                      {d.has_device ? 'App' : 'Sin app'}
                    </div>
                    {!d.is_active && (
                      <span className="text-[9px] text-muted-foreground/50 bg-muted/20 rounded-full px-1.5 py-0.5">
                        Inactivo
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Warning: re-assigning same driver */}
        {isAlreadyAssigned && selectedDriverId && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              Este conductor ya esta asignado a esta ruta. Al asignar de nuevo se creara un nuevo registro de asignacion (la anterior quedara como historial).
            </p>
          </div>
        )}

        {/* Warning: no vehicle */}
        {selectedDriverId && selectedHasNoVehicle && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">
              Este conductor no tiene un vehiculo asignado. Ve a Flotilla y asignale uno antes de asignar esta ruta.
            </p>
          </div>
        )}

        {/* Optional notes */}
        {selectedDriverId && !selectedHasNoVehicle && (
          <div className="mb-4">
            <label htmlFor="assign-notes" className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Notas (opcional)
            </label>
            <input
              id="assign-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Turno vespertino, ruta de prueba..."
              className="mt-1 w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
        )}

        {/* Error */}
        {assign.error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-3">
            {assign.error.message}
          </p>
        )}

        {/* Success */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 mb-3"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Conductor asignado correctamente</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleAssign()}
            disabled={
              !selectedDriverId ||
              assign.isPending ||
              success ||
              selectedHasNoVehicle
            }
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {assign.isPending
              ? 'Asignando...'
              : isAlreadyAssigned
              ? 'Reasignar'
              : 'Asignar ruta'
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}
