import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { notificationLogs, webPushSubscriptions } from '../../database/schema';
import type { SubscribeWebPushDto } from './dto/subscribe-web-push.dto';
import type { NotificationJobData } from './processors/notification.processor';

@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  getPublicKey(): string | null {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') ?? null;
  }

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('VAPID_PUBLIC_KEY') &&
        this.configService.get<string>('VAPID_PRIVATE_KEY'),
    );
  }

  async subscribe(userId: string, dto: SubscribeWebPushDto): Promise<void> {
    const existing = await this.db
      .select({ id: webPushSubscriptions.id })
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.endpoint, dto.endpoint))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(webPushSubscriptions)
        .set({
          userId,
          p256dh: dto.keys.p256dh,
          auth: dto.keys.auth,
          userAgent: dto.userAgent ?? null,
          updatedAt: new Date(),
        })
        .where(eq(webPushSubscriptions.endpoint, dto.endpoint));
      return;
    }

    await this.db.insert(webPushSubscriptions).values({
      userId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      userAgent: dto.userAgent ?? null,
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(webPushSubscriptions)
      .where(and(eq(webPushSubscriptions.userId, userId), eq(webPushSubscriptions.endpoint, endpoint)));
    this.logger.log(`Removed web push subscription for user ${userId}`);
  }

  async removeByEndpoint(endpoint: string): Promise<void> {
    await this.db.delete(webPushSubscriptions).where(eq(webPushSubscriptions.endpoint, endpoint));
  }

  async queueForUser(
    recipientId: string,
    payload: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
      priority?: 'normal' | 'critical';
    },
  ): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    const subscriptions = await this.db
      .select()
      .from(webPushSubscriptions)
      .where(eq(webPushSubscriptions.userId, recipientId));

    if (subscriptions.length === 0) {
      return;
    }

    for (const subscription of subscriptions) {
      const recipient = JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      });

      const [log] = await this.db
        .insert(notificationLogs)
        .values({
          type: 'push',
          recipientId,
          recipientContact: subscription.endpoint,
          subject: payload.title,
          body: payload.body,
          metadata: { ...(payload.data ?? {}), channel: 'web-push' },
          status: 'pending',
        })
        .returning();

      const jobData: NotificationJobData = {
        logId: log.id,
        type: 'web-push',
        payload: {
          recipient,
          subject: payload.title,
          body: payload.body,
          metadata: payload.data ?? {},
          priority: payload.priority,
        },
      };

      await this.notificationsQueue.add('send-web-push', jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });
    }

    this.logger.log(`Queued ${subscriptions.length} web push notification(s) for user ${recipientId}`);
  }
}
