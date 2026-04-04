import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { DRIZZLE } from '../../database/database.module';

/**
 * Build a minimal Drizzle mock that supports two terminal patterns:
 *   .where(...).limit(1)  -> resolvesWith responses[index++]
 *   await .where(...)     -> resolvesWith responses[index++]  (thenable, no limit)
 *
 * insert().values().returning() always resolves to [{ id: 'log-uuid-1' }].
 * update().set().where() is a no-op.
 */
function makeDb(responses: unknown[][]) {
  let idx = 0;

  const next = () => {
    const row = responses[idx] ?? [];
    idx++;
    return row;
  };

  // An object returned by .where() that supports .limit(), .orderBy().limit(), and direct await
  const terminalQuery = () => {
    const result = next();
    const obj: any = {
      limit: jest.fn().mockResolvedValue(result),
      // orderBy() chains and returns an object with .limit()
      orderBy: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(result) }),
      // thenable for direct `await db.select().from().where()`
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        void Promise.resolve(result).then(resolve, reject);
      },
    };
    return obj;
  };

  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockImplementation(() => terminalQuery()),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'log-uuid-1' }]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };
}

const mockConfig = {
  get: jest.fn((key: string, defaultValue?: string) => {
    const values: Record<string, string> = { PUBLIC_BASE_URL: 'http://localhost:3001' };
    return values[key] ?? defaultValue;
  }),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

async function buildService(db: ReturnType<typeof makeDb>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      NotificationsService,
      { provide: DRIZZLE, useValue: db },
      { provide: getQueueToken('notifications'), useValue: mockQueue },
      { provide: ConfigService, useValue: mockConfig },
    ],
  }).compile();
  return module.get<NotificationsService>(NotificationsService);
}

afterEach(() => {
  jest.clearAllMocks();
});

// ─── helpers ──────────────────────────────────────────────────────────────────
const baseQr = {
  id: 'qr-1',
  userId: 'user-1',
  uniqueCode: 'ABC123',
  name: 'Fluffy',
  category: 'pets',
};

describe('NotificationsService', () => {
  describe('sendAuthEmail', () => {
    it('inserts a notification log and queues a send-email job', async () => {
      const db = makeDb([]);
      const service = await buildService(db);

      await service.sendAuthEmail(
        'user@example.com',
        'user-id-1',
        'Verify your email',
        '<p>Click here</p>',
      );

      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email',
          recipientId: 'user-id-1',
          recipientContact: 'user@example.com',
          subject: 'Verify your email',
          status: 'pending',
        }),
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({ logId: 'log-uuid-1', type: 'email' }),
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  describe('notifyGuardiansOfReport', () => {
    it('logs a warning and returns early when QR code is not found', async () => {
      // First query (.where().limit()) returns [] → QR not found
      const db = makeDb([[]]);
      const service = await buildService(db);

      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
      await service.notifyGuardiansOfReport('report-1', 'qr-missing');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('queues email notification for owner with email preference enabled', async () => {
      const mockQr = {
        id: 'qr-1',
        userId: 'owner-1',
        uniqueCode: 'ABC123',
        name: 'My Keys',
        category: 'item',
      };
      const mockOwner = {
        id: 'owner-1',
        email: 'owner@example.com',
        phone: null,
        notificationPreferences: { email: true, sms: false, push: false },
      };

      // Queries in call order: QR .limit(1), owner .limit(1), guardians direct-await .where()
      const db = makeDb([[mockQr], [mockOwner], []]);
      const service = await buildService(db);

      await service.notifyGuardiansOfReport('report-1', 'qr-1');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({ type: 'email' }),
        expect.any(Object),
      );
    });

    it('skips email when owner has email pref disabled', async () => {
      const mockQr = { ...baseQr, userId: 'owner-1' };
      const mockOwner = {
        id: 'owner-1',
        email: 'owner@example.com',
        phone: null,
        notificationPreferences: { email: false, sms: false, push: false },
      };
      const db = makeDb([[mockQr], [mockOwner], []]);
      const service = await buildService(db);

      await service.notifyGuardiansOfReport('report-1', 'qr-1');

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('defaults to email enabled when notificationPreferences is null', async () => {
      const mockQr = { ...baseQr, userId: 'owner-1' };
      const mockOwner = {
        id: 'owner-1',
        email: 'owner@example.com',
        phone: null,
        notificationPreferences: null,
      };
      const db = makeDb([[mockQr], [mockOwner], []]);
      const service = await buildService(db);

      await service.notifyGuardiansOfReport('report-1', 'qr-1');

      // email defaults to enabled (prefs.email !== false)
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-email',
        expect.objectContaining({ type: 'email' }),
        expect.any(Object),
      );
    });
  });

  // ── sendPush ──────────────────────────────────────────────────────────────────
  describe('sendPush', () => {
    it('queues a push job when user has FCM token', async () => {
      const userWithToken = { fcmToken: 'fcm-token-abc' };
      const db = makeDb([[userWithToken]]);
      const service = await buildService(db);

      await service.sendPush('user-1', { title: 'Alert', body: 'Found your item' });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-push',
        expect.objectContaining({ type: 'push' }),
        expect.any(Object),
      );
    });

    it('skips silently when user has no FCM token', async () => {
      const userNoToken = { fcmToken: null };
      const db = makeDb([[userNoToken]]);
      const service = await buildService(db);

      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
      await service.sendPush('user-1', { title: 'Alert', body: 'Hello' });

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no FCM token'));
    });

    it('passes priority:critical in job payload for SOS alerts', async () => {
      const userWithToken = { fcmToken: 'fcm-critical' };
      const db = makeDb([[userWithToken]]);
      const service = await buildService(db);

      await service.sendPush('user-1', { title: 'SOS', body: 'Emergency!' }, { priority: 'critical' });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-push',
        expect.objectContaining({
          payload: expect.objectContaining({ priority: 'critical' }),
        }),
        expect.any(Object),
      );
    });

    it('logs delivery attempt to notification_logs', async () => {
      const userWithToken = { fcmToken: 'fcm-abc' };
      const db = makeDb([[userWithToken]]);
      const service = await buildService(db);

      await service.sendPush('user-1', { title: 'Test', body: 'Test body' });

      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'push', status: 'pending' }),
      );
    });
  });

  // ── sendSmsRaw ────────────────────────────────────────────────────────────────
  describe('sendSmsRaw', () => {
    it('queues an SMS job and logs the attempt', async () => {
      const db = makeDb([]);
      const service = await buildService(db);

      await service.sendSmsRaw('+447700900000', '123456 is your OTP code.');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-sms',
        expect.objectContaining({ type: 'sms' }),
        expect.any(Object),
      );
      expect(db.insert).toHaveBeenCalled();
      expect(db.values).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sms',
          recipientContact: '+447700900000',
          status: 'pending',
        }),
      );
    });
  });

  // ── generateUnsubscribeToken ──────────────────────────────────────────────────
  describe('generateUnsubscribeToken', () => {
    it('generates a deterministic HMAC token for a given user ID', async () => {
      const db = makeDb([]);
      const service = await buildService(db);

      const token1 = service.generateUnsubscribeToken('user-abc');
      const token2 = service.generateUnsubscribeToken('user-abc');

      expect(token1).toBe(token2);
      expect(typeof token1).toBe('string');
      expect(token1.length).toBe(64); // SHA-256 hex
    });

    it('produces different tokens for different user IDs', async () => {
      const db = makeDb([]);
      const service = await buildService(db);

      const token1 = service.generateUnsubscribeToken('user-aaa');
      const token2 = service.generateUnsubscribeToken('user-bbb');

      expect(token1).not.toBe(token2);
    });
  });

  // ── markNotificationsRead ─────────────────────────────────────────────────────
  describe('markNotificationsRead', () => {
    it('updates lastNotificationReadAt for the user', async () => {
      const db = makeDb([]);
      const service = await buildService(db);

      await service.markNotificationsRead('user-1');

      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalledWith(
        expect.objectContaining({ lastNotificationReadAt: expect.any(Date) }),
      );
    });
  });

  // ── listNotifications ─────────────────────────────────────────────────────────
  describe('listNotifications', () => {
    it('returns notifications list and unreadCount=total when lastReadAt is null', async () => {
      const log = {
        id: 'log-1', type: 'email', subject: 'Found!', body: 'Your item',
        status: 'delivered', createdAt: new Date(),
      };
      // listNotifications makes 2 queries:
      // 1. user row (lastNotificationReadAt) → [{ lastNotificationReadAt: null }]
      // 2. notification logs (orderBy().limit()) → [log]
      const db = makeDb([[{ lastNotificationReadAt: null }], [log]]);
      const service = await buildService(db);

      const result = await service.listNotifications('user-1');

      expect(result).toHaveProperty('notifications');
      expect(result).toHaveProperty('unreadCount');
      // when lastNotificationReadAt is null, unreadCount = notifications.length
      expect(result.unreadCount).toBe(result.notifications.length);
    });
  });
});
