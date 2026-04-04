import { Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { INotificationProvider, NotificationPayload, NotificationResult } from '../notification-provider.interface';

export class FcmPushProvider implements INotificationProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  private readonly app: admin.app.App;

  constructor(projectId: string, clientEmail: string, privateKey: string) {
    this.app = admin.initializeApp(
      {
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      },
      `safetag-fcm-${Date.now()}`,
    );
    this.logger.log(`FCM push provider initialized (project: ${projectId})`);
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const isCritical = payload.priority === 'critical';
      const messageId = await this.app.messaging().send({
        token: payload.recipient,
        notification: {
          title: payload.subject,
          body: payload.body,
        },
        data: payload.metadata
          ? Object.fromEntries(
              Object.entries(payload.metadata).map(([k, v]) => [k, String(v)]),
            )
          : undefined,
        android: isCritical ? { priority: 'high' } : undefined,
        apns: isCritical
          ? { headers: { 'apns-priority': '10' } }
          : undefined,
      });

      this.logger.log(`Push notification sent to ${payload.recipient} (messageId: ${messageId})`);

      return { success: true, messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown FCM error';
      this.logger.error(`Failed to send push to ${payload.recipient}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
}
