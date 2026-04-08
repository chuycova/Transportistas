'use client';
// ─── features/routes/assign-driver-modal.tsx ─────────────────────────────────
// Modal para que un monitor asigne un conductor a una ruta.
// Muestra la lista de conductores del tenant con badge de dispositivo y
// vehículo asignado, permitiendo seleccionar quién recibirá la ruta.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, UserCheck, Smartphone, Truck, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useDrivers } from '../drivers/use-drivers';
import { useVehicles } from '../vehicles/use-vehicles';
import { useAssignDriverToRoute } from './use-routes';

interface AssignDriverModalProps {
  routeId: string;
  routeName: string;
  open: boolean;
  onClose: () => void;
}

export function AssignDriverModal({
  routeId, routeName, open, onClose,
}: AssignDriverModalProps) {
  const { data: drivers = [], isLoading: driversLoading } = useDrivers();
  const { data: vehicles = [] } = useVehicles();
  const assign = useAssignDriverToRoute();

  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [success, setSuccess] = useState(false);

  const handleAssign = async () => {
    if (!selectedDriverId) return;
    await assign.mutateAsync({ routeId, driverId: selectedDriverId });
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setSelectedDriverId('');
      onClose();
    }, 1500);
  };

  // Enriquecer conductores con el vehículo que tienen asignado
  const driversWithVehicle = drivers.map((d) => ({
    ...d,
    vehicle: vehicles.find(
      (v) => (v as typeof v & { assigned_driver_id?: string }).assigned_driver_id === d.id,
    ) ?? null,
  }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold">Asignar conductor</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">{routeName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

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
          <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5 mb-4">
            {driversWithVehicle.map((d) => (
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
                  <p className="text-sm font-semibold text-foreground truncate">{d.full_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {d.vehicle ? (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Truck className="h-2.5 w-2.5" />
                        {d.vehicle.plate}
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
            ))}
          </div>
        )}

        {/* Advertencia: conductor sin vehículo */}
        {selectedDriverId && driversWithVehicle.find((d) => d.id === selectedDriverId)?.vehicle === null && (
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
            onClick={onClose}
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
              driversWithVehicle.find((d) => d.id === selectedDriverId)?.vehicle === null
            }
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {assign.isPending ? 'Asignando...' : 'Asignar ruta'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
