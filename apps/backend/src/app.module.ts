import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { QrModule } from './modules/qr/qr.module';
import { GuardiansModule } from './modules/guardians/guardians.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PublicModule } from './modules/public/public.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PinsModule } from './modules/pins/pins.module';
import { SafetyEngineModule } from './modules/safety-engine/safety-engine.module';
import { DirectionsModule } from './modules/directions/directions.module';
import { RouteRatingsModule } from './modules/route-ratings/route-ratings.module';
import { MessagesModule } from './modules/messages/messages.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { AdminModule } from './modules/admin/admin.module';
import { PlacesModule } from './modules/places/places.module';
import { SettingsModule } from './modules/settings/settings.module';
import { getRedisConnectionOptions } from './config/redis-connection';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Monorepo root .env first so DATABASE_URL/Redis match docker-compose (apps/backend/.env only adds missing keys).
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: getRedisConnectionOptions(configService),
      }),
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    QrModule,
    GuardiansModule,
    ReportsModule,
    PublicModule,
    NotificationsModule,
    PaymentsModule,
    PinsModule,
    SafetyEngineModule,
    DirectionsModule,
    RouteRatingsModule,
    MessagesModule,
    EmergencyModule,
    AdminModule,
    PlacesModule,
    SettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
