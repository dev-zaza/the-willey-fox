import { ConfigService } from '@nestjs/config';
import { createSmsProvider } from './sms-provider.factory';
import { ConsoleSmsProvider } from './console-sms.provider';
import { TwilioSmsProvider } from './twilio-sms.provider';

// Mock Twilio to avoid real HTTP calls
// The twilio package exports Twilio as a named export in TS but the CJS module
// root is a constructor, so we need to mock both the default export and the
// named export to satisfy the import { Twilio } from 'twilio' pattern.
jest.mock('twilio', () => {
  const MockTwilio = jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn().mockResolvedValue({ sid: 'SM123' }) },
  }));
  return { Twilio: MockTwilio, __esModule: true, default: MockTwilio };
});

function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  } as unknown as ConfigService;
}

describe('createSmsProvider', () => {
  it('returns ConsoleSmsProvider when SMS_PROVIDER is not set (defaults to console)', () => {
    const config = makeConfig({});
    const provider = createSmsProvider(config);
    expect(provider).toBeInstanceOf(ConsoleSmsProvider);
  });

  it('returns ConsoleSmsProvider when SMS_PROVIDER=console explicitly', () => {
    const config = makeConfig({ SMS_PROVIDER: 'console' });
    const provider = createSmsProvider(config);
    expect(provider).toBeInstanceOf(ConsoleSmsProvider);
  });

  it('returns TwilioSmsProvider when SMS_PROVIDER=twilio and all creds are present', () => {
    const config = makeConfig({
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_PHONE_NUMBER: '+15555555555',
    });
    const provider = createSmsProvider(config);
    expect(provider).toBeInstanceOf(TwilioSmsProvider);
  });

  it('falls back to ConsoleSmsProvider when SMS_PROVIDER=twilio but creds are missing', () => {
    const config = makeConfig({ SMS_PROVIDER: 'twilio' });
    const provider = createSmsProvider(config);
    expect(provider).toBeInstanceOf(ConsoleSmsProvider);
  });

  it('falls back to ConsoleSmsProvider when SMS_PROVIDER=vonage (not implemented)', () => {
    const config = makeConfig({ SMS_PROVIDER: 'vonage' });
    const provider = createSmsProvider(config);
    expect(provider).toBeInstanceOf(ConsoleSmsProvider);
  });

  it('falls back to ConsoleSmsProvider when SMS_PROVIDER=sns (not implemented)', () => {
    const config = makeConfig({ SMS_PROVIDER: 'sns' });
    const provider = createSmsProvider(config);
    expect(provider).toBeInstanceOf(ConsoleSmsProvider);
  });
});
