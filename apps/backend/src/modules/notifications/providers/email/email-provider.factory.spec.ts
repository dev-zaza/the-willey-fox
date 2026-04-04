import { ConfigService } from '@nestjs/config';
import { createEmailProvider } from './email-provider.factory';
import { ConsoleEmailProvider } from './console-email.provider';
import { SmtpEmailProvider } from './smtp-email.provider';

// Mock nodemailer to avoid real SMTP connections
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  }),
  getTestMessageUrl: jest.fn().mockReturnValue(null),
}));

function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  } as unknown as ConfigService;
}

describe('createEmailProvider', () => {
  it('returns SmtpEmailProvider when EMAIL_PROVIDER=smtp (default) and all creds are present', () => {
    const config = makeConfig({
      SMTP_HOST: 'smtp.ethereal.email',
      SMTP_PORT: 587,
      SMTP_USER: 'user@ethereal.email',
      SMTP_PASS: 'secret',
      SMTP_FROM: 'noreply@safetag.app',
    });
    const provider = createEmailProvider(config);
    expect(provider).toBeInstanceOf(SmtpEmailProvider);
  });

  it('falls back to ConsoleEmailProvider when EMAIL_PROVIDER=smtp but creds are missing', () => {
    const config = makeConfig({ EMAIL_PROVIDER: 'smtp' });
    const provider = createEmailProvider(config);
    expect(provider).toBeInstanceOf(ConsoleEmailProvider);
  });

  it('returns ConsoleEmailProvider when EMAIL_PROVIDER=console explicitly', () => {
    const config = makeConfig({ EMAIL_PROVIDER: 'console' });
    const provider = createEmailProvider(config);
    expect(provider).toBeInstanceOf(ConsoleEmailProvider);
  });

  it('falls back to ConsoleEmailProvider when EMAIL_PROVIDER=ses (not implemented)', () => {
    const config = makeConfig({ EMAIL_PROVIDER: 'ses' });
    const provider = createEmailProvider(config);
    expect(provider).toBeInstanceOf(ConsoleEmailProvider);
  });

  it('falls back to ConsoleEmailProvider when EMAIL_PROVIDER=sendgrid (not implemented)', () => {
    const config = makeConfig({ EMAIL_PROVIDER: 'sendgrid' });
    const provider = createEmailProvider(config);
    expect(provider).toBeInstanceOf(ConsoleEmailProvider);
  });
});
