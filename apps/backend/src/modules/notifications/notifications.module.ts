import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationProcessor } from './processors/notification.processor';
import { SMS_PROVIDER } from './providers/sms/sms-provider.token';
import { createSmsProvider } from './providers/sms/sms-provider.factory';
import { PUSH_PROVIDER } from './providers/push/push-provider.token';
import { createPushProvider } from './providers/push/push-provider.factory';
import { EMAIL_PROVIDER } from './providers/email/email-provider.token';
import { createEmailProvider } from './providers/email/email-provider.factory';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationProcessor,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: createEmailProvider,
    },
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService],
      useFactory: createSmsProvider,
    },
    {
      provide: PUSH_PROVIDER,
      inject: [ConfigService],
      useFactory: createPushProvider,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
