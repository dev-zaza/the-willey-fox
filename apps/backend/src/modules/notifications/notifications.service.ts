import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { qrCodes, users, guardianMappings, notificationLogs, reports } from '../../database/schema';
import { eq, and, gt, count, desc } from 'drizzle-orm';
import { buildEmailNotification, buildSmsNotification, buildPushNotification } from './templates/report-notification';
import {
  buildGuardianRequestEmail,
  buildGuardianRequestSms,
  buildGuardianRequestPush,
  buildGuardianApprovedEmail,
  buildGuardianApprovedSms,
  buildGuardianApprovedPush,
  buildGuardianRemovedEmail,
  buildGuardianRemovedSms,
  buildGuardianRemovedPush,
  buildGuardianRejectedEmail,
  buildGuardianRejectedPush,
  buildGuardianInviteEmail,
} from './templates/guardian-notification';
import { buildReportResponseEmail, buildReportResponseSms } from './templates/response-notification';
import type { NotificationJobData } from './processors/notification.processor';

interface NotificationPreferences {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  async sendAuthEmail(
    recipientEmail: string,
    recipientId: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const [log] = await this.db
      .insert(notificationLogs)
      .values({
        type: 'email',
        recipientId,
        recipientContact: recipientEmail,
        subject,
        body,
        metadata: { purpose: 'auth' },
        status: 'pending',
      })
      .returning();

    const jobData: NotificationJobData = {
      logId: log.id,
      type: 'email',
      payload: {
        recipient: recipientEmail,
        subject,
        body,
        metadata: { purpose: 'auth' },
      },
    };

    await this.notificationsQueue.add('send-email', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    this.logger.log(`Auth email queued for ${recipientEmail} (logId: ${log.id})`);
  }

  /**
   * Generic push notification to a user (requires FCM token stored on user record).
   */
  async sendPush(
    recipientId: string,
    payload: { title: string; body: string; data?: Record<string, unknown> },
    options?: { priority?: 'normal' | 'critical' },
  ): Promise<void> {
    const [user] = await this.db
      .select({ fcmToken: users.fcmToken })
      .from(users)
      .where(eq(users.id, recipientId))
      .limit(1);

    if (!user?.fcmToken) {
      this.logger.warn(`sendPush: no FCM token for user ${recipientId} — skipping`);
      return;
    }

    const [log] = await this.db
      .insert(notificationLogs)
      .values({
        type: 'push',
        recipientId,
        recipientContact: user.fcmToken,
        subject: payload.title,
        body: payload.body,
        metadata: payload.data ?? {},
        status: 'pending',
      })
      .returning();

    const jobData: NotificationJobData = {
      logId: log.id,
      type: 'push',
      payload: {
        recipient: user.fcmToken,
        subject: payload.title,
        body: payload.body,
        metadata: payload.data ?? {},
        priority: options?.priority,
      },
    };

    await this.notificationsQueue.add('send-push', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  /**
   * Send an SMS directly to a phone number. Used for OTP flows where no user account
   * log is needed. Queues a BullMQ job so delivery is async and retried on failure.
   */
  async sendSmsRaw(phoneNumber: string, body: string): Promise<void> {
    const [log] = await this.db
      .insert(notificationLogs)
      .values({
        type: 'sms',
        recipientId: null,
        recipientContact: phoneNumber,
        body,
        metadata: { purpose: 'otp' },
        status: 'pending',
      })
      .returning();

    const jobData: NotificationJobData = {
      logId: log.id,
      type: 'sms',
      payload: { recipient: phoneNumber, body, metadata: { purpose: 'otp' } },
    };

    await this.notificationsQueue.add('send-sms', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  async notifyGuardiansOfReport(reportId: string, qrCodeId: string): Promise<void> {
    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, qrCodeId))
      .limit(1);

    if (!qrCode) {
      this.logger.warn(`QR code ${qrCodeId} not found for notification`);
      return;
    }

    if (!qrCode.userId) {
      this.logger.warn(`QR code ${qrCodeId} has no owner (unclaimed) — skipping notification`);
      return;
    }

    const [owner] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, qrCode.userId))
      .limit(1);

    const activeGuardians = await this.db
      .select({ userId: guardianMappings.userId })
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.qrCodeId, qrCodeId),
          eq(guardianMappings.status, 'active'),
        ),
      );

    const guardianUsers = await Promise.all(
      activeGuardians.map(async (g) => {
        const [user] = await this.db
          .select()
          .from(users)
          .where(eq(users.id, g.userId))
          .limit(1);
        return user;
      }),
    );

    const allRecipients = [owner, ...guardianUsers.filter(Boolean)];

    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');
    const apiBase = this.configService.get<string>('API_BASE_URL', 'http://localhost:3000/api/v1');
    const portalUrl = `${baseUrl}/q/${qrCode.uniqueCode}`;

    for (const recipient of allRecipients) {
      if (!recipient) continue;

      const prefs = (recipient.notificationPreferences || {}) as NotificationPreferences;
      const unsubscribeUrl = `${apiBase}/notifications/unsubscribe?token=${this.generateUnsubscribeToken(recipient.id)}`;

      const reportData = {
        itemName: qrCode.name,
        itemCategory: qrCode.category,
        reportTime: new Date(),
        portalUrl,
        unsubscribeUrl,
      };

      // Default to email and SMS when no preferences are set (null/empty object)
      const emailEnabled = prefs.email !== false;
      const smsEnabled = prefs.sms !== false;
      if (emailEnabled && recipient.email) {
        await this.queueNotification('email', recipient.id, recipient.email, reportId, reportData);
      }
      if (smsEnabled && recipient.phone) {
        await this.queueNotification('sms', recipient.id, recipient.phone, reportId, reportData);
      }
      if (prefs.push && recipient.fcmToken) {
        await this.queueNotification('push', recipient.id, recipient.fcmToken, reportId, reportData);
      }
    }

    this.logger.log(`Queued notifications for report ${reportId} to ${allRecipients.length} recipients`);
  }

  async notifyOwnerOfGuardianRequest(
    ownerId: string,
    qrCodeId: string,
    requesterId: string,
  ): Promise<void> {
    const [[owner], [requester], [qrCode]] = await Promise.all([
      this.db.select().from(users).where(eq(users.id, ownerId)).limit(1),
      this.db.select().from(users).where(eq(users.id, requesterId)).limit(1),
      this.db.select().from(qrCodes).where(eq(qrCodes.id, qrCodeId)).limit(1),
    ]);

    if (!owner || !requester || !qrCode) {
      this.logger.warn(`notifyOwnerOfGuardianRequest: missing data (owner=${ownerId}, requester=${requesterId}, qr=${qrCodeId})`);
      return;
    }

    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');
    const apiBase = this.configService.get<string>('API_BASE_URL', 'http://localhost:3000/api/v1');
    const approvalUrl = `${baseUrl}/dashboard/qr/${qrCodeId}/guardians`;
    const requesterName = `${requester.firstName} ${requester.lastName}`;
    const unsubscribeUrl = `${apiBase}/notifications/unsubscribe?token=${this.generateUnsubscribeToken(owner.id)}`;

    const templateData = {
      requesterName,
      itemName: qrCode.name,
      itemCategory: qrCode.category,
      approvalUrl,
      unsubscribeUrl,
    };

    const prefs = (owner.notificationPreferences || {}) as NotificationPreferences;

    if (prefs.email && owner.email) {
      const { subject, body } = buildGuardianRequestEmail(templateData);
      await this.queueGuardianNotification('email', owner.id, owner.email, qrCodeId, subject, body);
    }
    if (prefs.sms && owner.phone) {
      const { body } = buildGuardianRequestSms(templateData);
      await this.queueGuardianNotification('sms', owner.id, owner.phone, qrCodeId, undefined, body);
    }
    if (prefs.push && owner.fcmToken) {
      const { subject, body } = buildGuardianRequestPush(templateData);
      await this.queueGuardianNotification('push', owner.id, owner.fcmToken, qrCodeId, subject, body);
    }

    this.logger.log(`Guardian request notification queued for owner ${ownerId}`);
  }

  async notifyGuardianOfApproval(
    guardianId: string,
    qrCodeId: string,
    ownerId: string,
  ): Promise<void> {
    const [[guardian], [owner], [qrCode]] = await Promise.all([
      this.db.select().from(users).where(eq(users.id, guardianId)).limit(1),
      this.db.select().from(users).where(eq(users.id, ownerId)).limit(1),
      this.db.select().from(qrCodes).where(eq(qrCodes.id, qrCodeId)).limit(1),
    ]);

    if (!guardian || !owner || !qrCode) {
      this.logger.warn(`notifyGuardianOfApproval: missing data (guardian=${guardianId}, owner=${ownerId}, qr=${qrCodeId})`);
      return;
    }

    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');
    const apiBase = this.configService.get<string>('API_BASE_URL', 'http://localhost:3000/api/v1');
    const itemUrl = `${baseUrl}/q/${qrCode.uniqueCode}`;
    const unsubscribeUrl = `${apiBase}/notifications/unsubscribe?token=${this.generateUnsubscribeToken(guardian.id)}`;

    const templateData = {
      ownerName: `${owner.firstName} ${owner.lastName}`,
      itemName: qrCode.name,
      itemCategory: qrCode.category,
      itemUrl,
      unsubscribeUrl,
    };

    const prefs = (guardian.notificationPreferences || {}) as NotificationPreferences;

    if (prefs.email && guardian.email) {
      const { subject, body } = buildGuardianApprovedEmail(templateData);
      await this.queueGuardianNotification('email', guardian.id, guardian.email, qrCodeId, subject, body);
    }
    if (prefs.sms && guardian.phone) {
      const { body } = buildGuardianApprovedSms(templateData);
      await this.queueGuardianNotification('sms', guardian.id, guardian.phone, qrCodeId, undefined, body);
    }
    if (prefs.push && guardian.fcmToken) {
      const { subject, body } = buildGuardianApprovedPush(templateData);
      await this.queueGuardianNotification('push', guardian.id, guardian.fcmToken, qrCodeId, subject, body);
    }

    this.logger.log(`Guardian approval notification queued for guardian ${guardianId}`);
  }

  async notifyGuardianOfRemoval(
    guardianId: string,
    qrCodeId: string,
    removedBy: string,
  ): Promise<void> {
    const [[guardian], [qrCode]] = await Promise.all([
      this.db.select().from(users).where(eq(users.id, guardianId)).limit(1),
      this.db.select().from(qrCodes).where(eq(qrCodes.id, qrCodeId)).limit(1),
    ]);

    if (!guardian || !qrCode) {
      this.logger.warn(`notifyGuardianOfRemoval: missing data (guardian=${guardianId}, qr=${qrCodeId})`);
      return;
    }

    const apiBase = this.configService.get<string>('API_BASE_URL', 'http://localhost:3000/api/v1');
    const unsubscribeUrl = `${apiBase}/notifications/unsubscribe?token=${this.generateUnsubscribeToken(guardian.id)}`;

    const templateData = {
      itemName: qrCode.name,
      itemCategory: qrCode.category,
      removedBy,
      unsubscribeUrl,
    };

    const prefs = (guardian.notificationPreferences || {}) as NotificationPreferences;

    if (prefs.email && guardian.email) {
      const { subject, body } = buildGuardianRemovedEmail(templateData);
      await this.queueGuardianNotification('email', guardian.id, guardian.email, qrCodeId, subject, body);
    }
    if (prefs.sms && guardian.phone) {
      const { body } = buildGuardianRemovedSms(templateData);
      await this.queueGuardianNotification('sms', guardian.id, guardian.phone, qrCodeId, undefined, body);
    }
    if (prefs.push && guardian.fcmToken) {
      const { subject, body } = buildGuardianRemovedPush(templateData);
      await this.queueGuardianNotification('push', guardian.id, guardian.fcmToken, qrCodeId, subject, body);
    }

    this.logger.log(`Guardian removal notification queued for guardian ${guardianId}`);
  }

  async notifyGuardianOfRejection(guardianId: string, qrCodeId: string): Promise<void> {
    const [[guardian], [qrCode]] = await Promise.all([
      this.db.select().from(users).where(eq(users.id, guardianId)).limit(1),
      this.db.select().from(qrCodes).where(eq(qrCodes.id, qrCodeId)).limit(1),
    ]);

    if (!guardian || !qrCode) {
      this.logger.warn(`notifyGuardianOfRejection: missing data (guardian=${guardianId}, qr=${qrCodeId})`);
      return;
    }

    const apiBase = this.configService.get<string>('API_BASE_URL', 'http://localhost:3000/api/v1');
    const unsubscribeUrl = `${apiBase}/notifications/unsubscribe?token=${this.generateUnsubscribeToken(guardian.id)}`;

    const templateData = {
      itemName: qrCode.name,
      itemCategory: qrCode.category,
      unsubscribeUrl,
    };

    const prefs = (guardian.notificationPreferences || {}) as NotificationPreferences;

    if (prefs.email !== false && guardian.email) {
      const { subject, body } = buildGuardianRejectedEmail(templateData);
      await this.queueGuardianNotification('email', guardian.id, guardian.email, qrCodeId, subject, body);
    }
    if (prefs.push && guardian.fcmToken) {
      const { subject, body } = buildGuardianRejectedPush(templateData);
      await this.queueGuardianNotification('push', guardian.id, guardian.fcmToken, qrCodeId, subject, body);
    }

    this.logger.log(`Guardian rejection notification queued for guardian ${guardianId}`);
  }

  async sendGuardianInviteEmail(
    email: string,
    inviterName: string,
    itemName: string,
    itemCategory: string,
    acceptUrl: string,
    expiresAt: Date,
  ): Promise<void> {
    const { subject, body } = buildGuardianInviteEmail({
      inviterName,
      itemName,
      itemCategory,
      acceptUrl,
      expiresAt,
    });

    const [log] = await this.db
      .insert(notificationLogs)
      .values({
        type: 'email',
        recipientId: null,
        recipientContact: email,
        subject,
        body,
        metadata: { purpose: 'guardian-invite' },
        status: 'pending',
      })
      .returning();

    const jobData: NotificationJobData = {
      logId: log.id,
      type: 'email',
      payload: { recipient: email, subject, body, metadata: { purpose: 'guardian-invite' } },
    };

    await this.notificationsQueue.add('send-email', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    this.logger.log(`Guardian invite email queued for ${email}`);
  }

  async notifyFinderOfResponse(
    reportId: string,
    responseMessage: string,
    guardianName: string,
  ): Promise<void> {
    const [report] = await this.db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report || !report.finderContact) {
      this.logger.warn(`notifyFinderOfResponse: report ${reportId} not found or has no finder contact`);
      return;
    }

    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, report.qrCodeId))
      .limit(1);

    if (!qrCode) {
      this.logger.warn(`notifyFinderOfResponse: QR code not found for report ${reportId}`);
      return;
    }

    const baseUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');
    const conversationUrl = `${baseUrl}/q/${qrCode.uniqueCode}/report/${reportId}`;

    const templateData = {
      itemName: qrCode.name,
      itemCategory: qrCode.category,
      guardianName,
      responseMessage,
      conversationUrl,
    };

    const contact = report.finderContact;
    const isEmail = contact.includes('@');

    if (isEmail) {
      const { subject, body } = buildReportResponseEmail(templateData);
      await this.queueResponseNotification('email', contact, reportId, subject, body);
    } else {
      const { body } = buildReportResponseSms(templateData);
      await this.queueResponseNotification('sms', contact, reportId, undefined, body);
    }

    this.logger.log(`Finder response notification queued for report ${reportId}`);
  }

  // ─── Notification list (for web bell) ────────────────────────────────────────

  async listNotifications(userId: string): Promise<{
    notifications: Array<{
      id: string;
      type: string;
      subject: string | null;
      body: string;
      status: string;
      metadata: Record<string, unknown>;
      createdAt: Date;
      isRead: boolean;
    }>;
    unreadCount: number;
  }> {
    const [userRow] = await this.db
      .select({ lastNotificationReadAt: users.lastNotificationReadAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const logs = await this.db
      .select({
        id: notificationLogs.id,
        type: notificationLogs.type,
        subject: notificationLogs.subject,
        body: notificationLogs.body,
        status: notificationLogs.status,
        metadata: notificationLogs.metadata,
        createdAt: notificationLogs.createdAt,
      })
      .from(notificationLogs)
      .where(eq(notificationLogs.recipientId, userId))
      .orderBy(desc(notificationLogs.createdAt))
      .limit(50);

    // Count unread: entries created after lastNotificationReadAt
    const lastRead = userRow?.lastNotificationReadAt ?? null;
    let unreadCount = 0;
    if (lastRead) {
      const [row] = await this.db
        .select({ cnt: count() })
        .from(notificationLogs)
        .where(
          and(
            eq(notificationLogs.recipientId, userId),
            gt(notificationLogs.createdAt, lastRead),
          ),
        );
      unreadCount = Number(row?.cnt ?? 0);
    } else {
      unreadCount = logs.length;
    }

    const notifications = logs.map((log) => ({
      id: log.id,
      type: log.type,
      subject: log.subject,
      // Strip HTML tags so mobile/web shows plain text
      body: log.body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200),
      status: log.status,
      metadata: (log.metadata as Record<string, unknown>) ?? {},
      createdAt: log.createdAt,
      isRead: lastRead ? log.createdAt <= lastRead : false,
    }));

    return { notifications, unreadCount };
  }

  async markNotificationsRead(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastNotificationReadAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // ─── Unsubscribe ──────────────────────────────────────────────────────────────

  generateUnsubscribeToken(userId: string): string {
    return createHmac('sha256', this.configService.get('NOTIFICATIONS_UNSUBSCRIBE_SECRET', 'dev-secret'))
      .update(userId)
      .digest('hex');
  }

  async processUnsubscribe(token: string): Promise<boolean> {
    // Find user whose token matches
    const allUsers = await this.db
      .select({ id: users.id, notificationPreferences: users.notificationPreferences })
      .from(users);

    for (const user of allUsers) {
      const expected = this.generateUnsubscribeToken(user.id);
      if (expected === token) {
        const prefs = ((user.notificationPreferences as NotificationPreferences) || {});
        await this.db
          .update(users)
          .set({
            notificationPreferences: { ...prefs, email: false },
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));
        return true;
      }
    }
    return false;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async queueGuardianNotification(
    type: 'email' | 'sms' | 'push',
    recipientId: string,
    contact: string,
    qrCodeId: string,
    subject: string | undefined,
    body: string,
  ): Promise<void> {
    const [log] = await this.db
      .insert(notificationLogs)
      .values({
        type,
        recipientId,
        recipientContact: contact,
        subject,
        body,
        metadata: { qrCodeId },
        status: 'pending',
      })
      .returning();

    const jobData: NotificationJobData = {
      logId: log.id,
      type,
      payload: { recipient: contact, subject, body, metadata: { qrCodeId } },
    };

    await this.notificationsQueue.add(`send-${type}`, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  private async queueResponseNotification(
    type: 'email' | 'sms',
    contact: string,
    reportId: string,
    subject: string | undefined,
    body: string,
  ): Promise<void> {
    const [log] = await this.db
      .insert(notificationLogs)
      .values({
        type,
        recipientId: null,
        recipientContact: contact,
        subject,
        body,
        metadata: { reportId },
        status: 'pending',
      })
      .returning();

    const jobData: NotificationJobData = {
      logId: log.id,
      type,
      payload: { recipient: contact, subject, body, metadata: { reportId } },
    };

    await this.notificationsQueue.add(`send-${type}`, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  private async queueNotification(
    type: 'email' | 'sms' | 'push',
    recipientId: string,
    recipientContact: string,
    reportId: string,
    reportData: {
      itemName: string;
      itemCategory: string;
      locationAddress?: string;
      finderNotes?: string;
      reportTime: Date;
      portalUrl: string;
    },
  ): Promise<void> {
    let subject: string | undefined;
    let body: string;

    if (type === 'email') {
      const email = buildEmailNotification(reportData);
      subject = email.subject;
      body = email.body;
    } else if (type === 'sms') {
      const sms = buildSmsNotification(reportData);
      body = sms.body;
    } else {
      const push = buildPushNotification(reportData);
      subject = push.subject;
      body = push.body;
    }

    const [log] = await this.db
      .insert(notificationLogs)
      .values({
        type,
        recipientId,
        recipientContact,
        subject,
        body,
        metadata: { reportId },
        status: 'pending',
      })
      .returning();

    const jobData: NotificationJobData = {
      logId: log.id,
      type,
      payload: {
        recipient: recipientContact,
        subject,
        body,
        metadata: { reportId },
      },
    };

    await this.notificationsQueue.add(`send-${type}`, jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }
}
