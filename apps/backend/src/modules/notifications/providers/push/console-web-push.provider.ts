import { Logger } from '@nestjs/common';
import type { INotificationProvider, NotificationPayload, NotificationResult } from '../notification-provider.interface';

export class ConsoleWebPushProvider implements INotificationProvider {
  private readonly logger = new Logger(ConsoleWebPushProvider.name);

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    this.logger.log(`[CONSOLE] Sending web push notification`);
    this.logger.debug(`Title: ${payload.subject}`);
    this.logger.debug(`Body: ${payload.body.substring(0, 200)}`);

    return {
      success: true,
      messageId: `web-push-console-${Date.now()}`,
    };
  }
}
