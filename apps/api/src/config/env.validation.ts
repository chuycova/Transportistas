// Validación y tipado del entorno con Zod
// Se ejecuta al arrancar el servidor. Si falta una variable, lanza error inmediato.
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),

  // Supabase
  SUPABASE_URL: z.string().url('SUPABASE_URL debe ser una URL válida'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY requerida'),

  // JWT (se valida con la clave pública de Supabase)
  API_JWT_SECRET: z.string().min(32, 'API_JWT_SECRET debe tener al menos 32 caracteres'),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),

  // Configuración de desvíos
  DEVIATION_THRESHOLD_METERS: z.coerce.number().default(50),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = EnvSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([field, msgs]) => `  • ${field}: ${msgs?.join(', ')}`)
      .join('\n');

    throw new Error(
      `❌ Variables de entorno inválidas o faltantes:\n${messages}\n` +
      `Copia el archivo .env.example a .env y completa los valores.`,
    );
  }

  return result.data;
}
