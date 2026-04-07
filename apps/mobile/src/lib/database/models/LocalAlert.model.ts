// ─── LocalAlert.model.ts ──────────────────────────────────────────────────────
// Modelo WatermelonDB para alertas de desvío recibidas vía FCM/Socket.
// Se guardan localmente para mostrar historial en la app del conductor.

import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class LocalAlert extends Model {
  static override table = 'local_alerts';

  @field('type')        type!: string;        // 'off_route' | 'arrived_stop' etc.
  @field('message')     message!: string;
  @field('received_at') receivedAt!: number;  // timestamp ms
  @field('read')        read!: boolean;
}
