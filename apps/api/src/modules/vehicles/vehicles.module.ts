import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoutingModule } from '../routing/routing.module';
import { VehiclesController } from './vehicles.controller';
import { SupabaseVehicleRepository } from './infrastructure/supabase-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../common/tokens';

@Module({
  imports: [AuthModule, RoutingModule],
  controllers: [VehiclesController],
  providers: [
    // Hexagonal: registra la implementación concreta bajo el token de la interfaz
    {
      provide: VEHICLE_REPOSITORY,
      useClass: SupabaseVehicleRepository,
    },
  ],
  exports: [VEHICLE_REPOSITORY],
})
export class VehiclesModule {}
