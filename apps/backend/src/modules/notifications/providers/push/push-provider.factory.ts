import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { INotificationProvider } from '../notification-provider.interface';
import type { PushProviderType } from './push-provider.token';
import { ConsolePushProvider } from './console-push.provider';
import { FcmPushProvider } from './fcm-push.provider';

const logger = new Logger('PushProviderFactory');

export function createPushProvider(configService: ConfigService): INotificationProvider {
  const providerType = configService.get<PushProviderType>('PUSH_PROVIDER', 'console');

  switch (providerType) {
    case 'fcm': {
      const projectId = configService.get<string>('FCM_PROJECT_ID');
      const clientEmail = configService.get<string>('FCM_CLIENT_EMAIL');
      const privateKey = configService.get<string>('FCM_PRIVATE_KEY');

      if (!projectId || !clientEmail || !privateKey) {
        logger.warn(
          'PUSH_PROVIDER=fcm but FCM credentials are missing — falling back to console provider',
        );
        return new ConsolePushProvider();
      }

      return new FcmPushProvider(projectId, clientEmail, privateKey);
    }

    case 'console':
    default:
      logger.log('Using console push provider');
      return new ConsolePushProvider();
  }
}
