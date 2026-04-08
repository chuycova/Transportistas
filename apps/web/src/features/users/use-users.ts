'use client';
// ─── features/users/use-users.ts ─────────────────────────────────────────────
// Hooks para listar, crear y editar todos los perfiles del tenant.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export interface TenantUser {
  id: string;
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
