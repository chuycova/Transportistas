// ─── Tipos y puerto del módulo de Geocercas ───────────────────────────────────

export type GeofenceType = 'base' | 'client' | 'risk_zone' | 'restricted' | 'generic';

export interface Geofence {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string | undefined;
  readonly type: GeofenceType;
  readonly color: string;
  /** Array de [lng, lat] pares — orden GeoJSON */
  readonly polygonCoords: [number, number][];
  readonly alertOnEnter: boolean;
  readonly alertOnExit: boolean;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateGeofenceInput {
  tenantId: string;
  name: string;
  description?: string;
  type: GeofenceType;
  color: string;
  polygonCoords: [number, number][];
  alertOnEnter: boolean;
  alertOnExit: boolean;
}

export interface UpdateGeofenceInput {
  name?: string;
  description?: string;
  type?: GeofenceType;
  color?: string;
  polygonCoords?: [number, number][];
  alertOnEnter?: boolean;
  alertOnExit?: boolean;
  isActive?: boolean;
}

export interface IGeofenceRepository {
  findAll(tenantId: string): Promise<Geofence[]>;
  findActiveByTenant(tenantId: string): Promise<Geofence[]>;
  findById(id: string, tenantId: string): Promise<Geofence | null>;
  create(input: CreateGeofenceInput): Promise<Geofence>;
  update(id: string, tenantId: string, patch: UpdateGeofenceInput): Promise<Geofence>;
  delete(id: string, tenantId: string): Promise<void>;
}
