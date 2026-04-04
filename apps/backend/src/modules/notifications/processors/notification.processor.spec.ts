import { Test, TestingModule } from '@nestjs/testing';
import { NotificationProcessor } from './notification.processor';
import { DRIZZLE } from '../../../database/database.module';
import { EMAIL_PROVIDER } from '../providers/email/email-provider.token';
import { SMS_PROVIDER } from '../providers/sms/sms-provider.token';
import { PUSH_PROVIDER } from '../providers/push/push-provider.token';
import type { Job } from 'bullmq';
import type { NotificationJobData } from './notification.processor';
import type { INotificationProvider } from '../providers/notification-provider.interface';

const makeJob = (overrides: Partial<NotificationJobData> & { attemptsMade?: number }): Job<NotificationJobData> => {
  const data: NotificationJobData = {
    logId: 'log-1',
    type: overrides.type ?? 'email',
    payload: overrides.payload ?? { recipient: 'test@example.com', subject: 'Sub', body: 'Body' },
  };
  return {
    data,
    attemptsMade: overrides.attemptsMade ?? 0,
  } as unknown as Job<NotificationJobData>;
};

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;

  const mockDb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
  };

  const makeProvider = (success: boolean, messageId?: string): INotificationProvider => ({
    send: jest.fn().mockResolvedValue(
      success ? { success: true, messageId: messageId ?? 'msg-id' } : { success: false, error: 'provider error' },
    ),
  });

  let emailProvider: INotificationProvider;
  let smsProvider: INotificationProvider;
  let pushProvider: INotificationProvider;

  beforeEach(async () => {
    emailProvider = makeProvider(true, 'email-msg-id');
    smsProvider = makeProvider(true, 'sms-msg-id');
    pushProvider = makeProvider(true, 'push-msg-id');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: EMAIL_PROVIDER, useValue: emailProvider },
        { provide: SMS_PROVIDER, useValue: smsProvider },
        { provide: PUSH_PROVIDER, useValue: pushProvider },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('routing', () => {
    it('uses emailProvider for email jobs', async () => {
      const job = makeJob({ type: 'email' });
      await processor.process(job);
      expect(emailProvider.send).toHaveBeenCalledWith(job.data.payload);
      expect(smsProvider.send).not.toHaveBeenCalled();
      expect(pushProvider.send).not.toHaveBeenCalled();
    });

    it('uses smsProvider for sms jobs', async () => {
      const job = makeJob({ type: 'sms' });
      await processor.process(job);
      expect(smsProvider.send).toHaveBeenCalledWith(job.data.payload);
      expect(emailProvider.send).not.toHaveBeenCalled();
    });

    it('uses pushProvider for push jobs', async () => {
      const job = makeJob({ type: 'push' });
      await processor.process(job);
      expect(pushProvider.send).toHaveBeenCalledWith(job.data.payload);
      expect(emailProvider.send).not.toHaveBeenCalled();
    });
  });

  describe('success handling', () => {
    it('updates notification log status to sent on success', async () => {
      const job = makeJob({ type: 'email' });
      await processor.process(job);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'sent' }),
      );
    });
  });

  describe('failure handling', () => {
    it('sets status to retrying on first failure (attemptsMade < 2)', async () => {
      const failingEmailProvider = makeProvider(false);
      const module = await Test.createTestingModule({
        providers: [
          NotificationProcessor,
          { provide: DRIZZLE, useValue: mockDb },
          { provide: EMAIL_PROVIDER, useValue: failingEmailProvider },
          { provide: SMS_PROVIDER, useValue: smsProvider },
          { provide: PUSH_PROVIDER, useValue: pushProvider },
        ],
      }).compile();

      const failProcessor = module.get<NotificationProcessor>(NotificationProcessor);
      const job = makeJob({ type: 'email', attemptsMade: 1 });

      await expect(failProcessor.process(job)).rejects.toThrow('provider error');
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'retrying' }),
      );
    });

    it('sets status to failed when attemptsMade >= 2', async () => {
      const failingEmailProvider = makeProvider(false);
      const module = await Test.createTestingModule({
        providers: [
          NotificationProcessor,
          { provide: DRIZZLE, useValue: mockDb },
          { provide: EMAIL_PROVIDER, useValue: failingEmailProvider },
          { provide: SMS_PROVIDER, useValue: smsProvider },
          { provide: PUSH_PROVIDER, useValue: pushProvider },
        ],
      }).compile();

      const failProcessor = module.get<NotificationProcessor>(NotificationProcessor);
      const job = makeJob({ type: 'email', attemptsMade: 2 });

      await expect(failProcessor.process(job)).rejects.toThrow('provider error');
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });
  });
});
