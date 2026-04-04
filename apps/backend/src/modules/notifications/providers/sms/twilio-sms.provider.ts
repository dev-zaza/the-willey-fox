import { Logger } from '@nestjs/common';
import { Twilio } from 'twilio';
import type { INotificationProvider, NotificationPayload, NotificationResult } from '../notification-provider.interface';

export class TwilioSmsProvider implements INotificationProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);
  private readonly client: Twilio;
  private readonly fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.client = new Twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
    this.logger.log('Twilio SMS provider initialized');
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const message = await this.client.messages.create({
        body: payload.body,
        to: payload.recipient,
        from: this.fromNumber,
      });

      this.logger.log(`SMS sent to ${payload.recipient} (sid: ${message.sid})`);

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Twilio error';
      this.logger.error(`Failed to send SMS to ${payload.recipient}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
