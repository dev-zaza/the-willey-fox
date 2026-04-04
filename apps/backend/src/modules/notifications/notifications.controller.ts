import { Controller, Get, Patch, Query, Res, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * One-click unsubscribe from email notifications.
   * Token is HMAC-SHA256 of userId using NOTIFICATIONS_UNSUBSCRIBE_SECRET.
   * Returns a plain HTML confirmation page (no auth required).
   */
  @Public()
  @Get('unsubscribe')
  async unsubscribe(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!token) {
      res.status(HttpStatus.BAD_REQUEST).send(this.buildHtmlPage(
        'Invalid Link',
        'This unsubscribe link is invalid or has expired.',
        '#ef4444',
      ));
      return;
    }

    const success = await this.notificationsService.processUnsubscribe(token);

    if (success) {
      res.status(HttpStatus.OK).send(this.buildHtmlPage(
        'Unsubscribed',
        'You have been successfully unsubscribed from email notifications. You can re-enable emails in your account settings.',
        '#16a34a',
      ));
    } else {
      res.status(HttpStatus.NOT_FOUND).send(this.buildHtmlPage(
        'Link Not Found',
        'This unsubscribe link is invalid or has already been used.',
        '#f97316',
      ));
    }
  }

  /**
   * List the authenticated user's recent notifications (newest first, limit 20).
   */
  @Get()
  async listNotifications(@CurrentUser('id') userId: string) {
    return this.notificationsService.listNotifications(userId);
  }

  /**
   * Mark all notifications as read by updating last_notification_read_at.
   */
  @Patch('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@CurrentUser('id') userId: string): Promise<void> {
    await this.notificationsService.markNotificationsRead(userId);
  }

  private buildHtmlPage(title: string, message: string, accentColor: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — TheWileyfox</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #fff; border-radius: 12px; padding: 40px 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { width: 56px; height: 56px; border-radius: 50%; background: ${accentColor}; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; font-size: 24px; color: #fff; }
    h1 { font-size: 22px; color: #111827; margin-bottom: 12px; }
    p { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 24px; }
    a { display: inline-block; padding: 10px 24px; background: #f97316; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; }
    .brand { font-size: 12px; color: #9ca3af; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/">Return to TheWileyfox</a>
    <p class="brand">TheWileyfox — Lost &amp; Found Recovery</p>
  </div>
</body>
</html>`;
  }
}
