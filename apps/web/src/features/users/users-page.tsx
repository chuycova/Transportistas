'use client';
import { useState, useMemo } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, UserCheck, Truck, Car, RefreshCw, Pencil,
  Smartphone, Search, Users, ChevronDown, UserRound,
  Eye, EyeOff, Copy, Check, CheckCircle2, Circle, Wand2,
} from 'lucide-react';
import { useUsers, useCreateUser, useUpdateUser, type TenantUser } from './use-users';
import { useVehicles, useUpdateVehicle, type Vehicle } from '../vehicles/use-vehicles';

// ─── Password utilities ───────────────────────────────────────────────────────
const PWD_UPPER   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PWD_LOWER   = 'abcdefghijklmnopqrstuvwxyz';
const PWD_DIGIT   = '0123456789';
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

interface PwdCheck { label: string; ok: boolean }

function getPwdChecks(pwd: string): PwdCheck[] {
  return [
    { label: 'Mínimo 10 caracteres',      ok: pwd.length >= 10 },
    { label: 'Mayúscula (A-Z)',            ok: /[A-Z]/.test(pwd) },
    { label: 'Minúscula (a-z)',            ok: /[a-z]/.test(pwd) },
    { label: 'Número (0-9)',               ok: /[0-9]/.test(pwd) },
    { label: 'Carácter especial (!@#…)',   ok: /[^A-Za-z0-9]/.test(pwd) },
  ];
}

function isPwdValid(pwd: string): boolean {
  return getPwdChecks(pwd).every((c) => c.ok);
}

// ─── Role labels ──────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, { label: string; className: string }> = {
  admin:       { label: 'Admin',       className: 'bg-primary/10 text-primary border-primary/30' },
  super_admin: { label: 'Super Admin', className: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  operator:    { label: 'Operador',    className: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  driver:      { label: 'Conductor',   className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function VehicleIcon({ type }: { type: string | null }) {
  if (type === 'car' || type === 'van') return <Car className="h-4 w-4" />;
  return <Truck className="h-4 w-4" />;
}

function UserAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'h-12 w-12 text-base' : size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-9 w-9 text-sm';
  return (
    <div className={`${sz} rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Password Field ───────────────────────────────────────────────────────────
function PasswordField({
  value, onChange, id, label, required, showGenerate,
}: {
  value: string; onChange: (v: string) => void;
  id: string; label: string; required?: boolean; showGenerate?: boolean;
}) {
  const [show, setShow]       = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genLen, setGenLen]   = useState(12);
  const [copied, setCopied]   = useState(false);

  const checks     = getPwdChecks(value);
  const hasStarted = value.length > 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}{required && ' *'}
      </label>

      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 pr-16 text-sm font-mono focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
          placeholder="••••••••••"
        />
        <div className="absolute right-2 top-1.5 flex items-center gap-0.5">
          {value && (
            <button type="button" onClick={() => void handleCopy()}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors" title="Copiar">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
          <button type="button" onClick={() => setShow((v) => !v)}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors">
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Requirement checks */}
      {hasStarted && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {checks.map((c) => (
            <div key={c.label} className={`flex items-center gap-1 text-[10px] ${c.ok ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {c.ok
                ? <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                : <Circle       className="h-3 w-3 flex-shrink-0" />}
              {c.label}
            </div>
          ))}
        </div>
      )}

      {/* Generator panel */}
      {showGenerate && (
        <>
          <button type="button" onClick={() => setGenOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors">
            <Wand2 className="h-3 w-3" />
            {genOpen ? 'Ocultar generador' : 'Generar contraseña segura'}
          </button>

          <AnimatePresence>
            {genOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-border/40 bg-background/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Longitud: <span className="font-bold text-foreground">{genLen}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => onChange(generatePassword(genLen))}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Generar
                    </button>
                  </div>
                  <input
                    type="range" min={10} max={24} value={genLen}
                    onChange={(e) => setGenLen(Number(e.target.value))}
                    className="w-full accent-primary h-1.5 cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground select-none">
                    <span>10</span><span>16</span><span>24</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ─── Assign Vehicle Modal ─────────────────────────────────────────────────────
function AssignVehicleModal({
  open,
  driver,
  vehicles,
  currentVehicle,
  onClose,
}: {
  open: boolean;
  driver: TenantUser;
  vehicles: Vehicle[];
  currentVehicle: Vehicle | undefined;
  onClose: () => void;
}) {
  const update = useUpdateVehicle();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() =>
    vehicles.filter((v) =>
      !search ||
      v.plate.toLowerCase().includes(search.toLowerCase()) ||
      (v.alias ?? '').toLowerCase().includes(search.toLowerCase()),
    ), [vehicles, search]);

  const assign = async (vehicleId: string | null) => {
    if (vehicleId === null && currentVehicle) {
      await update.mutateAsync({ id: currentVehicle.id, assigned_driver_id: null });
    } else if (vehicleId) {
      if (currentVehicle && currentVehicle.id !== vehicleId) {
        await update.mutateAsync({ id: currentVehicle.id, assigned_driver_id: null });
      }
      await update.mutateAsync({ id: vehicleId, assigned_driver_id: driver.id });
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Asignar vehículo</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Usuario: <span className="font-medium text-foreground">{driver.full_name}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por placa o alias..."
            className="w-full rounded-lg border border-border/50 bg-background/50 pl-8 pr-3 py-2 text-xs focus:border-primary/50 focus:outline-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
          {/* Sin vehículo */}
          <button
            type="button"
            onClick={() => void assign(null)}
            disabled={!currentVehicle || update.isPending}
            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-left transition-colors disabled:opacity-40 ${
              !currentVehicle
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'border-border/40 hover:bg-muted/40 text-muted-foreground'
            }`}
          >
            <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0">
              <UserRound className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">Sin vehículo</p>
              <p className="text-[11px] text-muted-foreground">Desasignar del vehículo actual</p>
            </div>
          </button>

          {filtered.map((v) => {
            const isAssigned = currentVehicle?.id === v.id;
            const assignedToOther = v.assigned_driver_id && v.assigned_driver_id !== driver.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => void assign(v.id)}
                disabled={update.isPending || !!assignedToOther}
                className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-left transition-colors disabled:opacity-40 ${
                  isAssigned
                    ? 'border-primary/30 bg-primary/5'
                    : assignedToOther
                    ? 'border-border/30 bg-muted/20 cursor-not-allowed'
                    : 'border-border/40 hover:bg-muted/40'
                }`}
              >
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${v.color ?? '#6366f1'}22` }}
                >
                  <VehicleIcon type={v.vehicle_type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-mono font-bold text-sm truncate ${isAssigned ? 'text-primary' : ''}`}>{v.plate}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {v.alias ?? [v.brand, v.model].filter(Boolean).join(' ') ?? v.vehicle_type}
                  </p>
                </div>
                {isAssigned && (
                  <span className="ml-auto rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold px-2 py-0.5 flex-shrink-0">
                    Asignado
                  </span>
                )}
                {assignedToOther && (
                  <span className="ml-auto rounded-full bg-muted/30 border border-border text-muted-foreground text-[10px] px-2 py-0.5 flex-shrink-0">
                    Ocupado
                  </span>
                )}
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
              <Truck className="h-8 w-8 opacity-30" />
              <p className="text-sm">Sin vehículos disponibles</p>
            </div>
          )}
        </div>

        {update.error && (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {(update.error as Error).message}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
      </motion.div>
    </div>
  );
}

// ─── Create User Modal ────────────────────────────────────────────────────────
function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateUser();
  const [email, setEmail]   = useState('');
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [role, setRole]     = useState<'driver' | 'operator' | 'admin'>('driver');
  const [password, setPassword] = useState('');
  const [done, setDone]     = useState(false);

  const pwdOk = isPwdValid(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdOk) return;
    await create.mutateAsync({ email, full_name: name, phone: phone || undefined, password, role });
    setDone(true);
    setTimeout(() => {
      setDone(false);
      setEmail(''); setName(''); setPhone(''); setPassword(''); setRole('driver');
      onClose();
    }, 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nuevo Usuario</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium">Usuario creado</p>
            <p className="text-xs text-muted-foreground text-center">
              La cuenta está activa y lista para iniciar sesión.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="cu-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Correo electrónico *
              </label>
              <input id="cu-email" required type="email" placeholder="usuario@empresa.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20" />
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label htmlFor="cu-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Nombre completo *
              </label>
              <input id="cu-name" required placeholder="Juan Pérez"
                value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20" />
            </div>

            {/* Phone + Role row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="cu-phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Teléfono
                </label>
                <input id="cu-phone" placeholder="+52 555 000 0000"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
              </div>
              <div className="space-y-1">
                <label htmlFor="cu-role" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Rol *
                </label>
                <div className="relative">
                  <select id="cu-role" value={role}
                    onChange={(e) => setRole(e.target.value as typeof role)}
                    className="w-full appearance-none rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none">
                    <option value="driver">Conductor</option>
                    <option value="operator">Operador</option>
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Password */}
            <PasswordField id="cu-pwd" label="Contraseña" required
              value={password} onChange={setPassword} showGenerate />

            {create.error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {create.error.message}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={create.isPending || !pwdOk}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
                {create.isPending ? 'Creando...' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────
function EditUserModal({ user, onClose }: { user: TenantUser; onClose: () => void }) {
  const updateUser = useUpdateUser();
  const [name, setName]         = useState(user.full_name);
  const [phone, setPhone]       = useState(user.phone ?? '');
  const [role, setRole]         = useState(user.role);
  const [changePwd, setChangePwd] = useState(false);
  const [password, setPassword] = useState('');

  const pwdOk  = !changePwd || isPwdValid(password);
  const hasChanges = name !== user.full_name || phone !== (user.phone ?? '') ||
    role !== user.role || (changePwd && password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdOk) return;
    await updateUser.mutateAsync({
      id: user.id,
      full_name: name,
      phone: phone || undefined,
      role,
      ...(changePwd && password ? { password } : {}),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="mb-5 flex items-center gap-3">
          <UserAvatar name={user.full_name} size="md" />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">Editar Usuario</h3>
            <p className="text-xs text-muted-foreground truncate">{user.full_name}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted transition-colors flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          {/* Name */}
          <div className="space-y-1">
            <label htmlFor="eu-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Nombre completo *
            </label>
            <input id="eu-name" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20" />
          </div>

          {/* Phone + Role row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="eu-phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Teléfono
              </label>
              <input id="eu-phone" placeholder="+52 555 000 0000"
                value={phone} onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label htmlFor="eu-role" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rol
              </label>
              <div className="relative">
                <select id="eu-role" value={role} onChange={(e) => setRole(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none">
                  <option value="driver">Conductor</option>
                  <option value="operator">Operador</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Change password toggle */}
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
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <PasswordField id="eu-pwd" label="Nueva contraseña"
                    value={password} onChange={setPassword} showGenerate />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {updateUser.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {(updateUser.error as Error).message}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2 text-sm hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={updateUser.isPending || !hasChanges || !pwdOk}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
              {updateUser.isPending ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────
function UserCard({
  driver, assignedVehicle, onAssign, onEdit,
}: {
  driver: TenantUser; assignedVehicle: Vehicle | undefined;
  onAssign: () => void; onEdit: () => void;
}) {
  const role = ROLE_LABELS[driver.role] ?? { label: driver.role, className: 'bg-muted/30 text-muted-foreground border-border' };

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="group rounded-2xl border border-border/50 bg-card/60 p-5 transition-shadow hover:shadow-xl hover:shadow-black/20">

      {/* Top row */}
      <div className="flex items-start gap-3">
        <UserAvatar name={driver.full_name} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{driver.full_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${role.className}`}>
              {role.label}
            </span>
            {driver.phone && (
              <p className="text-[11px] text-muted-foreground truncate">{driver.phone}</p>
            )}
          </div>
        </div>
        {/* Device badge */}
        <div className={`flex-shrink-0 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${
          driver.has_device ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted/30 text-muted-foreground'
        }`}>
          <Smartphone className="h-3 w-3" />
          {driver.has_device ? 'App' : 'Sin app'}
        </div>
      </div>

      {/* Vehicle row */}
      <div className="mt-3 rounded-xl border border-border/30 bg-background/30 px-3 py-2.5">
        {assignedVehicle ? (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${assignedVehicle.color ?? '#6366f1'}22` }}>
              <VehicleIcon type={assignedVehicle.vehicle_type} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs font-bold tracking-wider">{assignedVehicle.plate}</p>
              {assignedVehicle.alias && (
                <p className="text-[11px] text-muted-foreground truncate">{assignedVehicle.alias}</p>
              )}
            </div>
            <span className="rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 flex-shrink-0">
              Asignado
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">Sin vehículo asignado</p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onEdit}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border/50 px-3 py-2 text-xs font-medium hover:bg-muted/40 transition-colors flex-shrink-0">
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
        <button type="button" onClick={onAssign}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border/50 py-2 text-xs font-medium hover:bg-muted/40 hover:border-primary/30 hover:text-primary transition-colors">
          <Truck className="h-3.5 w-3.5" />
          {assignedVehicle ? 'Cambiar vehículo' : 'Asignar vehículo'}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export function UsersPage() {
  const { data: drivers = [], isLoading: loadingDrivers, error: driversError, refetch } = useUsers();
  const { data: vehicles = [], isLoading: loadingVehicles } = useVehicles();

  const [createOpen, setCreateOpen]   = useState(false);
  const [assignTarget, setAssignTarget] = useState<TenantUser | null>(null);
  const [editTarget, setEditTarget]   = useState<TenantUser | null>(null);
  const [search, setSearch]           = useState('');
  const [filterHasVehicle, setFilterHasVehicle] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const vehicleByDriver = useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const v of vehicles) {
      if (v.assigned_driver_id) map.set(v.assigned_driver_id, v);
    }
    return map;
  }, [vehicles]);

  const filtered = useMemo(() => drivers.filter((d) => {
    const matchSearch = !search || d.full_name.toLowerCase().includes(search.toLowerCase());
    const hasVehicle  = vehicleByDriver.has(d.id);
    const matchFilter = filterHasVehicle === 'all' ||
      (filterHasVehicle === 'assigned' && hasVehicle) ||
      (filterHasVehicle === 'unassigned' && !hasVehicle);
    return matchSearch && matchFilter;
  }), [drivers, search, filterHasVehicle, vehicleByDriver]);

  const stats = {
    total:      drivers.length,
    withApp:    drivers.filter((d) => d.has_device).length,
    assigned:   drivers.filter((d) => vehicleByDriver.has(d.id)).length,
    unassigned: drivers.filter((d) => !vehicleByDriver.has(d.id)).length,
  };

  const isLoading = loadingDrivers || loadingVehicles;

  return (
    <div className="flex-1 overflow-y-auto bg-background p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestión de usuarios y asignación a vehículos</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void refetch()}
            className="rounded-xl border border-border/50 p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Recargar lista">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {[
          { label: 'Total',        value: stats.total,      color: 'text-foreground' },
          { label: 'Con app',      value: stats.withApp,    color: 'text-emerald-400' },
          { label: 'Con vehículo', value: stats.assigned,   color: 'text-primary' },
          { label: 'Sin vehículo', value: stats.unassigned, color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card/60 p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuario..."
            className="w-full rounded-xl border border-border/50 bg-card/60 pl-9 pr-4 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20" />
        </div>
        <div className="relative">
          <select value={filterHasVehicle}
            onChange={(e) => setFilterHasVehicle(e.target.value as typeof filterHasVehicle)}
            className="appearance-none rounded-xl border border-border/50 bg-card/60 pl-3 pr-8 py-2.5 text-sm focus:border-primary/50 focus:outline-none">
            <option value="all">Todos</option>
            <option value="assigned">Con vehículo</option>
            <option value="unassigned">Sin vehículo</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-3 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}
      {driversError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {(driversError as Error).message}
        </div>
      )}
      {!isLoading && !driversError && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((d) => (
              <UserCard key={d.id} driver={d}
                assignedVehicle={vehicleByDriver.get(d.id)}
                onAssign={() => setAssignTarget(d)}
                onEdit={() => setEditTarget(d)}
              />
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="col-span-full flex h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 text-muted-foreground">
              <Users className="h-8 w-8 opacity-30" />
              <p className="text-sm">{search ? 'Sin resultados' : 'Sin usuarios registrados'}</p>
              {!search && (
                <button type="button" onClick={() => setCreateOpen(true)} className="text-xs text-primary hover:underline">
                  Crear el primero
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {createOpen && <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />}
      </AnimatePresence>

      {/* Edit Modal — key forces full remount when target changes */}
      <AnimatePresence>
        {editTarget && (
          <EditUserModal key={editTarget.id} user={editTarget} onClose={() => setEditTarget(null)} />
        )}
      </AnimatePresence>

      {/* Assign Vehicle Modal */}
      <AnimatePresence>
        {assignTarget && (
          <AssignVehicleModal open={!!assignTarget} driver={assignTarget}
            vehicles={vehicles} currentVehicle={vehicleByDriver.get(assignTarget.id)}
            onClose={() => setAssignTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
