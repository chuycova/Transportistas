// Helpers compartidos para repositories de Supabase.
// Viven en la capa de infraestructura de la API (no en packages/infrastructure
// porque son helpers de NestJS-land, no del cliente isomorfico).

/** Campos de fila base que todas las entidades con tenant comparten */
export interface BaseRow {
  tenant_id: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Extrae los campos de auditoria comunes de una fila cruda de Supabase.
 * Cada repository lo llama y extiende con sus campos especificos.
 *
 * Nota: `id` queda fuera intencionalmente — en `locations` es `number`,
 * en el resto es `string`. Cada mapRow lo castea segun su tipo de dominio.
 */
export function mapBaseFields(row: Record<string, unknown>) {
  return {
    tenantId: row['tenant_id'] as string,
    createdAt: new Date(row['created_at'] as string),
  };
}

/**
 * Devuelve `true` si el error de Supabase indica que no se encontro la fila.
 * Estandariza el chequeo de PGRST116 en todos los repositories.
 *
 * Uso:
 *   if (isNotFound(error)) return null;
 *   if (error) throw new Error(error.message);
 */
export function isNotFound(error: { code: string } | null | undefined): boolean {
  return error?.code === 'PGRST116';
}
