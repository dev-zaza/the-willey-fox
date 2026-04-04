import { Logger } from '@nestjs/common';
import type { INotificationProvider, NotificationPayload, NotificationResult } from '../notification-provider.interface';

export class ConsolePushProvider implements INotificationProvider {
  private readonly logger = new Logger(ConsolePushProvider.name);

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    this.logger.log(`[CONSOLE] Sending push notification to ${payload.recipient}`);
    this.logger.debug(`Title: ${payload.subject}`);
    this.logger.debug(`Body: ${payload.body.substring(0, 200)}`);

    return {
      success: true,
      messageId: `push-console-${Date.now()}`,
    };
  }
}
