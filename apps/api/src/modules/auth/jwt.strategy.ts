// Estrategia JWT para Passport: valida tokens emitidos por Supabase Auth
// Supabase usa RS256 (JWKS) desde 2024; ya no usa HMAC simétrico.
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';
import type { AuthenticatedUser } from '../../common/decorators/auth.decorators';

interface SupabaseJwtPayload {
  sub: string;           // user_id de Supabase Auth
  email: string;
  user_metadata: {
    tenant_id: string;
    role: AuthenticatedUser['role'];
    full_name?: string;
  };
  aud: string;
  role: string;          // 'authenticated' (rol de Supabase, diferente al rol de la app)
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
        handleSigningKeyError: (err, cb) => {
          Logger.error(`JWKS signing key error: ${err.message}`, 'JwtStrategy');
          cb(err);
        },
      }),
      algorithms: ['ES256'],
    });
  }

  validate(payload: SupabaseJwtPayload): AuthenticatedUser {
    this.logger.debug(`JWT payload: ${JSON.stringify({ sub: payload.sub, email: payload.email, meta: payload.user_metadata })}`);
    const tenantId = payload.user_metadata?.tenant_id;
    const role = payload.user_metadata?.role;

    if (!tenantId || !role) {
      this.logger.error(`Falta tenant_id o role. user_metadata: ${JSON.stringify(payload.user_metadata)}`);
      throw new UnauthorizedException('Token inválido: falta tenant_id o role en user_metadata.');
    }

    return { id: payload.sub, email: payload.email, tenantId, role };
  }
}
