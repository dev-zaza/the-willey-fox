import { Injectable, Inject, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { eq, and, inArray, lt } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { reports, qrCodes, guardianMappings, reportResponses, users } from '../../database/schema';
import { UpdateReportStatusDto, CreateResponseDto, FlagReportDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
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
