'use client';
// ─── features/drivers/use-drivers.ts ─────────────────────────────────────────
// Hooks para listar conductores del tenant y crear cuentas de conductor via API.
// Un "conductor" es cualquier profile con role='driver' del mismo tenant.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  /** Si tiene fcm_token, la app móvil está registrada y puede recibir pings */
  has_device: boolean;
  avatar_url: string | null;
}

// ─── GET /api/v1/drivers — Lista conductores del tenant ─────────────────────
export function useDrivers() {
  const supabase = createSupabaseBrowserClient();

  return useQuery<Driver[]>({
    queryKey: ['drivers'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(`${BACKEND_URL}/api/v1/drivers`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json() as Promise<Driver[]>;
    },
    staleTime: 30_000,
  });
}

export interface InviteDriverDto {
  email: string;
  full_name: string;
  phone?: string;
}

// ─── POST /api/v1/drivers/invite — Crea cuenta de conductor e invita por email
export function useInviteDriver() {
  const qc = useQueryClient();
  const supabase = createSupabaseBrowserClient();

  return useMutation<{ id: string; email: string }, Error, InviteDriverDto>({
    mutationFn: async (dto) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const res = await fetch(`${BACKEND_URL}/api/v1/drivers/invite`, {
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  });
}
