// Bottom sheet snap points.
//   Índices de snap:  0 = colapsado  |  1 = medio  |  2 = expandido
export const SNAP_IDLE     = ['40%'];               // Sin tracking: solo un punto de snap
export const SNAP_TRACKING = ['15%', '42%', '68%']; // Tracking: mini | medio | expandido
export const SNAP_PAUSED   = ['24%'];               // Pausado: standby compacto con botón Reanudar

// Tiempo que el conductor debe mantener el botón SOS antes de disparar el pánico.
export const PANIC_HOLD_MS = 5000;
