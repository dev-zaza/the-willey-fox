import { Logger } from '@nestjs/common';
import type { INotificationProvider, NotificationPayload, NotificationResult } from '../notification-provider.interface';

export class ConsoleEmailProvider implements INotificationProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    this.logger.log(`[CONSOLE] Sending email to ${payload.recipient}`);
    this.logger.debug(`Subject: ${payload.subject}`);
    this.logger.debug(`Body: ${payload.body.substring(0, 200)}...`);

    return {
      success: true,
      messageId: `email-console-${Date.now()}`,
    };
  }
}
