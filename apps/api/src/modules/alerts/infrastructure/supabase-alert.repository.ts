// Repositorio de Alertas con Supabase
import { Injectable } from '@nestjs/common';
import { getServerSupabaseClient } from '@zona-zero/infrastructure';
import type {
  IAlertRepository,
  AlertFilters,
  Alert,
  CreateAlertInput,
} from '@zona-zero/domain';
import { mapBaseFields, isNotFound } from '../../../infrastructure/supabase.helpers';

function mapRow(row: Record<string, unknown>): Alert {
  return {
    id: row['id'] as string,
    ...mapBaseFields(row),
    vehicleId: row['vehicle_id'] as string,
    routeId: row['route_id'] as string | undefined,
    locationId: row['location_id'] as number | undefined,
    alertType: row['alert_type'] as Alert['alertType'],
    severity: row['severity'] as Alert['severity'],
    payload: (row['payload'] as Alert['payload']) ?? {},
    isResolved: (row['is_resolved'] as boolean) ?? false,
    resolvedAt: row['resolved_at'] ? new Date(row['resolved_at'] as string) : undefined,
    resolvedById: row['resolved_by'] as string | undefined,
    resolutionNote: row['resolution_note'] as string | undefined,
    notificationSent: (row['notification_sent'] as boolean) ?? false,
  };
}

@Injectable()
export class SupabaseAlertRepository implements IAlertRepository {
  private get db() {
    return getServerSupabaseClient();
  }

  async findById(id: string, tenantId: string): Promise<Alert | null> {
    const { data, error } = await this.db
      .from('alerts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (isNotFound(error)) return null;
    if (error) throw new Error(error.message);
    return data ? mapRow(data as Record<string, unknown>) : null;
  }

  async findMany(filters: AlertFilters): Promise<Alert[]> {
    let query = this.db
      .from('alerts')
      .select('*')
      .eq('tenant_id', filters.tenantId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters.vehicleId) query = query.eq('vehicle_id', filters.vehicleId);
    if (filters.isResolved !== undefined) query = query.eq('is_resolved', filters.isResolved);
    if (filters.alertType) query = query.eq('alert_type', filters.alertType);
    if (filters.from) query = query.gte('created_at', filters.from.toISOString());
    if (filters.to) query = query.lte('created_at', filters.to.toISOString());

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async create(input: CreateAlertInput): Promise<Alert> {
    const { data, error } = await this.db
      .from('alerts')
      .insert({
        tenant_id: input.tenantId,
        vehicle_id: input.vehicleId,
        route_id: input.routeId ?? null,
        location_id: input.locationId ?? null,
        alert_type: input.alertType,
        severity: input.severity,
        payload: input.payload as import('@zona-zero/infrastructure').Json,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  async resolve(id: string, tenantId: string, resolvedById: string, note?: string): Promise<void> {
    const { error } = await this.db
      .from('alerts')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedById,
        resolution_note: note ?? null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(error.message);
  }

  async markNotificationSent(id: string): Promise<void> {
    await this.db
      .from('alerts')
      .update({ notification_sent: true })
      .eq('id', id);
  }
}
