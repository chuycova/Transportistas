import {
  Controller, Get, Patch, Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { AuthUser, TenantId, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { ALERT_REPOSITORY } from '../../common/tokens';
import type { IAlertRepository, Alert } from '@zona-zero/domain';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertsController {
  constructor(
    @Inject(ALERT_REPOSITORY) private readonly repo: IAlertRepository,
  ) {}

  /** GET /api/v1/alerts — Lista alertas del tenant con filtros */
  @Get()
  findAll(
    @TenantId() tenantId: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('resolved') resolved?: string,
    @Query('type') alertType?: Alert['alertType'],
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.repo.findMany({
      tenantId,
      vehicleId,
      isResolved: resolved !== undefined ? resolved === 'true' : undefined,
      alertType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /** GET /api/v1/alerts/:id */
  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.repo.findById(id, tenantId);
  }

  /** PATCH /api/v1/alerts/:id/resolve — Marcar alerta como resuelta */
  @Patch(':id/resolve')
  @Roles('admin', 'super_admin', 'operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  resolve(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @AuthUser() user: AuthenticatedUser,
    @Body('note') note?: string,
  ) {
    return this.repo.resolve(id, tenantId, user.id, note);
  }
}
