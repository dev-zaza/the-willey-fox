import { Logger } from '@nestjs/common';
import type { INotificationProvider, NotificationPayload, NotificationResult } from '../notification-provider.interface';

export class ConsoleSmsProvider implements INotificationProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    this.logger.log(`[CONSOLE] Sending SMS to ${payload.recipient}`);
    this.logger.debug(`Body: ${payload.body.substring(0, 160)}`);

    return {
      success: true,
      messageId: `sms-console-${Date.now()}`,
    };
  }
}
