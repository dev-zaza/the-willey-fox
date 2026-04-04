import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { desc, eq, ilike, or, count, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { users, qrCodes, reports, pins, dataIngestionLogs, safetyZones, adminAuditLogs, userReports } from '../../database/schema';
import { QrService } from '../qr/qr.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from './audit-log.service';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { BanUserDto } from './dto/ban-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly qrService: QrService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listUsers(query?: string, limit = 50, offset = 0) {
    const base = this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionTier: users.subscriptionTier,
        isVerified: users.isVerified,
        isAdmin: users.isAdmin,
        isBanned: users.isBanned,
        banReason: users.banReason,
        bannedAt: users.bannedAt,
        createdAt: users.createdAt,
      })
      .from(users);

    if (query && query.trim().length >= 2) {
      const term = `%${query.trim()}%`;
      return base
        .where(or(ilike(users.email, term), ilike(users.firstName, term), ilike(users.lastName, term)))
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return base.orderBy(desc(users.createdAt)).limit(limit).offset(offset);
  }

  async banUser(adminId: string, userId: string, dto: BanUserDto) {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');

    await this.db
      .update(users)
      .set({
        isBanned: true,
        banReason: dto.reason,
        bannedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Send email notification to the banned user
    void this.notificationsService.sendAuthEmail(
      user.email,
      userId,
      'Your account has been suspended',
      `Your TheWileyfox account has been suspended.\n\nReason: ${dto.reason}\n\nIf you believe this is an error, please contact support.`,
    );

    // Audit log
    this.auditLogService.log(adminId, 'BAN_USER', 'user', userId, { reason: dto.reason });

    return { message: 'User banned.' };
  }

  async unbanUser(adminId: string, userId: string) {
    await this.db
      .update(users)
      .set({ isBanned: false, banReason: null, bannedAt: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    this.auditLogService.log(adminId, 'UNBAN_USER', 'user', userId);
    return { message: 'User unbanned.' };
  }

  async listQrCodes(limit = 50, offset = 0) {
    return this.db
      .select()
      .from(qrCodes)
      .orderBy(desc(qrCodes.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async listReports(limit = 50, offset = 0, status?: string) {
    const query = this.db.select().from(reports).$dynamic();
    if (status) {
      return query
        .where(eq(reports.status, status as any))
        .orderBy(desc(reports.createdAt))
        .limit(limit)
        .offset(offset);
    }
    return query.orderBy(desc(reports.createdAt)).limit(limit).offset(offset);
  }

  async updateReportStatus(adminId: string, reportId: string, status: string) {
    const [report] = await this.db.select({ id: reports.id }).from(reports).where(eq(reports.id, reportId)).limit(1);
    if (!report) throw new NotFoundException('REPORT_NOT_FOUND');
    const [updated] = await this.db
      .update(reports)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(reports.id, reportId))
      .returning();

    this.auditLogService.log(adminId, 'UPDATE_REPORT_STATUS', 'report', reportId, { status });
    return updated;
  }

  async listPins(limit = 50, offset = 0) {
    return this.db
      .select()
      .from(pins)
      .orderBy(desc(pins.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async deletePin(adminId: string, pinId: string) {
    const [pin] = await this.db.select({ id: pins.id }).from(pins).where(eq(pins.id, pinId)).limit(1);
    if (!pin) throw new NotFoundException('PIN_NOT_FOUND');
    await this.db.delete(pins).where(eq(pins.id, pinId));

    this.auditLogService.log(adminId, 'DELETE_PIN', 'pin', pinId);
    return { message: 'Pin deleted.' };
  }

  async getAnalytics() {
    const [userCount] = await this.db.select({ count: count() }).from(users);
    const [qrCount] = await this.db.select({ count: count() }).from(qrCodes);
    const [reportCount] = await this.db.select({ count: count() }).from(reports);
    const [pinCount] = await this.db.select({ count: count() }).from(pins);
    const [safetyZoneCount] = await this.db.select({ count: count() }).from(safetyZones);

    // Time-series: new users per day for last 30 days
    const newUsersRows = await this.db.execute(sql`
      SELECT
        DATE_TRUNC('day', created_at)::date AS date,
        COUNT(*)::int AS count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1
    `);

    // Time-series: reports per day for last 30 days
    const reportsRows = await this.db.execute(sql`
      SELECT
        DATE_TRUNC('day', created_at)::date AS date,
        COUNT(*)::int AS count
      FROM reports
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1
    `);

    return {
      totals: {
        users: userCount.count,
        qrCodes: qrCount.count,
        reports: reportCount.count,
        pins: pinCount.count,
        safetyZones: safetyZoneCount.count,
      },
      timeSeries: {
        newUsersLast30Days: Array.from(newUsersRows).map((r) => ({ date: (r as any).date, count: (r as any).count })),
        reportsLast30Days: Array.from(reportsRows).map((r) => ({ date: (r as any).date, count: (r as any).count })),
      },
    };
  }

  async listIngestionLogs(limit = 50, offset = 0) {
    return this.db
      .select()
      .from(dataIngestionLogs)
      .orderBy(desc(dataIngestionLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async bulkGenerateUnclaimed(adminId: string, count: number, shopifyOrderId?: string) {
    const result = await this.qrService.bulkGenerateUnclaimed(count, shopifyOrderId);
    this.auditLogService.log(adminId, 'BULK_GENERATE_QR', 'qr', undefined, { count });
    return result;
  }

  getPricingConfig() {
    return this.settingsService.getPricingConfig();
  }

  updatePricingConfig(adminId: string, dto: UpdatePricingDto) {
    this.auditLogService.log(adminId, 'UPDATE_PRICING', 'settings', 'pricing');
    return this.settingsService.setPricingConfig(dto);
  }

  getQrCategories() {
    return this.settingsService.getQrCategories();
  }

  async updateQrCategory(adminId: string, value: string, patch: { label?: string; enabled?: boolean }) {
    this.auditLogService.log(adminId, 'UPDATE_QR_CATEGORY', 'settings', value, patch);
    return this.settingsService.updateQrCategory(value, patch);
  }

  getQrTemplate() {
    return this.settingsService.getQrTemplate();
  }

  updateQrTemplate(adminId: string, patch: Record<string, unknown>) {
    this.auditLogService.log(adminId, 'UPDATE_QR_TEMPLATE', 'settings', 'qr_template', patch);
    return this.settingsService.setQrTemplate(patch as any);
  }

  async listSafetyZones(limit = 50, offset = 0) {
    return this.db
      .select({
        id: safetyZones.id,
        source: safetyZones.source,
        sourceRegion: safetyZones.sourceRegion,
        safetyScore: safetyZones.safetyScore,
        periodStart: safetyZones.periodStart,
        periodEnd: safetyZones.periodEnd,
        updatedAt: safetyZones.updatedAt,
      })
      .from(safetyZones)
      .orderBy(desc(safetyZones.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  async listAuditLogs(limit = 50, offset = 0) {
    return this.db
      .select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async listUserReports(limit = 50, offset = 0) {
    return this.db
      .select()
      .from(userReports)
      .orderBy(desc(userReports.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async dismissUserReport(adminId: string, reportId: string) {
    const [report] = await this.db
      .select({ id: userReports.id })
      .from(userReports)
      .where(eq(userReports.id, reportId))
      .limit(1);

    if (!report) throw new NotFoundException('REPORT_NOT_FOUND');

    await this.db
      .delete(userReports)
      .where(eq(userReports.id, reportId));

    this.auditLogService.log(adminId, 'DISMISS_USER_REPORT', 'user_report', reportId);
    return { message: 'Report dismissed.' };
  }
}
