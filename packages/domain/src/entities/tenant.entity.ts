// Entidad: Tenant (Empresa / Flotilla cliente del SaaS)

export type TenantPlan = 'free' | 'pro' | 'enterprise';

export interface TenantSettings {
  /** Metros de tolerancia antes de disparar alerta de desvío */
  deviation_threshold_m: number;
  /** Timezone IANA, ej: "America/Mexico_City" */
  timezone: string;
  /** Color primario HEX del tenant para la UI */
  primary_color?: string;
}

export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly plan: TenantPlan;
  readonly isActive: boolean;
  readonly settings: TenantSettings;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: TenantPlan;
  settings?: Partial<TenantSettings>;
}
