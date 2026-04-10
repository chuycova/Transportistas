'use client';
// ─── features/users/use-users.ts ─────────────────────────────────────────────
// Hooks para listar, crear y editar todos los perfiles del tenant.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const db = () => createSupabaseBrowserClient();

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export interface TenantUser {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  has_device: boolean;
  avatar_url: string | null;
}

// ─── GET /api/v1/users — Lista todos los perfiles del tenant ────────────────
export function useUsers() {
  const supabase = createSupabaseBrowserClient();

  return useQuery<TenantUser[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(`${BACKEND_URL}/api/v1/users`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json() as Promise<TenantUser[]>;
    },
    staleTime: 30_000,
  });
}

export interface CreateUserDto {
  email: string;
  full_name: string;
  phone?: string;
  password: string;
  role?: 'driver' | 'operator' | 'admin';
}

// ─── POST /api/v1/users — Crea usuario con contraseña ────────────────────────
export function useCreateUser() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation<{ id: string; email: string }, Error, CreateUserDto>({
    mutationFn: async (dto) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(`${BACKEND_URL}/api/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(dto),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ id: string; email: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

export interface UpdateUserDto {
  id: string;
  full_name?: string;
  phone?: string;
  password?: string;
  role?: string;
  is_active?: boolean;
}

// ─── PATCH /api/v1/users/:id — Edita perfil y/o contraseña ──────────────────
export function useUpdateUser() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation<{ id: string }, Error, UpdateUserDto>({
    mutationFn: async ({ id, ...dto }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(`${BACKEND_URL}/api/v1/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(dto),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// ─── Detalle de usuario ───────────────────────────────────────────────────────

export function useUserDetail(id: string | undefined) {
  const supabase = createSupabaseBrowserClient();
  return useQuery<TenantUser>({
    queryKey: ['users', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión');
      const res = await fetch(`${BACKEND_URL}/api/v1/users/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json() as Promise<TenantUser>;
    },
  });
}

// ─── Historial de vehículos del usuario ──────────────────────────────────────

export interface UserVehicleAssignment {
  id: string;
  vehicle_id: string;
  assigned_at: string;
  unassigned_at: string | null;
  is_active: boolean;
  notes: string | null;
  vehicle: {
    plate: string;
    alias: string | null;
    color: string | null;
    vehicle_type: string;
    brand: string | null;
    model: string | null;
  } | null;
}

export function useUserVehicleHistory(userId: string | undefined) {
  return useQuery<UserVehicleAssignment[]>({
    queryKey: ['user-vehicle-history', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db()
        .from('vehicle_user_assignments')
        .select(`
          id, vehicle_id, assigned_at, unassigned_at, is_active, notes,
          vehicles!vehicle_user_assignments_vehicle_id_fkey(plate, alias, color, vehicle_type, brand, model)
        `)
        .eq('user_id', userId!)
        .order('assigned_at', { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((row: any) => ({
        id: row.id,
        vehicle_id: row.vehicle_id,
        assigned_at: row.assigned_at,
        unassigned_at: row.unassigned_at,
        is_active: row.is_active,
        notes: row.notes,
        vehicle: row.vehicles ?? null,
      })) as UserVehicleAssignment[];
    },
  });
}

// ─── Historial de rutas del usuario ──────────────────────────────────────────

export interface UserRouteRecord {
  id: string;
  name: string;
  status: string;
  origin_name: string;
  dest_name: string;
  total_distance_m: number | null;
  created_at: string;
  vehicle_plate: string | null;
}

export function useUserRouteHistory(userId: string | undefined) {
  return useQuery<UserRouteRecord[]>({
    queryKey: ['user-route-history', userId],
    enabled: !!userId,
    queryFn: async () => {
      // Obtener todos los vehículos que alguna vez tuvo asignados
      const { data: assignments } = await db()
        .from('vehicle_user_assignments')
        .select('vehicle_id')
        .eq('user_id', userId!);

      // También verificar assigned_driver_id en vehicles
      const { data: primaryVehicles } = await db()
        .from('vehicles')
        .select('id, plate')
        .eq('assigned_driver_id', userId!);

      const vehicleIds = Array.from(new Set([
        ...(assignments ?? []).map((a: { vehicle_id: string }) => a.vehicle_id),
        ...(primaryVehicles ?? []).map((v: { id: string }) => v.id),
      ]));

      if (!vehicleIds.length) return [];

      const { data, error } = await db()
        .from('routes')
        .select('id, name, status, origin_name, dest_name, total_distance_m, created_at, vehicle_id, vehicles!routes_vehicle_id_fkey(plate)')
        .in('vehicle_id', vehicleIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        origin_name: r.origin_name,
        dest_name: r.dest_name,
        total_distance_m: r.total_distance_m,
        created_at: r.created_at,
        vehicle_plate: r.vehicles?.plate ?? null,
      })) as UserRouteRecord[];
    },
  });
}

// ─── Historial de alertas del usuario ────────────────────────────────────────

export interface UserAlertRecord {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  payload: Record<string, unknown>;
  is_resolved: boolean;
  created_at: string;
  vehicle_id: string;
  vehicle_plate: string | null;
}

export function useUserAlertHistory(userId: string | undefined) {
  return useQuery<UserAlertRecord[]>({
    queryKey: ['user-alert-history', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: assignments } = await db()
        .from('vehicle_user_assignments')
        .select('vehicle_id')
        .eq('user_id', userId!);

      const { data: primaryVehicles } = await db()
        .from('vehicles')
        .select('id')
        .eq('assigned_driver_id', userId!);

      const vehicleIds = Array.from(new Set([
        ...(assignments ?? []).map((a: { vehicle_id: string }) => a.vehicle_id),
        ...(primaryVehicles ?? []).map((v: { id: string }) => v.id),
      ]));

      if (!vehicleIds.length) return [];

      const { data, error } = await db()
        .from('alerts')
        .select('id, alert_type, severity, payload, is_resolved, created_at, vehicle_id, vehicles!alerts_vehicle_id_fkey(plate)')
        .in('vehicle_id', vehicleIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((a: any) => ({
        id: a.id,
        alert_type: a.alert_type,
        severity: a.severity,
        payload: a.payload ?? {},
        is_resolved: a.is_resolved,
        created_at: a.created_at,
        vehicle_id: a.vehicle_id,
        vehicle_plate: a.vehicles?.plate ?? null,
      })) as UserAlertRecord[];
    },
  });
}
