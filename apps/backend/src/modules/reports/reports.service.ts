import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { eq, and, inArray, lt, isNotNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { reports, qrCodes, guardianMappings, reportResponses, users } from '../../database/schema';
import { UpdateReportStatusDto, CreateResponseDto, FlagReportDto, CreateMissingReportDto, CreateSightingDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { BroadcastConsentLogService } from '../broadcasts/broadcast-consent-log.service';

const BROADCAST_INITIAL_DAYS = 30;
const BROADCAST_EXTEND_DAYS = 30;
const BROADCAST_MAX_EXTENDS = 2;

export interface BroadcastRequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  tosVersion?: string | null;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
    private readonly consentLog: BroadcastConsentLogService,
  ) {}

  async findByUserQrCodes(userId: string) {
    const ownedQrs = await this.db
      .select({ id: qrCodes.id })
      .from(qrCodes)
      .where(eq(qrCodes.userId, userId));

    const guardianQrs = await this.db
      .select({ qrCodeId: guardianMappings.qrCodeId })
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.userId, userId),
          eq(guardianMappings.status, 'active'),
        ),
      );

    const allQrIds = [
      ...ownedQrs.map((q) => q.id),
      ...guardianQrs.map((g) => g.qrCodeId),
    ];

    if (allQrIds.length === 0) {
      return [];
    }

    const uniqueQrIds = [...new Set(allQrIds)];

    return this.db
      .select()
      .from(reports)
      .where(inArray(reports.qrCodeId, uniqueQrIds))
      .orderBy(reports.createdAt);
  }

  async findById(reportId: string) {
    const [report] = await this.db
      .select()
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    return report || null;
  }

  async findByIdForUser(reportId: string, userId: string) {
    const report = await this.findById(reportId);
    if (!report) {
      throw new NotFoundException('REPORT_NOT_FOUND');
    }

    const [qrCode] = await this.db
      .select({ userId: qrCodes.userId })
      .from(qrCodes)
      .where(eq(qrCodes.id, report.qrCodeId))
      .limit(1);

    if (!qrCode) {
      throw new NotFoundException('QR_NOT_FOUND');
    }

    if (qrCode.userId !== userId) {
      const [guardian] = await this.db
        .select({ id: guardianMappings.id })
        .from(guardianMappings)
        .where(
          and(
            eq(guardianMappings.qrCodeId, report.qrCodeId),
            eq(guardianMappings.userId, userId),
            eq(guardianMappings.status, 'active'),
          ),
        )
        .limit(1);

      if (!guardian) {
        throw new ForbiddenException('ACCESS_DENIED');
      }
    }

    return report;
  }

  async updateStatus(reportId: string, userId: string, dto: UpdateReportStatusDto) {
    await this.findByIdForUser(reportId, userId);

    const [updated] = await this.db
      .update(reports)
      .set({ status: dto.status, updatedAt: new Date() })
      .where(eq(reports.id, reportId))
      .returning();

    if (dto.status === 'resolved') {
      await this.autoRetractBroadcastOnFound(reportId);
    }

    return updated;
  }

  async createResponse(reportId: string, guardianId: string, dto: CreateResponseDto) {
    await this.findByIdForUser(reportId, guardianId);

    const [response] = await this.db
      .insert(reportResponses)
      .values({
        reportId,
        guardianId,
        message: dto.message,
      })
      .returning();

    await this.db
      .update(reports)
      .set({ status: 'contacted', updatedAt: new Date() })
      .where(eq(reports.id, reportId));

    const [guardian] = await this.db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, guardianId))
      .limit(1);

    const guardianName = guardian ? `${guardian.firstName} ${guardian.lastName}` : 'Someone';
    void this.notificationsService.notifyFinderOfResponse(reportId, dto.message, guardianName);

    return response;
  }

  async flagReport(reportId: string, _userId: string, dto: FlagReportDto) {
    const report = await this.findById(reportId);
    if (!report) throw new NotFoundException('REPORT_NOT_FOUND');

    const [updated] = await this.db
      .update(reports)
      .set({ status: 'flagged', flagReason: dto.reason, updatedAt: new Date() })
      .where(eq(reports.id, reportId))
      .returning();

    return updated;
  }

  async createMissingReport(userId: string, dto: CreateMissingReportDto) {
    // Verify caller owns or is guardian of the QR code
    const [qr] = await this.db
      .select({ id: qrCodes.id, userId: qrCodes.userId, name: qrCodes.name, uniqueCode: qrCodes.uniqueCode })
      .from(qrCodes)
      .where(eq(qrCodes.id, dto.qrCodeId))
      .limit(1);

    if (!qr) throw new NotFoundException('QR_NOT_FOUND');

    const isOwner = qr.userId === userId;
    if (!isOwner) {
      const [guardianLink] = await this.db
        .select({ id: guardianMappings.id })
        .from(guardianMappings)
        .where(
          and(
            eq(guardianMappings.qrCodeId, qr.id),
            eq(guardianMappings.userId, userId),
            eq(guardianMappings.status, 'active'),
          ),
        )
        .limit(1);
      if (!guardianLink) throw new ForbiddenException('ACCESS_DENIED');
    }

    const now = new Date();
    const [report] = await this.db
      .insert(reports)
      .values({
        qrCodeId: qr.id,
        finderUserId: userId,
        finderNotes: dto.description,
        finderContact: dto.contact,
        locationAddress: dto.lastSeenLocation,
        locationLat: dto.lat?.toString(),
        locationLng: dto.lng?.toString(),
        isPublicBroadcast: dto.requestBroadcast ? true : false,
        broadcastApprovedAt: dto.requestBroadcast ? now : null,
        broadcastExpiresAt: dto.requestBroadcast
          ? new Date(now.getTime() + BROADCAST_INITIAL_DAYS * 24 * 60 * 60 * 1000)
          : null,
      })
      .returning();

    this.logger.log(`Missing person report ${report.id} created for QR ${qr.uniqueCode}`);

    // Notify guardians
    this.notificationsService
      .notifyGuardiansOfReport(report.id, qr.id)
      .catch((err) => this.logger.error(`Guardian notify failed for report ${report.id}`, err));

    // Push nearby users if broadcast requested and GPS provided
    if (dto.requestBroadcast && dto.lat != null && dto.lng != null) {
      this.pushNearbyMissingAlert(report.id, qr.name ?? 'Missing person', dto.lat, dto.lng).catch(
        (err) => this.logger.warn(`Nearby missing alert push failed: ${(err as Error).message}`),
      );
    }

    return { id: report.id, broadcast: dto.requestBroadcast ?? false };
  }

  private async pushNearbyMissingAlert(reportId: string, tagName: string, lat: number, lng: number) {
    const RADIUS_M = 3218; // 2 miles
    const nearbyUsers = await this.db.execute(sql`
      SELECT user_id FROM user_locations
      WHERE (6371000 * acos(
        LEAST(1, cos(radians(${lat})) * cos(radians(CAST(lat AS float))) *
        cos(radians(CAST(lng AS float)) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(CAST(lat AS float))))
      )) < ${RADIUS_M}
    `);

    for (const row of Array.from(nearbyUsers)) {
      const nearbyUserId = (row as any).user_id as string;
      void this.notificationsService.sendPush(
        nearbyUserId,
        {
          title: 'Missing person alert nearby',
          body: `Help find ${tagName}. Tap to see details.`,
          data: { type: 'missing_person_broadcast', reportId },
        },
        { priority: 'normal' },
      );
    }
    this.logger.log(`Missing person broadcast ${reportId}: pushed to ${Array.from(nearbyUsers).length} nearby users`);
  }

  async createSighting(reportId: string, userId: string, dto: CreateSightingDto) {
    const report = await this.findById(reportId);
    if (!report) throw new NotFoundException('REPORT_NOT_FOUND');

    const [sighting] = await this.db
      .insert(reportResponses)
      .values({
        reportId,
        guardianId: userId,
        message: [
          dto.notes ?? '',
          dto.locationAddress ? `Location: ${dto.locationAddress}` : '',
          dto.lat != null && dto.lng != null ? `GPS: ${dto.lat},${dto.lng}` : '',
        ].filter(Boolean).join(' | '),
      })
      .returning();

    // Update report status to contacted
    await this.db
      .update(reports)
      .set({ status: 'contacted', updatedAt: new Date() })
      .where(eq(reports.id, reportId));

    // Notify the report owner
    const [reporter] = await this.db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const sighterName = reporter ? `${reporter.firstName} ${reporter.lastName}` : 'Someone';
    void this.notificationsService.notifyFinderOfResponse(reportId, dto.notes ?? 'Sighting reported', sighterName);

    return { id: sighting.id, message: 'Sighting recorded. The owner has been notified.' };
  }

  async expireOldReports(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.db
      .update(reports)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(
        and(
          inArray(reports.status, ['open', 'contacted']),
          lt(reports.createdAt, thirtyDaysAgo),
        ),
      )
      .returning({ id: reports.id });

    this.logger.log(`Expired ${result.length} stale reports`);
    return result.length;
  }

  async expireBroadcasts(): Promise<{ total: number; failed: number }> {
    const now = new Date();
    const due = await this.db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.isPublicBroadcast, true),
          isNotNull(reports.broadcastExpiresAt),
          lt(reports.broadcastExpiresAt, now),
        ),
      );

    if (due.length === 0) return { total: 0, failed: 0 };

    const BATCH = 100;
    let failed = 0;
    let succeeded = 0;

    for (let i = 0; i < due.length; i += BATCH) {
      const chunk = due.slice(i, i + BATCH);
      for (const row of chunk) {
        try {
          await this.db
            .update(reports)
            .set({ isPublicBroadcast: false, updatedAt: new Date() })
            .where(eq(reports.id, row.id));
          await this.consentLog.log({
            reportId: row.id,
            action: 'auto_expire',
          });
          succeeded += 1;
        } catch (err) {
          failed += 1;
          this.logger.error(
            `Failed to expire broadcast ${row.id}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }
    }

    this.logger.log(`Broadcast expiry sweep: ${succeeded} expired, ${failed} failed`);
    return { total: succeeded, failed };
  }

  private async assertCanToggleBroadcast(reportId: string, userId: string) {
    const report = await this.findByIdForUser(reportId, userId);

    if (report.status === 'expired' || report.status === 'resolved') {
      throw new BadRequestException('BROADCAST_REPORT_NOT_ACTIVE');
    }
    return report;
  }

  async enableBroadcast(
    reportId: string,
    guardianUserId: string,
    dto: { tosVersion?: string },
    ctx: BroadcastRequestContext,
  ) {
    const report = await this.assertCanToggleBroadcast(reportId, guardianUserId);

    if (report.isPublicBroadcast && report.broadcastExpiresAt && report.broadcastExpiresAt > new Date()) {
      return report;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + BROADCAST_INITIAL_DAYS * 24 * 60 * 60 * 1000);

    const [updated] = await this.db
      .update(reports)
      .set({
        isPublicBroadcast: true,
        broadcastApprovedAt: now,
        broadcastExpiresAt: expiresAt,
        broadcastExtendCount: 0,
        updatedAt: now,
      })
      .where(eq(reports.id, reportId))
      .returning();

    await this.consentLog.log({
      reportId,
      guardianUserId,
      action: 'enable',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      tosVersion: dto.tosVersion ?? ctx.tosVersion,
      metadata: { expiresAt: expiresAt.toISOString() },
    });

    return updated;
  }

  async disableBroadcast(
    reportId: string,
    guardianUserId: string,
    dto: { reason?: string },
    ctx: BroadcastRequestContext,
  ) {
    await this.findByIdForUser(reportId, guardianUserId);

    const [updated] = await this.db
      .update(reports)
      .set({ isPublicBroadcast: false, updatedAt: new Date() })
      .where(eq(reports.id, reportId))
      .returning();

    await this.consentLog.log({
      reportId,
      guardianUserId,
      action: 'disable',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: dto.reason ? { reason: dto.reason } : null,
    });

    return updated;
  }

  async extendBroadcast(
    reportId: string,
    guardianUserId: string,
    ctx: BroadcastRequestContext,
  ) {
    const report = await this.assertCanToggleBroadcast(reportId, guardianUserId);

    if (!report.isPublicBroadcast) {
      throw new BadRequestException('BROADCAST_NOT_ACTIVE');
    }
    if ((report.broadcastExtendCount ?? 0) >= BROADCAST_MAX_EXTENDS) {
      throw new BadRequestException('BROADCAST_EXTEND_LIMIT_REACHED');
    }

    const base = report.broadcastExpiresAt && report.broadcastExpiresAt > new Date()
      ? report.broadcastExpiresAt
      : new Date();
    const newExpiresAt = new Date(base.getTime() + BROADCAST_EXTEND_DAYS * 24 * 60 * 60 * 1000);

    const [updated] = await this.db
      .update(reports)
      .set({
        broadcastExpiresAt: newExpiresAt,
        broadcastExtendCount: (report.broadcastExtendCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, reportId))
      .returning();

    await this.consentLog.log({
      reportId,
      guardianUserId,
      action: 'extend',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: {
        newExpiresAt: newExpiresAt.toISOString(),
        extendCount: (report.broadcastExtendCount ?? 0) + 1,
      },
    });

    return updated;
  }

  async autoRetractBroadcastOnFound(reportId: string) {
    const [report] = await this.db
      .select({ isPublicBroadcast: reports.isPublicBroadcast })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report || !report.isPublicBroadcast) return;

    await this.db
      .update(reports)
      .set({ isPublicBroadcast: false, updatedAt: new Date() })
      .where(eq(reports.id, reportId));

    await this.consentLog.log({
      reportId,
      action: 'auto_retract_found',
    });
  }

  async autoRetractBroadcastsForUser(userId: string): Promise<number> {
    const ownedQrs = await this.db
      .select({ id: qrCodes.id })
      .from(qrCodes)
      .where(eq(qrCodes.userId, userId));

    const guardianQrs = await this.db
      .select({ qrCodeId: guardianMappings.qrCodeId })
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.userId, userId),
          eq(guardianMappings.status, 'active'),
        ),
      );

    const qrIds = [
      ...ownedQrs.map((q) => q.id),
      ...guardianQrs.map((g) => g.qrCodeId),
    ];
    if (qrIds.length === 0) return 0;

    const uniqueQrIds = [...new Set(qrIds)];

    const affected = await this.db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          inArray(reports.qrCodeId, uniqueQrIds),
          eq(reports.isPublicBroadcast, true),
        ),
      );

    if (affected.length === 0) return 0;

    await this.db
      .update(reports)
      .set({ isPublicBroadcast: false, photoUrl: null, updatedAt: new Date() })
      .where(inArray(reports.id, affected.map((r) => r.id)));

    for (const row of affected) {
      await this.consentLog.log({
        reportId: row.id,
        guardianUserId: userId,
        action: 'auto_retract_user_delete',
      });
    }

    this.logger.log(`Retracted ${affected.length} broadcasts for deleted user ${userId}`);
    return affected.length;
  }

  async getResponses(reportId: string, userId: string) {
    await this.findByIdForUser(reportId, userId);

    const responses = await this.db
      .select({
        id: reportResponses.id,
        reportId: reportResponses.reportId,
        guardianId: reportResponses.guardianId,
        message: reportResponses.message,
        createdAt: reportResponses.createdAt,
        guardianFirstName: users.firstName,
        guardianLastName: users.lastName,
      })
      .from(reportResponses)
      .innerJoin(users, eq(reportResponses.guardianId, users.id))
      .where(eq(reportResponses.reportId, reportId))
      .orderBy(reportResponses.createdAt);

    return responses.map((r) => ({
      id: r.id,
      reportId: r.reportId,
      guardianId: r.guardianId,
      message: r.message,
      guardianName: `${r.guardianFirstName} ${r.guardianLastName}`,
      createdAt: r.createdAt,
    }));
  }
}
