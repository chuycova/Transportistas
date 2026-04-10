// ─── Geocercas Controller ─────────────────────────────────────────────────────
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, HttpCode, HttpStatus, Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../../common/decorators/auth.decorators';
import { GEOFENCE_REPOSITORY } from '../../common/tokens';
import type { IGeofenceRepository, CreateGeofenceInput, UpdateGeofenceInput } from './geofence.types';

@Controller('geofences')
@UseGuards(JwtAuthGuard)
export class GeofencesController {
  constructor(
    @Inject(GEOFENCE_REPOSITORY) private readonly repo: IGeofenceRepository,
  ) {}

  /** GET /api/v1/geofences — Lista todas las geocercas del tenant */
  @Get()
  findAll(@TenantId() tenantId: string) {
    return this.repo.findAll(tenantId);
  }

  /** GET /api/v1/geofences/:id */
  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.repo.findById(id, tenantId);
  }

  /** POST /api/v1/geofences — Crea una geocerca */
  @Post()
  create(
    @Body() body: Omit<CreateGeofenceInput, 'tenantId'>,
    @TenantId() tenantId: string,
  ) {
    return this.repo.create({ ...body, tenantId });
  }

  /** PATCH /api/v1/geofences/:id */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateGeofenceInput,
    @TenantId() tenantId: string,
  ) {
    return this.repo.update(id, tenantId, body);
  }

  /** DELETE /api/v1/geofences/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.repo.delete(id, tenantId);
  }
}
