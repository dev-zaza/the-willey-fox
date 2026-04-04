import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DRIZZLE } from '../../../database/database.module';
import type { DrizzleDB } from '../../../database/database.module';
import { notificationLogs } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import { SMS_PROVIDER } from '../providers/sms/sms-provider.token';
import { PUSH_PROVIDER } from '../providers/push/push-provider.token';
import { EMAIL_PROVIDER } from '../providers/email/email-provider.token';
import type { INotificationProvider, NotificationPayload } from '../providers/notification-provider.interface';

export interface NotificationJobData {
  logId: string;
  type: 'email' | 'sms' | 'push';
  payload: NotificationPayload;
}

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: INotificationProvider,
    @Inject(SMS_PROVIDER) private readonly smsProvider: INotificationProvider,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: INotificationProvider,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { logId, type, payload } = job.data;
    this.logger.log(`Processing ${type} notification (logId: ${logId})`);

    const provider =
      type === 'email'
        ? this.emailProvider
        : type === 'sms'
          ? this.smsProvider
          : this.pushProvider;

    const result = await provider.send(payload);

    if (result.success) {
      await this.db
        .update(notificationLogs)
        .set({
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(notificationLogs.id, logId));

      this.logger.log(`${type} notification sent (logId: ${logId}, messageId: ${result.messageId})`);
    } else {
      await this.db
        .update(notificationLogs)
        .set({
          status: job.attemptsMade >= 2 ? 'failed' : 'retrying',
          errorMessage: result.error,
          updatedAt: new Date(),
        })
        .where(eq(notificationLogs.id, logId));

      throw new Error(result.error || 'Notification send failed');
    }
  }
}
