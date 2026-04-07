// ─── GpsPing.model.ts ─────────────────────────────────────────────────────────
// Modelo WatermelonDB para la cola offline de pings GPS.
//
// Cuando el socket NO está disponible (sin red), los pings se persisten
// aquí con synced=false. El hook usePingSync los drena al reconectarse.

import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export class GpsPing extends Model {
  static override table = 'gps_pings';

  @field('vehicle_id')   vehicleId!: string;
  @field('tenant_id')    tenantId!: string;
  @field('route_id')     routeId!: string | null;
  @field('lat')          lat!: number;
  @field('lng')          lng!: number;
  @field('speed_kmh')    speedKmh!: number | null;
  @field('heading_deg')  headingDeg!: number | null;
  @field('accuracy_m')   accuracyM!: number | null;
  @field('recorded_at')  recordedAt!: number; // timestamp ms
  @field('synced')       synced!: boolean;
}
