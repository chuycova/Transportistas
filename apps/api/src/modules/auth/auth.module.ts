import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy],
  // Exportamos PassportModule para que otros módulos puedan usar @UseGuards(JwtAuthGuard)
  exports: [PassportModule, JwtStrategy],
})
export class AuthModule {}
