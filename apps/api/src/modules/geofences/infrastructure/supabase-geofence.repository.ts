// ─── Repositorio de Geocercas con Supabase ────────────────────────────────────
import { Injectable } from '@nestjs/common';
import { getServerSupabaseClient } from '@zona-zero/infrastructure';
import type {
  IGeofenceRepository,
  Geofence,
  CreateGeofenceInput,
  UpdateGeofenceInput,
} from '../geofence.types';

function mapRow(row: Record<string, unknown>): Geofence {
  return {
    id: row['id'] as string,
    tenantId: row['tenant_id'] as string,
    name: row['name'] as string,
    description: row['description'] as string | undefined,
    type: row['type'] as Geofence['type'],
    color: row['color'] as string,
    polygonCoords: row['polygon_coords'] as [number, number][],
    alertOnEnter: row['alert_on_enter'] as boolean,
    alertOnExit: row['alert_on_exit'] as boolean,
    isActive: row['is_active'] as boolean,
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
  };
}

@Injectable()
export class SupabaseGeofenceRepository implements IGeofenceRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return getServerSupabaseClient();
  }

  async findAll(tenantId: string): Promise<Geofence[]> {
    const { data, error } = await this.db
      .from('geofences')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  async findActiveByTenant(tenantId: string): Promise<Geofence[]> {
    const { data, error } = await this.db
      .from('geofences')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  async findById(id: string, tenantId: string): Promise<Geofence | null> {
    const { data, error } = await this.db
      .from('geofences')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error) return null;
    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async create(input: CreateGeofenceInput): Promise<Geofence> {
    const { data, error } = await this.db
      .from('geofences')
      .insert({
        tenant_id: input.tenantId,
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        color: input.color,
        polygon_coords: input.polygonCoords,
        alert_on_enter: input.alertOnEnter,
        alert_on_exit: input.alertOnExit,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  async update(id: string, tenantId: string, patch: UpdateGeofenceInput): Promise<Geofence> {
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined)          dbPatch['name']           = patch.name;
    if (patch.description !== undefined)   dbPatch['description']    = patch.description;
    if (patch.type !== undefined)          dbPatch['type']           = patch.type;
    if (patch.color !== undefined)         dbPatch['color']          = patch.color;
    if (patch.polygonCoords !== undefined) dbPatch['polygon_coords'] = patch.polygonCoords;
    if (patch.alertOnEnter !== undefined)  dbPatch['alert_on_enter'] = patch.alertOnEnter;
    if (patch.alertOnExit !== undefined)   dbPatch['alert_on_exit']  = patch.alertOnExit;
    if (patch.isActive !== undefined)      dbPatch['is_active']      = patch.isActive;

    const { data, error } = await this.db
      .from('geofences')
      .update(dbPatch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const { error } = await this.db
      .from('geofences')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);
  }
}
