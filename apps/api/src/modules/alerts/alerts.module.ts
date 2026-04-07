import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlertsController } from './alerts.controller';
import { SupabaseAlertRepository } from './infrastructure/supabase-alert.repository';
import { ExpoPushService } from './infrastructure/firebase-fcm.service';
import { ALERT_REPOSITORY, NOTIFICATION_SERVICE } from '../../common/tokens';

@Module({
  imports: [AuthModule],
  controllers: [AlertsController],
  providers: [
    { provide: ALERT_REPOSITORY, useClass: SupabaseAlertRepository },
    { provide: NOTIFICATION_SERVICE, useClass: ExpoPushService },
  ],
  // Exportamos ambos para que TrackingModule los inyecte en ProcessLocationUseCase
  exports: [ALERT_REPOSITORY, NOTIFICATION_SERVICE],
})
export class AlertsModule {}
