import {
  Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { TenantId, AuthUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { createClient } from '@supabase/supabase-js';

interface InviteDriverDto {
  email: string;
  full_name: string;
  phone?: string;
}

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  private readonly logger = new Logger(DriversController.name);

  // Service-role client — solo para operaciones de admin (invite user)
  // La service_role key NUNCA se expone al frontend
  private get adminClient() {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  /**
   * GET /api/v1/drivers
   * Lista todos los conductores (role='driver') del tenant.
   * Incluye `has_device: true` si el perfil tiene fcm_token registrado
   * (lo que indica que la app móvil está instalada y autenticada en ese dispositivo).
   */
  @Get()
  @Roles('admin', 'super_admin', 'operator')
  async findAll(@TenantId() tenantId: string) {
    const { data, error } = await this.adminClient
      .from('profiles')
      .select('id, full_name, phone, role, is_active, avatar_url, fcm_token')
      .eq('tenant_id', tenantId)
      .eq('role', 'driver')
      .order('full_name');

    if (error) throw new Error(error.message);

    // Ocultar el fcm_token real — solo exponer si existe (bool)
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
   * POST /api/v1/drivers/invite
   * Crea una cuenta de Supabase Auth con role='driver' y envía email de invitación.
   * El conductor recibirá un magic-link para establecer su contraseña.
   * Solo admins pueden invitar conductores.
   */
  @Post('invite')
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async invite(
    @Body() dto: InviteDriverDto,
    @TenantId() tenantId: string,
    @AuthUser() _actor: AuthenticatedUser,
  ) {
    // 1. Crear usuario en Supabase Auth e invitar por email
    const { data: inviteData, error: inviteError } = await this.adminClient.auth.admin.inviteUserByEmail(
      dto.email,
      {
        data: {
          tenant_id: tenantId,
          full_name: dto.full_name,
          role: 'driver',
        },
        redirectTo: `${process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000'}/driver-welcome`,
      },
    );

    if (inviteError) {
      this.logger.warn(`Invite failed for ${dto.email}: ${inviteError.message}`);
      throw new Error(inviteError.message);
    }

    const userId = inviteData.user?.id;
    if (!userId) throw new Error('Usuario no creado correctamente');

    // 2. Crear perfil en public.profiles
    // handle_new_user trigger ya lo crea, pero lo hacemos explícito por si el trigger falla
    const { error: profileError } = await this.adminClient
      .from('profiles')
      .upsert({
        id: userId,
        tenant_id: tenantId,
        full_name: dto.full_name,
        phone: dto.phone ?? null,
        role: 'driver',
        is_active: true,
      }, { onConflict: 'id' });

    if (profileError) {
      this.logger.warn(`Profile upsert failed for ${userId}: ${profileError.message}`);
      // No lanzamos error — el trigger debería haberlo creado igualmente
    }

    this.logger.log(`Driver invited: ${dto.email} → user ${userId} in tenant ${tenantId}`);

    return { id: userId, email: dto.email };
  }
}
