'use client';
// ─── features/routes/assign-driver-modal.tsx ─────────────────────────────────
// Modal para asignar o reasignar un conductor a una ruta.
// Si la ruta ya tiene conductor activo lo muestra en un banner y activa el
// flujo de doble confirmación al reasignar.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, UserCheck, Smartphone, Truck, AlertTriangle, CheckCircle2,
  ArrowRight, RotateCcw, ShieldAlert,
} from 'lucide-react';
import { useDrivers } from '../drivers/use-drivers';
import { useVehicles } from '../vehicles/use-vehicles';
import { useAssignDriverToRoute } from './use-routes';

interface CurrentAssignment {
  driverName: string;
  driverId: string;
  vehiclePlate: string;
}

interface AssignDriverModalProps {
  routeId: string;
  routeName: string;
  open: boolean;
  onClose: () => void;
  /** Si la ruta ya tiene conductor asignado, se pasa aquí para mostrarlo */
  currentAssignment?: CurrentAssignment | null;
}

// ── Paso 1: Selección de conductor ────────────────────────────────────────────
// ── Paso 2: Confirmación (solo cuando hay reasignación) ───────────────────────
type Step = 'select' | 'confirm';

export function AssignDriverModal({
  routeId, routeName, open, onClose, currentAssignment,
}: AssignDriverModalProps) {
  const { data: drivers = [], isLoading: driversLoading } = useDrivers();
  const { data: vehicles = [] } = useVehicles();
  const assign = useAssignDriverToRoute();

  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [step, setStep] = useState<Step>('select');
  const [success, setSuccess] = useState(false);

  const isReassignment = !!currentAssignment;

  // Enriquecer conductores con el vehículo que tienen asignado
  const driversWithVehicle = drivers.map((d) => ({
    ...d,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicle: vehicles.find((v) => (v as any).assigned_driver_id === d.id) ?? null,
  }));

  const selectedDriver = driversWithVehicle.find((d) => d.id === selectedDriverId);
  const selectedHasNoVehicle = selectedDriver?.vehicle === null;

  const handleProceed = () => {
    if (!selectedDriverId || selectedHasNoVehicle) return;
    // Si hay reasignación, ir a paso de confirmación; si no, asignar directo
    if (isReassignment && selectedDriverId !== currentAssignment?.driverId) {
      setStep('confirm');
    } else {
      void handleAssign();
    }
  };

  const handleAssign = async () => {
    if (!selectedDriverId) return;
    await assign.mutateAsync({ routeId, driverId: selectedDriverId });
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setSelectedDriverId('');
      setStep('select');
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    setSelectedDriverId('');
    setStep('select');
    setSuccess(false);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        key={step} // re-anima al cambiar de paso
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
              {step === 'confirm'
                ? <><ShieldAlert className="h-4 w-4 text-amber-400" /> Confirmar reasignación</>
                : <><UserCheck className="h-4 w-4 text-primary" /> {isReassignment ? 'Reasignar conductor' : 'Asignar conductor'}</>
              }
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

        <AnimatePresence mode="wait">
          {step === 'select' ? (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* Banner de asignación actual */}
              {currentAssignment && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-primary/15 flex items-center justify-center text-sm font-bold text-primary">
                    {currentAssignment.driverName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Conductor actual</p>
                    <p className="text-sm font-semibold text-foreground truncate">{currentAssignment.driverName}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Truck className="h-2.5 w-2.5" />
                      {currentAssignment.vehiclePlate}
                    </p>
                  </div>
                  <span className="flex-shrink-0 flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Activo
                  </span>
                </div>
              )}

              {/* Separador con flecha si hay reasignación */}
              {currentAssignment && (
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <RotateCcw className="h-3 w-3" />
                  Selecciona el nuevo conductor
                </p>
              )}

              {/* Lista de conductores */}
              {driversLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
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
                    const isCurrent = d.id === currentAssignment?.driverId;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={isCurrent}
                        onClick={() => setSelectedDriverId(d.id)}
                        className={`w-full text-left flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          selectedDriverId === d.id
                            ? 'border-primary/50 bg-primary/10'
                            : isCurrent
                            ? 'border-border/30 bg-muted/10'
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
                            {isCurrent && (
                              <span className="text-[9px] font-bold text-primary/60 bg-primary/10 rounded-full px-1.5 py-0.5">
                                actual
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
                                Sin vehículo
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

              {/* Advertencia: sin vehículo */}
              {selectedDriverId && selectedHasNoVehicle && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-4">
                  <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    Este conductor no tiene un vehículo asignado. Ve a Flotilla y asígnale uno antes de asignar esta ruta.
                  </p>
                </div>
              )}

              {/* Error */}
              {assign.error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-3">
                  {assign.error.message}
                </p>
              )}

              {/* Éxito */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 mb-3"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-medium">Ruta asignada correctamente</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Acciones */}
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
                  onClick={handleProceed}
                  disabled={
                    !selectedDriverId ||
                    assign.isPending ||
                    success ||
                    selectedHasNoVehicle ||
                    selectedDriverId === currentAssignment?.driverId
                  }
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {assign.isPending
                    ? 'Asignando...'
                    : isReassignment
                    ? <><ArrowRight className="h-4 w-4" /> Continuar</>
                    : 'Asignar ruta'
                  }
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── Paso 2: Confirmación de reasignación ── */
            <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="space-y-3 mb-5">
                <p className="text-sm text-muted-foreground">
                  Estás reemplazando la asignación actual. Esta acción es inmediata y el conductor anterior dejará de tener acceso a la ruta en la app móvil.
                </p>

                {/* De → A */}
                <div className="rounded-xl border border-border/50 bg-background/50 p-4 space-y-3">
                  {/* Conductor saliente */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive flex-shrink-0">
                      {currentAssignment!.driverName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground">Conductor que se remueve</p>
                      <p className="text-sm font-semibold text-foreground truncate">{currentAssignment!.driverName}</p>
                    </div>
                    <span className="text-[10px] text-destructive/70 bg-destructive/10 rounded-full px-2 py-0.5 border border-destructive/20">
                      Sale
                    </span>
                  </div>

                  {/* Flecha */}
                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>

                  {/* Conductor entrante */}
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0">
                      {selectedDriver?.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground">Conductor que entra</p>
                      <p className="text-sm font-semibold text-foreground truncate">{selectedDriver?.full_name}</p>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5 border border-emerald-500/20">
                      Entra
                    </span>
                  </div>
                </div>
              </div>

              {/* Error en paso 2 */}
              {assign.error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 mb-3">
                  {assign.error.message}
                </p>
              )}

              {/* Éxito en paso 2 */}
              <AnimatePresence>
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 mb-3"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-medium">Ruta reasignada correctamente</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  disabled={assign.isPending || success}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={() => void handleAssign()}
                  disabled={assign.isPending || success}
                  className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-500/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {assign.isPending
                    ? 'Reasignando...'
                    : <><ShieldAlert className="h-4 w-4" /> Confirmar reasignación</>
                  }
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
