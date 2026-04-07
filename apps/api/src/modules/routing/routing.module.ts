import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RoutingController } from './routing.controller';
import { SupabaseRouteRepository } from './infrastructure/supabase-route.repository';
import { GoogleDirectionsAdapter } from './infrastructure/google-directions.adapter';
import { ROUTE_REPOSITORY } from '../../common/tokens';

@Module({
  imports: [AuthModule],
  controllers: [RoutingController],
  providers: [
    { provide: ROUTE_REPOSITORY, useClass: SupabaseRouteRepository },
    GoogleDirectionsAdapter,     // Routes API v2 con cache + FieldMask
  ],
  exports: [ROUTE_REPOSITORY, GoogleDirectionsAdapter],
})
export class RoutingModule {}
