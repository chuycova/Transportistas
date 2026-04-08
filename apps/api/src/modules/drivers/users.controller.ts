import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, HttpCode, HttpStatus, BadRequestException, Logger, Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { TenantId } from '../../common/decorators/auth.decorators';
import { SUPABASE_ADMIN_CLIENT, type SupabaseAdminClient } from '../../infrastructure/supabase-admin.provider';

function validatePassword(pwd: string): string | null {
  if (pwd.length < 10) return 'La contraseña debe tener al menos 10 caracteres';
  if (!/[A-Z]/.test(pwd)) return 'Debe incluir al menos una letra mayúscula';
  if (!/[a-z]/.test(pwd)) return 'Debe incluir al menos una letra minúscula';
  if (!/[0-9]/.test(pwd)) return 'Debe incluir al menos un número';
  if (!/[^A-Za-z0-9]/.test(pwd)) return 'Debe incluir al menos un carácter especial';
  return null;
}

interface CreateUserDto {
  email: string;
  full_name: string;
  phone?: string;
  password: string;
  role?: 'driver' | 'operator' | 'admin';
}

interface UpdateUserDto {
  full_name?: string;
  phone?: string;
  password?: string;
  role?: string;
  is_active?: boolean;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly adminClient: SupabaseAdminClient,
  ) {}

  /**
   * GET /api/v1/users
   * Lista todos los perfiles del tenant, sin filtrar por rol.
   */
  @Get()
  @Roles('admin', 'super_admin', 'operator')
  async findAll(@TenantId() tenantId: string) {
    const { data, error } = await this.adminClient
      .from('profiles')
      .select('id, full_name, phone, role, is_active, avatar_url, fcm_token')
      .eq('tenant_id', tenantId)
      .order('full_name');

    if (error) throw new Error(error.message);

    return (data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      role: p.role,
      is_active: p.is_active,
      avatar_url: p.avatar_url,
      has_device: !!p.fcm_token,
    }));
  }

  /**
   * POST /api/v1/users
   * Crea un usuario con contraseña directa (sin magic-link).
   * La cuenta queda activa de inmediato.
   */
  @Post()
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserDto, @TenantId() tenantId: string) {
    const pwdError = validatePassword(dto.password);
    if (pwdError) throw new BadRequestException(pwdError);

    const { data, error } = await this.adminClient.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
      email_confirm: true,
      user_metadata: {
        tenant_id: tenantId,
        full_name: dto.full_name,
        role: dto.role ?? 'driver',
      },
    });

    if (error) throw new BadRequestException(error.message);
    const userId = data.user.id;

    const { error: profileError } = await this.adminClient
      .from('profiles')
      .upsert({
        id: userId,
        tenant_id: tenantId,
        full_name: dto.full_name,
        phone: dto.phone ?? null,
        role: dto.role ?? 'driver',
        is_active: true,
      }, { onConflict: 'id' });

    if (profileError) {
      this.logger.warn(`Profile upsert failed for ${userId}: ${profileError.message}`);
    }

    this.logger.log(`User created: ${dto.email} → ${userId} in tenant ${tenantId}`);
    return { id: userId, email: dto.email };
  }

  /**
   * PATCH /api/v1/users/:id
   * Edita nombre, teléfono, rol, estado y/o contraseña de un usuario del tenant.
   */
  @Patch(':id')
  @Roles('admin', 'super_admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @TenantId() tenantId: string,
  ) {
    if (dto.password) {
      const pwdError = validatePassword(dto.password);
      if (pwdError) throw new BadRequestException(pwdError);

      const { error } = await this.adminClient.auth.admin.updateUserById(id, { password: dto.password });
      if (error) throw new BadRequestException(error.message);
    }

    const patch: Record<string, unknown> = {};
    if (dto.full_name !== undefined) patch.full_name = dto.full_name;
    if (dto.phone !== undefined) patch.phone = dto.phone || null;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.is_active !== undefined) patch.is_active = dto.is_active;

    if (Object.keys(patch).length > 0) {
      const { error } = await this.adminClient
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw new BadRequestException(error.message);
    }

    this.logger.log(`User updated: ${id} in tenant ${tenantId}`);
    return { id };
  }
}
