import {
  Controller, Post, Get, Body, Query, Param, UseGuards, HttpCode, HttpStatus, Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../../common/decorators/auth.decorators';
import { ProcessLocationUseCase, type IncomingPingDto } from './application/process-location.use-case';
import { LOCATION_REPOSITORY } from '../../common/tokens';
import type { ILocationRepository } from '@zona-zero/domain';

@Controller('tracking')
@UseGuards(JwtAuthGuard)
export class TrackingController {
  constructor(
    private readonly processLocation: ProcessLocationUseCase,
    @Inject(LOCATION_REPOSITORY) private readonly locationRepo: ILocationRepository,
  ) {}

  /**
   * POST /api/v1/tracking/ping
   * El móvil envía su posición actual aquí.
   * Este endpoint debe ser muy rápido: recibe, procesa async y responde 204.
   */
  @Post('ping')
  @HttpCode(HttpStatus.NO_CONTENT)
  async receivePing(
    @Body() body: Omit<IncomingPingDto, 'tenantId'>,
    @TenantId() tenantId: string,
  ) {
    // Se procesa en background para responder inmediatamente al móvil
    void this.processLocation.execute({ ...body, tenantId });
  }

  /**
   * POST /api/v1/tracking/sync
   * El móvil envía lotes de pings acumulados en modo offline.
   */
  @Post('sync')
  @HttpCode(HttpStatus.NO_CONTENT)
  async syncOffline(
    @Body('pings') pings: Array<Omit<IncomingPingDto, 'tenantId'>>,
    @TenantId() tenantId: string,
  ) {
    // Para sync offline, procesamos en lote sin deviation (ya pasó el momento)
    // y solo persistimos para el historial
    await this.locationRepo.createMany(
      pings.map((p) => ({
        tenantId,
        vehicleId: p.vehicleId,
        routeId: p.routeId,
        coordinate: p.coordinate,
        speedKmh: p.speedKmh,
        headingDeg: p.headingDeg,
        accuracyM: p.accuracyM,
        isOffRoute: false, // Los pings offline no disparan alertas retroactivas
        recordedAt: new Date(p.recordedAt),
      })),
    );
  }

  /**
   * POST /api/v1/tracking/panic
   * El conductor activa el botón de pánico desde la app (fallback REST si socket no disponible).
   * Delega al ProcessLocationUseCase para persistir alerta y emitir WS.
   */
  @Post('panic')
  @HttpCode(HttpStatus.NO_CONTENT)
  async receivePanic(
    @Body() body: { vehicleId: string; coordinate?: { lat: number; lng: number } },
    @TenantId() tenantId: string,
  ) {
    await this.processLocation.handlePanic({ vehicleId: body.vehicleId, tenantId, coordinate: body.coordinate });
  }

  /**
   * GET /api/v1/tracking/latest
   * El dashboard solicita las posiciones actuales de todos los vehículos del tenant.
   * Se llama 1 vez al cargar el mapa, luego todo es por WebSocket.
   */
  @Get('latest')
  getLatest(@TenantId() tenantId: string) {
    return this.locationRepo.findLatestByTenant(tenantId);
  }

  /**
   * GET /api/v1/tracking/history/:vehicleId
   * Historial de una unidad para el "replay" de trayecto.
   */
  @Get('history/:vehicleId')
  getHistory(
    @Param('vehicleId') vehicleId: string,
    @TenantId() tenantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.locationRepo.findHistory({
      vehicleId,
      tenantId,
      from: new Date(from),
      to: new Date(to),
    });
  }
}
