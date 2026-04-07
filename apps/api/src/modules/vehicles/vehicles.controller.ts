import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { AuthUser, TenantId, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { Inject } from '@nestjs/common';
import { VEHICLE_REPOSITORY, ROUTE_REPOSITORY } from '../../common/tokens';
import type { IVehicleRepository, IRouteRepository, VehicleStatus } from '@zona-zero/domain';

// ─── DTOs (simples, sin class-validator por ahora) ─────────────────────────
interface CreateVehicleDto {
  plate: string;
  alias?: string;
  brand?: string;
  model?: string;
  year?: number;
  vehicleType?: 'car' | 'truck' | 'van' | 'motorcycle' | 'other';
  color?: string;
  assignedDriverId?: string;
}

interface UpdateVehicleDto {
  alias?: string;
  brand?: string;
  model?: string;
  year?: number;
  vehicleType?: 'car' | 'truck' | 'van' | 'motorcycle' | 'other';
  color?: string;
  assignedDriverId?: string | null;
}

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly repo: IVehicleRepository,
    @Inject(ROUTE_REPOSITORY) private readonly routeRepo: IRouteRepository,
  ) {}

  /** GET /api/v1/vehicles/mine — Vehículo asignado al conductor autenticado + rutas activas del tenant */
  @Get('mine')
  async findMine(@AuthUser() user: AuthenticatedUser) {
    const vehicles = await this.repo.findMany({
      tenantId: user.tenantId,
      assignedDriverId: user.id,
    });

    const vehicle = vehicles[0];
    if (!vehicle) throw new NotFoundException('No tienes un vehículo asignado.');

    const routes = await this.routeRepo.findMany({ tenantId: user.tenantId, status: 'active' });

    return {
      vehicleId: vehicle.id,
      plate: vehicle.plate,
      alias: vehicle.alias,
      assignedRoutes: routes.map((r) => ({
        id: r.id,
        name: r.name,
        originName: r.originName,
        destinationName: r.destinationName,
        estimatedDurationS: r.estimatedDurationS,
        status: r.status,
      })),
    };
  }

  /** GET /api/v1/vehicles — Lista vehículos del tenant */
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('status') status?: VehicleStatus,
    @Query('search') search?: string,
  ) {
    return this.repo.findMany({ tenantId, status, search });
  }

  /** GET /api/v1/vehicles/:id — Obtiene un vehículo */
  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.repo.findById(id, tenantId);
  }

  /** POST /api/v1/vehicles — Crea un vehículo (admin/operator) */
  @Post()
  @Roles('admin', 'super_admin')
  async create(@Body() dto: CreateVehicleDto, @TenantId() tenantId: string) {
    return this.repo.create({ ...dto, tenantId });
  }

  /** PUT /api/v1/vehicles/:id — Actualiza datos de un vehículo */
  @Put(':id')
  @Roles('admin', 'super_admin', 'operator')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @TenantId() tenantId: string,
  ) {
    return this.repo.update(id, tenantId, dto);
  }

  /** PATCH /api/v1/vehicles/:id/status — Cambia estado rápidamente */
  @Patch(':id/status')
  @Roles('admin', 'super_admin', 'operator')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: VehicleStatus,
    @TenantId() tenantId: string,
  ) {
    await this.repo.updateStatus(id, tenantId, status);
  }

  /** DELETE /api/v1/vehicles/:id — Elimina un vehículo (solo admin) */
  @Delete(':id')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @TenantId() tenantId: string) {
    await this.repo.delete(id, tenantId);
  }
}
