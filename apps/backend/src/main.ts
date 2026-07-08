import './instrument';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    rawBody: true, // Required for Stripe webhook signature verification
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  // Swagger / OpenAPI setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TheWileyfox API')
    .setDescription('QR-based lost item/person/pet recovery platform with community safety features')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addTag('auth', 'Authentication & registration')
    .addTag('users', 'User profile management')
    .addTag('qr-codes', 'QR code CRUD & management')
    .addTag('guardians', 'Guardian co-ownership system')
    .addTag('families', 'Family unit management')
    .addTag('reports', 'Lost/found reporting')
    .addTag('public', 'Public QR scan & reporting endpoints')
    .addTag('pins', 'Community safety pins')
    .addTag('directions', 'Route planning & safety scoring')
    .addTag('messages', 'Messaging system')
    .addTag('emergency', 'Emergency contacts & SOS')
    .addTag('payments', 'Stripe subscriptions & billing')
    .addTag('notifications', 'Notification management')
    .addTag('places', 'Places & reviews')
    .addTag('settings', 'Public platform settings')
    .addTag('admin', 'Admin dashboard & moderation')
    .addTag('health', 'Health checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`TheWileyfox API running on http://localhost:${port}/api/v1`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
