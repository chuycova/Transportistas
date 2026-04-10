import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { RoutingModule } from '../routing/routing.module';
import { AlertsModule } from '../alerts/alerts.module';
import { GeofencesModule } from '../geofences/geofences.module';
import { TrackingController } from './tracking.controller';
import { TrackingGateway } from './infrastructure/tracking.gateway';
import { ProcessLocationUseCase } from './application/process-location.use-case';
import { PingBatchBufferService } from './application/ping-batch-buffer.service';
import { SupabaseLocationRepository } from './infrastructure/supabase-location.repository';
import { GoogleRoadsAdapter } from './infrastructure/google-roads.adapter';
import { LOCATION_REPOSITORY } from '../../common/tokens';

@Module({
  imports: [
    AuthModule,
    VehiclesModule,    // Para IVehicleRepository (actualizar status)
    RoutingModule,     // Para IRouteRepository (obtener polyline para detección)
    AlertsModule,      // Para IAlertRepository + INotificationService
    GeofencesModule,   // Para IGeofenceRepository (detección de geocercas)
  ],
  controllers: [TrackingController],
  providers: [
    { provide: LOCATION_REPOSITORY, useClass: SupabaseLocationRepository },
    TrackingGateway,
    GoogleRoadsAdapter,         // Snap GPS → calle real
    PingBatchBufferService,     // Batch buffer (reduce costos Roads API 10x)
    ProcessLocationUseCase,
  ],
})
export class TrackingModule {}
