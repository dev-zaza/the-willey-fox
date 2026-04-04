import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { INotificationProvider } from '../notification-provider.interface';
import type { EmailProviderType } from './email-provider.token';
import { ConsoleEmailProvider } from './console-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';

const logger = new Logger('EmailProviderFactory');

export function createEmailProvider(configService: ConfigService): INotificationProvider {
  const providerType = configService.get<EmailProviderType>('EMAIL_PROVIDER', 'smtp');

  switch (providerType) {
    case 'smtp': {
      const host = configService.get<string>('SMTP_HOST');
      const port = configService.get<number>('SMTP_PORT');
      const user = configService.get<string>('SMTP_USER');
      const pass = configService.get<string>('SMTP_PASS');
      const fromAddress = configService.get<string>('SMTP_FROM', 'noreply@safetag.app');

      if (!host || !port || !user || !pass) {
        logger.warn(
          'EMAIL_PROVIDER=smtp but SMTP credentials are missing — falling back to console provider',
        );
        return new ConsoleEmailProvider();
      }

      return new SmtpEmailProvider(host, port, user, pass, fromAddress);
    }

    case 'ses':
      logger.warn('AWS SES email provider is not yet implemented — falling back to console provider');
      return new ConsoleEmailProvider();

    case 'sendgrid':
      logger.warn('SendGrid email provider is not yet implemented — falling back to console provider');
      return new ConsoleEmailProvider();

    case 'console':
    default:
      logger.log('Using console email provider');
      return new ConsoleEmailProvider();
  }
}
