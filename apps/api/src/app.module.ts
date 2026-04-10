import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { RoutingModule } from './modules/routing/routing.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { DriverModule } from './modules/driver/driver.module';
import { GeofencesModule } from './modules/geofences/geofences.module';
import { supabaseAdminProvider } from './infrastructure/supabase-admin.provider';

@Global()
@Module({
  imports: [
    // ─── Configuración Global ────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      cache: true,
    }),

    // ─── Rate Limiting (DoS protection) ─────────────────────────
    // short: 30 req / 10s por IP (protege endpoints de ping GPS)
    // long:  300 req / 60s por IP (protege rutas de consulta)
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 10_000, limit: 30 },
      { name: 'long',  ttl: 60_000, limit: 300 },
    ]),

    // ─── Módulos de Dominio ───────────────────────────────────────
    AuthModule,
    VehiclesModule,
    RoutingModule,
    TrackingModule,
    AlertsModule,
    DriversModule,
    DriverModule,
    GeofencesModule,
  ],
  providers: [
    // ─── Infraestructura compartida (global) ─────────────────────
    supabaseAdminProvider,          // SUPABASE_ADMIN_CLIENT: service_role singleton

    // Aplica ThrottlerGuard globalmente a todos los controllers
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [
    supabaseAdminProvider,          // Re-exportar para que @Global() lo propague
  ],
})
export class AppModule {}
