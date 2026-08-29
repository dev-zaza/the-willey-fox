import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { desc, eq, ilike, or, count, sql, and, gt, isNotNull } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { users, qrCodes, reports, pins, dataIngestionLogs, safetyZones, adminAuditLogs, userReports, qrBatches, appSettings } from '../../database/schema';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
import * as archiver from 'archiver';
import * as QRCode from 'qrcode';
import { QrService } from '../qr/qr.service';
import { SettingsService } from '../settings/settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from './audit-log.service';
import { BroadcastConsentLogService } from '../broadcasts/broadcast-consent-log.service';
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
    private readonly consentLogService: BroadcastConsentLogService,
  ) {}

  async listActiveBroadcasts(limit = 100, offset = 0) {
    const now = new Date();
    return this.db
      .select({
        id: reports.id,
        qrCodeId: qrCodes.id,
        qrUniqueCode: qrCodes.uniqueCode,
        qrCategory: qrCodes.category,
        qrName: qrCodes.name,
        qrLabel: qrCodes.label,
        approvedAt: reports.broadcastApprovedAt,
        expiresAt: reports.broadcastExpiresAt,
        extendCount: reports.broadcastExtendCount,
        guardianUserId: qrCodes.userId,
      })
      .from(reports)
      .innerJoin(qrCodes, eq(reports.qrCodeId, qrCodes.id))
      .where(
        and(
          eq(reports.isPublicBroadcast, true),
          gt(reports.broadcastExpiresAt, now),
        ),
      )
      .orderBy(desc(reports.broadcastApprovedAt))
      .limit(limit)
      .offset(offset);
  }

  async takedownBroadcast(adminId: string, reportId: string, reason?: string) {
    const [report] = await this.db
      .select({ id: reports.id, isPublicBroadcast: reports.isPublicBroadcast })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report) throw new NotFoundException('BROADCAST_NOT_FOUND');

    await this.db
      .update(reports)
      .set({ isPublicBroadcast: false, updatedAt: new Date() })
      .where(eq(reports.id, reportId));

    await this.consentLogService.log({
      reportId,
      guardianUserId: adminId,
      action: 'admin_takedown',
      metadata: reason ? { reason, takedownBy: adminId } : { takedownBy: adminId },
    });

    this.auditLogService.log(adminId, 'broadcast.takedown', 'report', reportId, { reason });

    return { id: reportId, takenDown: true };
  }

  async getBroadcastConsentLog(reportId: string) {
    const [report] = await this.db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);
    if (!report) throw new NotFoundException('BROADCAST_NOT_FOUND');
    return this.consentLogService.getForReport(reportId);
  }

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

  async bulkGenerateUnclaimed(
    adminId: string,
    count: number,
    shopifyOrderId?: string,
    notes?: string,
    source: string = 'manual',
    productType?: string,
  ) {
    const [batch] = await this.db
      .insert(qrBatches)
      .values({
        createdByAdminId: adminId,
        count,
        shopifyOrderId: shopifyOrderId ?? null,
        notes: notes ?? null,
        source,
        productType: productType ?? null,
      })
      .returning();

    const codes = await this.qrService.bulkGenerateUnclaimed(count, shopifyOrderId, batch.id);
    this.auditLogService.log(adminId, 'BULK_GENERATE_QR', 'qr_batch', batch.id, { count, batchId: batch.id });
    return { batch, codes };
  }

  async listBatches(limit = 50, offset = 0, source?: string) {
    const query = this.db
      .select({
        id: qrBatches.id,
        count: qrBatches.count,
        shopifyOrderId: qrBatches.shopifyOrderId,
        notes: qrBatches.notes,
        source: qrBatches.source,
        productType: qrBatches.productType,
        createdByAdminId: qrBatches.createdByAdminId,
        createdAt: qrBatches.createdAt,
        adminFirstName: users.firstName,
        adminLastName: users.lastName,
        adminEmail: users.email,
      })
      .from(qrBatches)
      .leftJoin(users, eq(qrBatches.createdByAdminId, users.id))
      .$dynamic();

    const filtered = source ? query.where(eq(qrBatches.source, source)) : query;
    return filtered.orderBy(desc(qrBatches.createdAt)).limit(limit).offset(offset);
  }

  async getBatchCodes(batchId: string) {
    const [batch] = await this.db
      .select()
      .from(qrBatches)
      .where(eq(qrBatches.id, batchId))
      .limit(1);
    if (!batch) throw new NotFoundException('BATCH_NOT_FOUND');

    const codes = await this.db
      .select({ id: qrCodes.id, uniqueCode: qrCodes.uniqueCode, status: qrCodes.status, createdAt: qrCodes.createdAt })
      .from(qrCodes)
      .where(eq(qrCodes.batchId, batchId))
      .orderBy(qrCodes.uniqueCode);

    return { batch, codes };
  }

  /**
   * Deletes only the unclaimed QR codes from a batch.
   * Claimed codes (status = 'active', userId != null) are left untouched.
   * If all codes were unclaimed and are now deleted, the batch record itself
   * is also removed since it would be empty.
   */
  async deleteUnclaimedFromBatch(adminId: string, batchId: string): Promise<{ deleted: number; batchDeleted: boolean }> {
    const [batch] = await this.db
      .select({ id: qrBatches.id, count: qrBatches.count })
      .from(qrBatches)
      .where(eq(qrBatches.id, batchId))
      .limit(1);
    if (!batch) throw new NotFoundException('BATCH_NOT_FOUND');

    // Delete only codes that are still unclaimed (userId is null AND status = 'unclaimed')
    const deleted = await this.db
      .delete(qrCodes)
      .where(and(eq(qrCodes.batchId, batchId), eq(qrCodes.status, 'unclaimed')))
      .returning({ id: qrCodes.id });

    // Check if any claimed codes remain
    const [remaining] = await this.db
      .select({ count: count() })
      .from(qrCodes)
      .where(eq(qrCodes.batchId, batchId));

    let batchDeleted = false;
    if (remaining.count === 0) {
      // No codes remain — delete the empty batch record too
      await this.db.delete(qrBatches).where(eq(qrBatches.id, batchId));
      batchDeleted = true;
    }

    this.auditLogService.log(adminId, 'DELETE_UNCLAIMED_FROM_BATCH', 'qr_batch', batchId, {
      deleted: deleted.length,
      batchDeleted,
    });

    return { deleted: deleted.length, batchDeleted };
  }

  async exportBatchPdf(batchId: string, publicBaseUrl: string): Promise<Buffer> {
    const { batch, codes } = await this.getBatchCodes(batchId);

    const qrImages = await Promise.all(
      codes.map(async (c) => ({
        code: c.uniqueCode,
        status: c.status,
        png: await QRCode.toBuffer(`${publicBaseUrl}/q/${c.uniqueCode}`, {
          type: 'png', width: 120, margin: 1, errorCorrectionLevel: 'M',
        }),
      })),
    );

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('SafeTag QR Batch', { align: 'center' });
      doc.fontSize(10).font('Helvetica').fillColor('#666666')
        .text(`Batch ID: ${batch.id}`, { align: 'center' })
        .text(`Generated: ${new Date(batch.createdAt).toISOString().split('T')[0]}  ·  Count: ${batch.count}`, { align: 'center' });
      if (batch.notes) doc.text(`Notes: ${batch.notes}`, { align: 'center' });
      doc.moveDown(1.5);

      const pageWidth = doc.page.width - 80;
      const colCount = 4;
      const cellW = pageWidth / colCount;
      const cellH = 155;
      const perPage = colCount * 4;

      let pageStartY = doc.y;

      qrImages.forEach((item, i) => {
        const posOnPage = i % perPage;
        const col = posOnPage % colCount;
        const row = Math.floor(posOnPage / colCount);

        if (i > 0 && posOnPage === 0) {
          doc.addPage();
          pageStartY = 40;
        }

        const x = 40 + col * cellW;
        const y = pageStartY + row * cellH;

        doc.image(item.png, x + (cellW - 100) / 2, y, { width: 100, height: 100 });
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#1a1a1a')
          .text(item.code, x, y + 104, { width: cellW, align: 'center' });
        doc.fontSize(6).font('Helvetica').fillColor(item.status === 'unclaimed' ? '#059669' : '#6b7280')
          .text(item.status.toUpperCase(), x, y + 116, { width: cellW, align: 'center' });
      });

      doc.end();
    });
  }

  async exportBatchZip(batchId: string, publicBaseUrl: string): Promise<Buffer> {
    const { codes } = await this.getBatchCodes(batchId);

    return new Promise((resolve, reject) => {
      const archive = (archiver as any)('zip', { zlib: { level: 6 } });
      const chunks: Buffer[] = [];
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      const appendNext = async (i: number) => {
        if (i >= codes.length) { archive.finalize(); return; }
        const c = codes[i];
        try {
          const png = await QRCode.toBuffer(`${publicBaseUrl}/q/${c.uniqueCode}`, {
            type: 'png', width: 400, margin: 2, errorCorrectionLevel: 'M',
          });
          archive.append(png, { name: `${c.uniqueCode}.png` });
          appendNext(i + 1);
        } catch (err) { reject(err); }
      };

      appendNext(0);
    });
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

  // ── Account Deletion Requests ────────────────────────────────────────────────

  async listDeletionRequests(limit = 50, offset = 0) {
    return this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        subscriptionTier: users.subscriptionTier,
        deletionRequestedAt: users.deletionRequestedAt,
        deletionScheduledAt: users.deletionScheduledAt,
      })
      .from(users)
      .where(isNotNull(users.deletionRequestedAt))
      .orderBy(desc(users.deletionRequestedAt))
      .limit(limit)
      .offset(offset);
  }

  async approveDeletion(adminId: string, userId: string) {
    const [user] = await this.db
      .select({ id: users.id, email: users.email, deletionRequestedAt: users.deletionRequestedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    if (!user.deletionRequestedAt) throw new NotFoundException('NO_DELETION_REQUEST');

    await this.db.delete(users).where(eq(users.id, userId));

    this.auditLogService.log(adminId, 'APPROVE_ACCOUNT_DELETION', 'user', userId);
    return { message: 'Account permanently deleted.' };
  }

  async cancelDeletion(adminId: string, userId: string) {
    const [user] = await this.db
      .select({ id: users.id, deletionRequestedAt: users.deletionRequestedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    if (!user.deletionRequestedAt) throw new NotFoundException('NO_DELETION_REQUEST');

    await this.db
      .update(users)
      .set({ deletionRequestedAt: null, deletionScheduledAt: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    this.auditLogService.log(adminId, 'CANCEL_ACCOUNT_DELETION', 'user', userId);
    return { message: 'Deletion request cancelled.' };
  }

  async getDeletionSettings(): Promise<{ autoDeleteEnabled: boolean }> {
    const [row] = await this.db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, 'account_deletion'))
      .limit(1);

    const stored = (row?.value ?? {}) as { autoDeleteEnabled?: boolean };
    return { autoDeleteEnabled: stored.autoDeleteEnabled ?? false };
  }

  async updateDeletionSettings(adminId: string, autoDeleteEnabled: boolean) {
    await this.db
      .insert(appSettings)
      .values({ key: 'account_deletion', value: { autoDeleteEnabled }, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: { autoDeleteEnabled }, updatedAt: new Date() },
      });

    this.auditLogService.log(adminId, 'UPDATE_DELETION_SETTINGS', 'settings', 'account_deletion', { autoDeleteEnabled });
    return { autoDeleteEnabled };
  }
}
