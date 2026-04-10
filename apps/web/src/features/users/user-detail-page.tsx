'use client';
// ─── features/users/user-detail-page.tsx ─────────────────────────────────────
// Detalle de un usuario: edición de cuenta + historial de vehículos, rutas y alertas.

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Mail, Phone, Truck, Route, Bell,
  User, Shield, Smartphone, CheckCircle2, Circle,
  Check, Eye, EyeOff, Copy, RefreshCw, Wand2,
  ChevronDown, AlertTriangle, Info, Siren,
  MapPin, Clock, Calendar,
} from 'lucide-react';
import {
  useUserDetail, useUpdateUser, useUserVehicleHistory,
  useUserRouteHistory, useUserAlertHistory,
} from './use-users';

// ─── Utilidades ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; className: string }> = {
  admin:       { label: 'Admin',       className: 'bg-primary/10 text-primary border-primary/30' },
  super_admin: { label: 'Super Admin', className: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  operator:    { label: 'Operador',    className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  driver:      { label: 'Conductor',   className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
};

const ALERT_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  off_route:        { label: 'Desvío de ruta',    icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  speeding:         { label: 'Exceso de velocidad', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  emergency:        { label: 'Botón de pánico',   icon: <Siren className="h-3.5 w-3.5" /> },
  geofence_entry:   { label: 'Entrada a geocerca', icon: <MapPin className="h-3.5 w-3.5" /> },
  geofence_exit:    { label: 'Salida de geocerca', icon: <MapPin className="h-3.5 w-3.5" /> },
  long_stop:        { label: 'Parada prolongada',  icon: <Clock className="h-3.5 w-3.5" /> },
  signal_lost:      { label: 'Señal perdida',      icon: <Info className="h-3.5 w-3.5" /> },
  signal_recovered: { label: 'Señal recuperada',   icon: <Info className="h-3.5 w-3.5" /> },
  arrived_stop:     { label: 'Llegó a parada',     icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  route_completed:  { label: 'Ruta completada',    icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
};

const SEVERITY_COLORS: Record<string, string> = {
  info:     'text-blue-400 bg-blue-500/10 border-blue-500/30',
  warning:  'text-amber-400 bg-amber-500/10 border-amber-500/30',
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: 'Activa',     color: 'text-emerald-400' },
  inactive:  { label: 'Inactiva',   color: 'text-muted-foreground' },
  completed: { label: 'Completada', color: 'text-blue-400' },
  cancelled: { label: 'Cancelada',  color: 'text-red-400' },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDistance(m: number | null) {
  if (!m) return '—';
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)} km`;
}

function UserAvatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'h-16 w-16 text-2xl' : size === 'md' ? 'h-10 w-10 text-base' : 'h-7 w-7 text-xs';
  return (
    <div className={`${sz} rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Tab types ────────────────────────────────────────────────────────────────
type Tab = 'cuenta' | 'vehiculos' | 'rutas' | 'alertas';

// ─── Password helpers ─────────────────────────────────────────────────────────
const PWD_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PWD_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const PWD_DIGIT = '0123456789';
const PWD_SPECIAL = '!@#$%&*?+-=_';

function generatePassword(length: number): string {
  const pool = PWD_UPPER + PWD_LOWER + PWD_DIGIT + PWD_SPECIAL;
  const mandatory = [
    PWD_UPPER[Math.floor(Math.random() * PWD_UPPER.length)],
    PWD_LOWER[Math.floor(Math.random() * PWD_LOWER.length)],
    PWD_DIGIT[Math.floor(Math.random() * PWD_DIGIT.length)],
    PWD_SPECIAL[Math.floor(Math.random() * PWD_SPECIAL.length)],
  ];
  const rest = Array.from({ length: length - 4 }, () => pool[Math.floor(Math.random() * pool.length)]);
  const all = [...mandatory, ...rest];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j] as string, all[i] as string];
  }
  return all.join('');
}

function getPwdChecks(pwd: string) {
  return [
    { label: 'Mínimo 10 caracteres', ok: pwd.length >= 10 },
    { label: 'Mayúscula (A-Z)',       ok: /[A-Z]/.test(pwd) },
    { label: 'Minúscula (a-z)',       ok: /[a-z]/.test(pwd) },
    { label: 'Número (0-9)',          ok: /[0-9]/.test(pwd) },
    { label: 'Carácter especial',     ok: /[^A-Za-z0-9]/.test(pwd) },
  ];
}

// ─── Cuenta Tab ───────────────────────────────────────────────────────────────
function CuentaTab({ userId }: { userId: string }) {
  const { data: user, isLoading } = useUserDetail(userId);
  const updateUser = useUpdateUser();

  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [role, setRole]         = useState('');
  const [changePwd, setChangePwd] = useState(false);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const [genOpen, setGenOpen]   = useState(false);
  const [genLen, setGenLen]     = useState(12);
  const [saved, setSaved]       = useState(false);

  // Inicializar form cuando carga el usuario
  const [initialized, setInitialized] = useState(false);
  if (user && !initialized) {
    setName(user.full_name);
    setPhone(user.phone ?? '');
    setRole(user.role);
    setInitialized(true);
  }

  const pwdChecks = getPwdChecks(password);
  const pwdOk = !changePwd || pwdChecks.every((c) => c.ok);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pwdOk || !user) return;
    await updateUser.mutateAsync({
      id: userId,
      full_name: name,
      phone: phone || undefined,
      role,
      ...(changePwd && password ? { password } : {}),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (isLoading || !user) {
    return <div className="flex h-40 items-center justify-center"><div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Info de solo lectura */}
      <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Información de cuenta</p>
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-foreground">{user.email ?? 'Sin correo registrado'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className={user.has_device ? 'text-emerald-400' : 'text-muted-foreground'}>
            {user.has_device ? 'App móvil instalada' : 'Sin app móvil'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className={user.is_active ? 'text-emerald-400' : 'text-red-400'}>
            {user.is_active ? 'Cuenta activa' : 'Cuenta desactivada'}
          </span>
        </div>
      </div>

      {/* Formulario editable */}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="ud-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Nombre completo *
          </label>
          <input id="ud-name" required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="ud-phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Teléfono</label>
            <input id="ud-phone" placeholder="+52 555 000 0000" value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
          </div>
          <div className="space-y-1">
            <label htmlFor="ud-role" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rol</label>
            <div className="relative">
              <select id="ud-role" value={role} onChange={(e) => setRole(e.target.value)}
                className="w-full appearance-none rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none">
                <option value="driver">Conductor</option>
                <option value="operator">Operador</option>
                <option value="admin">Admin</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Cambiar contraseña */}
        <div className="rounded-xl border border-border/40 bg-background/30 p-3 space-y-2">
          <button type="button" onClick={() => { setChangePwd((v) => !v); setPassword(''); }}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left">
            <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${changePwd ? 'bg-primary border-primary' : 'border-border'}`}>
              {changePwd && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            Cambiar contraseña
          </button>

          <AnimatePresence>
            {changePwd && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden space-y-2">
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••" className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 pr-16 text-sm font-mono focus:border-primary/50 focus:outline-none" />
                  <div className="absolute right-2 top-1.5 flex items-center gap-0.5">
                    {password && (
                      <button type="button" onClick={() => void handleCopy()} className="rounded p-1 text-muted-foreground hover:text-foreground">
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button type="button" onClick={() => setShowPwd((v) => !v)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                      {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                {password.length > 0 && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {pwdChecks.map((c) => (
                      <div key={c.label} className={`flex items-center gap-1 text-[10px] ${c.ok ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                        {c.ok ? <CheckCircle2 className="h-3 w-3 flex-shrink-0" /> : <Circle className="h-3 w-3 flex-shrink-0" />}
                        {c.label}
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => setGenOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors">
                  <Wand2 className="h-3 w-3" />
                  {genOpen ? 'Ocultar generador' : 'Generar contraseña segura'}
                </button>
                <AnimatePresence>
                  {genOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                      <div className="rounded-xl border border-border/40 bg-background/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-muted-foreground">Longitud: <span className="font-bold text-foreground">{genLen}</span></p>
                          <button type="button" onClick={() => setPassword(generatePassword(genLen))}
                            className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors">
                            <RefreshCw className="h-3 w-3" /> Generar
                          </button>
                        </div>
                        <input type="range" min={10} max={24} value={genLen} onChange={(e) => setGenLen(Number(e.target.value))}
                          className="w-full accent-primary h-1.5 cursor-pointer" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {updateUser.error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {(updateUser.error as Error).message}
          </p>
        )}

        <button type="submit" disabled={updateUser.isPending || !pwdOk}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
          {updateUser.isPending ? 'Guardando...' : saved ? <><Check className="h-4 w-4" /> Guardado</> : 'Guardar Cambios'}
        </button>
      </form>
    </div>
  );
}

// ─── Vehículos Tab ────────────────────────────────────────────────────────────
function VehiculosTab({ userId }: { userId: string }) {
  const { data = [], isLoading } = useUserVehicleHistory(userId);

  if (isLoading) return <LoadingSpinner />;

  if (!data.length) {
    return (
      <EmptyState icon={<Truck className="h-10 w-10" />} text="Sin historial de vehículos asignados" />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{data.length} asignación{data.length !== 1 ? 'es' : ''} en total</p>
      <div className="space-y-2">
        {data.map((a) => (
          <div key={a.id} className="flex items-center gap-4 rounded-xl border border-border/40 bg-card/40 px-4 py-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${a.vehicle?.color ?? '#6366f1'}22` }}>
              <Truck className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-mono font-bold text-sm">{a.vehicle?.plate ?? '—'}</p>
              <p className="text-xs text-muted-foreground truncate">
                {a.vehicle?.alias ?? [a.vehicle?.brand, a.vehicle?.model].filter(Boolean).join(' ') ?? a.vehicle?.vehicle_type ?? '—'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground">{fmtDate(a.assigned_at)}</p>
              {a.unassigned_at && (
                <p className="text-[10px] text-muted-foreground/60">hasta {fmtDate(a.unassigned_at)}</p>
              )}
            </div>
            <div className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              a.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-muted/20 text-muted-foreground border-border'
            }`}>
              {a.is_active ? 'Activo' : 'Histórico'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Rutas Tab ────────────────────────────────────────────────────────────────
function RutasTab({ userId }: { userId: string }) {
  const { data = [], isLoading } = useUserRouteHistory(userId);

  if (isLoading) return <LoadingSpinner />;

  if (!data.length) {
    return <EmptyState icon={<Route className="h-10 w-10" />} text="Sin rutas registradas" />;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{data.length} ruta{data.length !== 1 ? 's' : ''} registradas</p>
      <div className="space-y-2">
        {data.map((r) => {
          const status = STATUS_LABELS[r.status] ?? { label: r.status, color: 'text-muted-foreground' };
          return (
            <div key={r.id} className="rounded-xl border border-border/40 bg-card/40 px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate">{r.name}</p>
                <span className={`text-[10px] font-bold flex-shrink-0 ${status.color}`}>{status.label}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {r.origin_name} → {r.dest_name}
                </span>
                {r.total_distance_m && (
                  <span>{fmtDistance(r.total_distance_m)}</span>
                )}
                {r.vehicle_plate && (
                  <span className="font-mono font-bold text-foreground/60">{r.vehicle_plate}</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {fmtDate(r.created_at)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Alertas Tab ──────────────────────────────────────────────────────────────
function AlertasTab({ userId }: { userId: string }) {
  const { data = [], isLoading } = useUserAlertHistory(userId);

  if (isLoading) return <LoadingSpinner />;

  if (!data.length) {
    return <EmptyState icon={<Bell className="h-10 w-10" />} text="Sin alertas registradas" />;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{data.length} alerta{data.length !== 1 ? 's' : ''} registradas</p>
      <div className="space-y-2">
        {data.map((a) => {
          const alertInfo = ALERT_LABELS[a.alert_type] ?? { label: a.alert_type, icon: <Bell className="h-3.5 w-3.5" /> };
          const severityClass = SEVERITY_COLORS[a.severity] ?? SEVERITY_COLORS.info;
          return (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-border/40 bg-card/40 px-4 py-3">
              <div className={`mt-0.5 rounded-lg p-1.5 border ${severityClass} flex-shrink-0`}>
                {alertInfo.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{alertInfo.label}</p>
                  {a.is_resolved && (
                    <span className="text-[10px] text-emerald-400 font-bold flex-shrink-0">Resuelta</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.vehicle_plate && <span className="font-mono font-bold text-foreground/60 mr-2">{a.vehicle_plate}</span>}
                  {fmtDateTime(a.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground/40">
      {icon}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export function UserDetailPage({ userId }: { userId: string }) {
  const { data: user, isLoading } = useUserDetail(userId);
  const [activeTab, setActiveTab] = useState<Tab>('cuenta');

  const role = user ? (ROLE_LABELS[user.role] ?? { label: user.role, className: 'bg-muted/30 text-muted-foreground border-border' }) : null;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'cuenta',    label: 'Cuenta',    icon: <User className="h-4 w-4" /> },
    { id: 'vehiculos', label: 'Vehículos', icon: <Truck className="h-4 w-4" /> },
    { id: 'rutas',     label: 'Rutas',     icon: <Route className="h-4 w-4" /> },
    { id: 'alertas',   label: 'Alertas',   icon: <Bell className="h-4 w-4" /> },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/40 px-6 py-4">
        <Link href="/users" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Usuarios
        </Link>

        {isLoading || !user ? (
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted/30 animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-40 bg-muted/30 rounded animate-pulse" />
              <div className="h-3 w-28 bg-muted/20 rounded animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <UserAvatar name={user.full_name} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{user.full_name}</h1>
                {role && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${role.className}`}>
                    {role.label}
                  </span>
                )}
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                  user.is_active
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}>
                  {user.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                {user.email && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {user.email}
                  </span>
                )}
                {user.phone && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {user.phone}
                  </span>
                )}
                <span className={`flex items-center gap-1.5 text-sm ${user.has_device ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  <Smartphone className="h-3.5 w-3.5" />
                  {user.has_device ? 'App instalada' : 'Sin app'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border/50 px-6">
        <div className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'cuenta'    && <CuentaTab    userId={userId} />}
            {activeTab === 'vehiculos' && <VehiculosTab userId={userId} />}
            {activeTab === 'rutas'     && <RutasTab     userId={userId} />}
            {activeTab === 'alertas'   && <AlertasTab   userId={userId} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
