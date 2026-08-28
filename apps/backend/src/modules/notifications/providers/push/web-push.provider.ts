import { Logger } from '@nestjs/common';
import webpush from 'web-push';
import type { INotificationProvider, NotificationPayload, NotificationResult } from '../notification-provider.interface';

export interface WebPushRecipient {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export class WebPushProvider implements INotificationProvider {
  private readonly logger = new Logger(WebPushProvider.name);

  constructor(
    private readonly publicKey: string,
    private readonly privateKey: string,
    private readonly subject: string,
  ) {
    webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
    this.logger.log('Web Push provider initialized');
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const subscription = JSON.parse(payload.recipient) as WebPushRecipient;
      const pushPayload = JSON.stringify({
        title: payload.subject ?? 'TheWileyfox',
        body: payload.body,
        data: payload.metadata ?? {},
      });

      const result = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        pushPayload,
        payload.priority === 'critical' ? { urgency: 'high' } : undefined,
      );

      this.logger.log(`Web push sent to ${subscription.endpoint.slice(0, 48)}… (status: ${result.statusCode})`);

      return {
        success: true,
        messageId: String(result.statusCode),
      };
    } catch (error) {
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? Number((error as { statusCode: number }).statusCode)
          : undefined;
      const errorMessage = error instanceof Error ? error.message : 'Unknown Web Push error';
      this.logger.error(`Failed to send web push: ${errorMessage}`);

      return {
        success: false,
        error: statusCode ? `${statusCode}:${errorMessage}` : errorMessage,
      };
    }
  }
}
