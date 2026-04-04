import { ConfigService } from '@nestjs/config';
import { createPushProvider } from './push-provider.factory';
import { ConsolePushProvider } from './console-push.provider';
import { FcmPushProvider } from './fcm-push.provider';

// Mock firebase-admin to avoid real credentials
jest.mock('firebase-admin', () => {
  const mockApp = {
    messaging: jest.fn().mockReturnValue({
      send: jest.fn().mockResolvedValue('message-id'),
    }),
  };
  return {
    initializeApp: jest.fn().mockReturnValue(mockApp),
    credential: {
      cert: jest.fn().mockReturnValue({}),
    },
    app: {},
  };
});

function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  } as unknown as ConfigService;
}

describe('createPushProvider', () => {
  it('returns ConsolePushProvider when PUSH_PROVIDER is not set (defaults to console)', () => {
    const config = makeConfig({});
    const provider = createPushProvider(config);
    expect(provider).toBeInstanceOf(ConsolePushProvider);
  });

  it('returns ConsolePushProvider when PUSH_PROVIDER=console explicitly', () => {
    const config = makeConfig({ PUSH_PROVIDER: 'console' });
    const provider = createPushProvider(config);
    expect(provider).toBeInstanceOf(ConsolePushProvider);
  });

  it('returns FcmPushProvider when PUSH_PROVIDER=fcm and all creds are present', () => {
    const config = makeConfig({
      PUSH_PROVIDER: 'fcm',
      FCM_PROJECT_ID: 'my-project',
      FCM_CLIENT_EMAIL: 'sa@my-project.iam.gserviceaccount.com',
      FCM_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
    });
    const provider = createPushProvider(config);
    expect(provider).toBeInstanceOf(FcmPushProvider);
  });

  it('falls back to ConsolePushProvider when PUSH_PROVIDER=fcm but creds are missing', () => {
    const config = makeConfig({ PUSH_PROVIDER: 'fcm' });
    const provider = createPushProvider(config);
    expect(provider).toBeInstanceOf(ConsolePushProvider);
  });
});
