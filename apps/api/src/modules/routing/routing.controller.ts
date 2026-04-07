import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { TenantId, AuthUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { ROUTE_REPOSITORY } from '../../common/tokens';
import type { IRouteRepository, Coordinate, RouteStop, RouteStatus } from '@zona-zero/domain';
import { GoogleDirectionsAdapter } from './infrastructure/google-directions.adapter';

interface CreateRouteDto {
  name: string;
  description?: string;
  origin: Coordinate;
  originName: string;
  destination: Coordinate;
  destinationName: string;
  /** Waypoints intermedios opcionales (en orden) */
  waypoints?: Coordinate[];
  stops?: RouteStop[];
  deviationThresholdM?: number;
}

@Controller('routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutingController {
  private readonly logger = new Logger(RoutingController.name);

  constructor(
    @Inject(ROUTE_REPOSITORY) private readonly repo: IRouteRepository,
    private readonly directions: GoogleDirectionsAdapter,
  ) {}

  /** GET /api/v1/routes — Lista rutas del tenant */
  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('status') status?: RouteStatus,
  ) {
    return this.repo.findMany({ tenantId, status });
  }

  /** GET /api/v1/routes/:id — Obtiene una ruta con su polyline */
  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.repo.findById(id, tenantId);
  }

  /**
   * POST /api/v1/routes — Crea una nueva ruta.
   *
   * Flujo:
   *  1. Llama a Google Routes API v2 para calcular la ruta real por calles
   *  2. Convierte la respuesta en polyline_coords para Supabase
   *  3. Si la key no está configurada o falla, guarda sin polyline calculada (graceful)
   */
  @Post()
  @Roles('admin', 'super_admin', 'operator')
  async create(
    @Body() dto: CreateRouteDto,
    @TenantId() tenantId: string,
    @AuthUser() user: AuthenticatedUser,
  ) {
    // ── 1. Calcular ruta por calles ────────────────────────────────────────
    const computed = await this.directions.computeRoute(
      dto.origin,
      dto.destination,
      dto.waypoints ?? [],
    );

    if (computed) {
      this.logger.log(
        `Route "${dto.name}" computed via Google Routes API: ` +
        `${computed.distanceM}m, ${computed.durationS}s, cache=${computed.fromCache}`,
      );
    } else {
      this.logger.warn(
        `Route "${dto.name}" created WITHOUT Google Directions (key not set or API error). ` +
        `polyline_coords will be empty — road snapping disabled for this route.`,
      );
    }

    // ── 2. Persistir la ruta con polyline calculada ────────────────────────
    // polyline_coords: Google usa [lat, lng], Supabase/GeoJSON usa [lng, lat]
    const polylineCoords = computed?.points.map((p) => [p.lng, p.lat] as [number, number]);

    return this.repo.create({
      name: dto.name,
      description: dto.description,
      tenantId,
      createdBy: user.id,
      origin: dto.origin,
      originName: dto.originName,
      destination: dto.destination,
      destinationName: dto.destinationName,
      stops: dto.stops,
      deviationThresholdM: dto.deviationThresholdM,
      // Datos calculados por Google (undefined si no hay key)
      polylinePoints: polylineCoords
        ? polylineCoords.map(([lng, lat]) => ({ lat, lng }))
        : [],
      totalDistanceM: computed?.distanceM,
      estimatedDurationS: computed?.durationS,
    });
  }

  /** PUT /api/v1/routes/:id — Actualiza metadatos de una ruta */
  @Put(':id')
  @Roles('admin', 'super_admin', 'operator')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateRouteDto>,
    @TenantId() tenantId: string,
  ) {
    return this.repo.update(id, tenantId, dto);
  }

  /** PATCH /api/v1/routes/:id/status */
  @Patch(':id/status')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: RouteStatus,
    @TenantId() tenantId: string,
  ) {
    return this.repo.updateStatus(id, tenantId, status);
  }

  /** DELETE /api/v1/routes/:id */
  @Delete(':id')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.repo.delete(id, tenantId);
  }
}
