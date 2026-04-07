// Puerto: INotificationService
// Abstracción sobre Firebase FCM (o cualquier proveedor de push notifications)

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** URL de ícono para notificaciones web */
  imageUrl?: string;
}

export interface INotificationService {
  /** Enviar push notification a un dispositivo específico (por FCM token) */
  sendToDevice(fcmToken: string, payload: PushNotificationPayload): Promise<boolean>;

  /** Enviar push notification a todos los dispositivos de un tenant */
  sendToTopic(tenantId: string, payload: PushNotificationPayload): Promise<boolean>;
}
