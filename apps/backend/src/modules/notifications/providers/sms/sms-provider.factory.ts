import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { INotificationProvider } from '../notification-provider.interface';
import type { SmsProviderType } from './sms-provider.token';
import { ConsoleSmsProvider } from './console-sms.provider';
import { TwilioSmsProvider } from './twilio-sms.provider';

const logger = new Logger('SmsProviderFactory');

export function createSmsProvider(configService: ConfigService): INotificationProvider {
  const providerType = configService.get<SmsProviderType>('SMS_PROVIDER', 'console');

  switch (providerType) {
    case 'twilio': {
      const accountSid = configService.get<string>('TWILIO_ACCOUNT_SID');
      const authToken = configService.get<string>('TWILIO_AUTH_TOKEN');
      const phoneNumber = configService.get<string>('TWILIO_PHONE_NUMBER');

      if (!accountSid || !authToken || !phoneNumber) {
        logger.warn(
          'SMS_PROVIDER=twilio but Twilio credentials are missing — falling back to console provider',
        );
        return new ConsoleSmsProvider();
      }

      return new TwilioSmsProvider(accountSid, authToken, phoneNumber);
    }

    case 'vonage':
      logger.warn('Vonage SMS provider is not yet implemented — falling back to console provider');
      return new ConsoleSmsProvider();

    case 'sns':
      logger.warn('AWS SNS SMS provider is not yet implemented — falling back to console provider');
      return new ConsoleSmsProvider();

    case 'console':
    default:
      logger.log('Using console SMS provider');
      return new ConsoleSmsProvider();
  }
}
