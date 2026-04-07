// Adaptador de Push Notifications via Expo Push API
// Reemplaza Firebase Admin SDK. Expo Push Service maneja FCM (Android) y APNs (iOS) internamente.
// Solo necesitas HTTP — sin SDKs pesados, sin credenciales de Firebase en el servidor.
//
// Documentación: https://docs.expo.dev/push-notifications/sending-notifications/
import { Injectable, Logger } from '@nestjs/common';
import type { INotificationService, PushNotificationPayload } from '@zona-zero/domain';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string | string[];    // ExpoPushToken del dispositivo, ej: "ExponentPushToken[xxx]"
  title?: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;       // Android Notification Channel
}

interface ExpoPushTicket {
  id?: string;
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

@Injectable()
export class ExpoPushService implements INotificationService {
  private readonly logger = new Logger(ExpoPushService.name);

  /**
   * Envía push notification a un dispositivo específico usando su Expo Push Token.
   * El token se almacena en profiles.fcm_token (reutilizamos la columna para ExpoPushToken).
   */
  async sendToDevice(expoToken: string, payload: PushNotificationPayload): Promise<boolean> {
    // Validar que es un token de Expo válido
    if (!expoToken.startsWith('ExponentPushToken[') && !expoToken.startsWith('ExpoPushToken[')) {
      this.logger.warn(`Token no válido para Expo Push: ${expoToken.slice(0, 20)}...`);
      return false;
    }

    const message: ExpoPushMessage = {
      to: expoToken,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: 'default',
      priority: 'high',
      channelId: 'alerts',  // Canal Android para alertas de desvío
    };

    return this.sendMessages([message]);
  }

  /**
   * Envía push notification a múltiples tokens de dispositivos del tenant.
   * Los tokens se obtienen consultando profiles.fcm_token WHERE tenant_id = X.
   * Esta implementación recibe el tenantId pero necesita los tokens resueltos externamente.
   * Ver: ProcessLocationUseCase que resuelve los tokens antes de llamar.
   */
  async sendToTopic(_tenantId: string, payload: PushNotificationPayload): Promise<boolean> {
    // Para el broadcast a operadores del tenant, usamos Supabase Realtime directamente
    // desde el TrackingGateway (WebSocket). Este método se mantiene para compatibilidad
    // con la interfaz pero no hace broadcast masivo push (no es necesario para web).
    this.logger.debug(`sendToTopic: alerta web manejada vía WebSocket: ${payload.title}`);
    return true;
  }

  private async sendMessages(messages: ExpoPushMessage[]): Promise<boolean> {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
      });

      if (!response.ok) {
        this.logger.warn(`Expo Push HTTP error: ${response.status}`);
        return false;
      }

      const result = await response.json() as { data: ExpoPushTicket | ExpoPushTicket[] };
      const tickets = Array.isArray(result.data) ? result.data : [result.data];

      const errors = tickets.filter((t) => t.status === 'error');
      if (errors.length > 0) {
        this.logger.warn(`Expo Push errores: ${JSON.stringify(errors)}`);
      }

      return errors.length < tickets.length; // Al menos uno exitoso
    } catch (err) {
      this.logger.error(`Expo Push fetch error: ${String(err)}`);
      return false;
    }
  }
}
