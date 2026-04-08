// Adaptador de infraestructura: cliente Supabase con service_role_key.
//
// En hexagonal, este archivo es el "adapter" del puerto implícito
// "acceso privilegiado a la base de datos".
// El token SUPABASE_ADMIN_CLIENT es el puerto (abstracción) que
// los módulos consumen via DI, sin importar si mañana cambia el proveedor.
//
// Registrado como @Global() en AppModule → disponible en todos los módulos
// sin que cada uno lo importe explícitamente.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@zona-zero/infrastructure';

export const SUPABASE_ADMIN_CLIENT = Symbol('SUPABASE_ADMIN_CLIENT');

export type SupabaseAdminClient = SupabaseClient<Database>;

export const supabaseAdminProvider = {
  provide: SUPABASE_ADMIN_CLIENT,
  useFactory: (): SupabaseAdminClient => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas para el cliente admin.',
      );
    }

    return createClient<Database>(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  },
};
