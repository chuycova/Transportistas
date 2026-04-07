import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';


const IS_PROD = process.env['NODE_ENV'] === 'production';

/** Origins permitidos — en producción solo el dominio real */
const ALLOWED_ORIGINS = IS_PROD
  ? [process.env['ALLOWED_ORIGIN'] ?? ''].filter(Boolean)
  : [
      'http://localhost:3000', // Next.js dev
      'http://localhost:3001', // API dev (para test browser)
      process.env['ALLOWED_ORIGIN'] ?? '',
    ].filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // En producción silenciar debug/verbose para no filtrar datos sensibles en logs
    logger: IS_PROD ? ['error', 'warn'] : ['error', 'warn', 'log', 'debug'],
  });

  // ─── Body size limit ─────────────────────────────────────────────────────────
  // Previene ataques de "body bombing" (payload enorme que colapsa el parser)
  app.use(require('express').json({ limit: '50kb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '50kb' }));

  // ─── CORS ────────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // ─── Prefijo global de API ───────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Validación automática de DTOs con class-validator ──────────────────────
  // whitelist: true → elimina cualquier propiedad no declarada en el DTO
  // forbidNonWhitelisted: true → lanza error si llegan propiedades extra
  // Esta combinación previene mass assignment y prototype pollution
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Socket.io Adapter ───────────────────────────────────────────────────────
  const socketOptions: Partial<ServerOptions> = {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e5, // 100KB max por frame de WebSocket
  };
  app.useWebSocketAdapter(new IoAdapter(app));

  // ─── Arrancar servidor ───────────────────────────────────────────────────────
  const port = process.env['API_PORT'] ?? 3001;
  await app.listen(port);

  console.log(`\n🚀 API running on: http://localhost:${port}/api/v1`);
  console.log(`🔌 WebSocket ready on: ws://localhost:${port}`);
  console.log(`🌍 Env: ${process.env['NODE_ENV'] ?? 'development'}`);
  console.log(`🔒 CORS origins: ${ALLOWED_ORIGINS.join(', ')}\n`);
}

bootstrap().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
