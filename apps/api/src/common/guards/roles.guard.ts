// Guard de roles: restringe endpoints según el rol del usuario
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../decorators/auth.decorators';

export const ROLES_KEY = 'roles';

/** Decorador para aplicar restricción de roles en un endpoint */
export function Roles(...roles: AuthenticatedUser['role'][]) {
  return (target: object, key?: string | symbol, descriptor?: TypedPropertyDescriptor<unknown>) => {
    if (descriptor) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value as object);
    } else {
      Reflect.defineMetadata(ROLES_KEY, roles, target);
    }
    return descriptor ?? target;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AuthenticatedUser['role'][]>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // Si no hay roles requeridos, el endpoint es público (solo auth)
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere rol: ${requiredRoles.join(' | ')}`,
      );
    }

    return true;
  }
}
