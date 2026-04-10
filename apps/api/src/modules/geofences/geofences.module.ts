import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GeofencesController } from './geofences.controller';
import { SupabaseGeofenceRepository } from './infrastructure/supabase-geofence.repository';
import { GEOFENCE_REPOSITORY } from '../../common/tokens';

@Module({
  imports: [AuthModule],
  controllers: [GeofencesController],
  providers: [
    { provide: GEOFENCE_REPOSITORY, useClass: SupabaseGeofenceRepository },
  ],
  exports: [GEOFENCE_REPOSITORY],
})
export class GeofencesModule {}
