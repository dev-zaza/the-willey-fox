import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { INotificationProvider } from '../notification-provider.interface';
import { ConsoleWebPushProvider } from './console-web-push.provider';
import { WebPushProvider } from './web-push.provider';

const logger = new Logger('WebPushProviderFactory');

export function createWebPushProvider(configService: ConfigService): INotificationProvider {
  const publicKey = configService.get<string>('VAPID_PUBLIC_KEY');
  const privateKey = configService.get<string>('VAPID_PRIVATE_KEY');
  const subject = configService.get<string>('VAPID_SUBJECT', 'mailto:support@thewileyfox.com');

  if (!publicKey || !privateKey) {
    logger.warn('VAPID keys missing — using console web push provider');
    return new ConsoleWebPushProvider();
  }

  return new WebPushProvider(publicKey, privateKey, subject);
}
