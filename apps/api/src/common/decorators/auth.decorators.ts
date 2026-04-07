// Decorador personalizado para extraer el tenant_id del JWT del usuario autenticado.
// Uso: @TenantId() tenantId: string
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: 'super_admin' | 'admin' | 'operator' | 'driver';
}

/** Extrae el objeto usuario completo del request */
export const AuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);

/** Extrae solo el tenant_id del usuario autenticado (shorthand conveniente) */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return user.tenantId;
  },
);
