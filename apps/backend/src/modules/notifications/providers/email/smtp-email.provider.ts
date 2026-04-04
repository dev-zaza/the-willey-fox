import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { INotificationProvider, NotificationPayload, NotificationResult } from '../notification-provider.interface';

export class SmtpEmailProvider implements INotificationProvider {
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(
    host: string,
    port: number,
    user: string,
    pass: string,
    fromAddress: string,
  ) {
    this.fromAddress = fromAddress;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    this.logger.log(`SMTP email provider initialized (host: ${host})`);
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: payload.recipient,
        subject: payload.subject,
        html: payload.body,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        this.logger.log(`Ethereal preview: ${previewUrl}`);
      }

      this.logger.log(`Email sent to ${payload.recipient} (messageId: ${info.messageId})`);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown SMTP error';
      this.logger.error(`Failed to send email to ${payload.recipient}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
}
