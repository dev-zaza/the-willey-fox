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
import { WebPushService } from '../web-push.service';
import { WEB_PUSH_PROVIDER } from '../providers/push/web-push-provider.token';

export type NotificationJobType = 'email' | 'sms' | 'push' | 'web-push';

export interface NotificationJobData {
  logId: string;
  type: NotificationJobType;
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
    @Inject(WEB_PUSH_PROVIDER) private readonly webPushProvider: INotificationProvider,
    private readonly webPushService: WebPushService,
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
          : type === 'web-push'
            ? this.webPushProvider
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
      if (type === 'web-push' && result.error?.startsWith('410:')) {
        try {
          const subscription = JSON.parse(payload.recipient) as { endpoint: string };
          await this.webPushService.removeByEndpoint(subscription.endpoint);
          this.logger.warn(`Removed expired web push subscription ${subscription.endpoint.slice(0, 48)}…`);
        } catch {
          // ignore parse errors
        }
      }

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
