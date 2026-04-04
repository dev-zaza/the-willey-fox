import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { qrCodes, reports, users, visualThemes } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { CreateReportDto } from '../reports/dto';
import { NotificationsService } from '../notifications/notifications.service';
import { QrService } from '../qr/qr.service';
import { MessagesService } from '../messages/messages.service';
import { CloudinaryService } from '../users/cloudinary.service';
import { ClaimQrDto } from '../qr/dto';

interface VisibilityConfig {
  showName?: boolean;
  showPhoto?: boolean;
  showDescription?: boolean;
  showCustomFields?: boolean;
}

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
    private readonly qrService: QrService,
    private readonly messagesService: MessagesService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async getPublicQrInfo(code: string) {
    // LEFT JOIN visual_themes to include theme data in one query
    const rows = await this.db
      .select({
        qr: qrCodes,
        theme: {
          accentColor: visualThemes.accentColor,
          backgroundStyle: visualThemes.backgroundStyle,
          showLogo: visualThemes.showLogo,
          logoUrl: visualThemes.logoUrl,
        },
      })
      .from(qrCodes)
      .leftJoin(visualThemes, eq(qrCodes.themeId, visualThemes.id))
      .where(eq(qrCodes.uniqueCode, code))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException('QR_NOT_FOUND');
    }

    const qrCode = rows[0].qr;
    const themeData = rows[0].theme;

    // Unclaimed QR — return minimal info so the finder page can show the activation form
    if (qrCode.status === 'unclaimed') {
      return { status: 'unclaimed', uniqueCode: qrCode.uniqueCode };
    }

    const visibility = (qrCode.visibilityConfig || {}) as VisibilityConfig;

    const publicInfo: Record<string, unknown> = {
      id: qrCode.id,
      category: qrCode.category,
      uniqueCode: qrCode.uniqueCode,
      isLost: qrCode.isLost,
    };

    if (visibility.showName) {
      publicInfo.name = qrCode.label ?? qrCode.name;
    }
    if (visibility.showPhoto && qrCode.photoUrl) {
      publicInfo.photoUrl = qrCode.photoUrl;
    }
    if (visibility.showDescription && qrCode.description) {
      publicInfo.description = qrCode.description;
    }
    if (visibility.showCustomFields && qrCode.customFields) {
      publicInfo.customFields = qrCode.customFields;
    }

    // Always expose owner contact info and reward message so finder can reach owner directly
    if (qrCode.ownerContactEmail) {
      publicInfo.ownerContactEmail = qrCode.ownerContactEmail;
    }
    if (qrCode.ownerContactPhone) {
      publicInfo.ownerContactPhone = qrCode.ownerContactPhone;
    }
    if (qrCode.rewardMessage) {
      publicInfo.rewardMessage = qrCode.rewardMessage;
    }

    // Include visual theme data (accentColor, backgroundStyle, showLogo, logoUrl)
    if (themeData?.accentColor) {
      publicInfo.theme = {
        accentColor: themeData.accentColor,
        backgroundStyle: themeData.backgroundStyle,
        showLogo: themeData.showLogo,
        logoUrl: themeData.logoUrl,
      };
    }

    // Include owner's public name (userId is nullable for unclaimed QRs but we guard above)
    if (qrCode.userId) {
      const [owner] = await this.db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, qrCode.userId))
        .limit(1);

      if (owner) {
        publicInfo.ownerName = `${owner.firstName} ${owner.lastName.charAt(0)}.`;
      }
    }

    return publicInfo;
  }

  async uploadReportPhoto(reportId: string, fileBuffer: Buffer): Promise<{ photoUrl: string }> {
    const [report] = await this.db
      .select({ id: reports.id })
      .from(reports)
      .where(eq(reports.id, reportId))
      .limit(1);

    if (!report) {
      throw new NotFoundException('REPORT_NOT_FOUND');
    }

    const photoUrl = await this.cloudinaryService.uploadReportPhoto(fileBuffer, reportId);

    await this.db
      .update(reports)
      .set({ photoUrl, updatedAt: new Date() })
      .where(eq(reports.id, reportId));

    return { photoUrl };
  }

  async activateQrCode(code: string, userId: string, tier: string, dto: ClaimQrDto) {
    return this.qrService.claimQrCode(code, userId, tier || 'free', dto);
  }

  async submitReport(code: string, dto: CreateReportDto, finderUserId?: string) {
    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.uniqueCode, code), eq(qrCodes.isActive, true)))
      .limit(1);

    if (!qrCode) {
      throw new NotFoundException('QR_NOT_FOUND');
    }

    const [report] = await this.db
      .insert(reports)
      .values({
        qrCodeId: qrCode.id,
        finderUserId: finderUserId || null,
        finderContact: dto.finderContact,
        finderNotes: dto.finderNotes,
        locationLat: dto.locationLat?.toString(),
        locationLng: dto.locationLng?.toString(),
        locationAddress: dto.locationAddress,
      })
      .returning();

    this.logger.log(`New report submitted for QR ${qrCode.uniqueCode} (ID: ${report.id})`);

    // Notify owner and guardians asynchronously
    this.notificationsService
      .notifyGuardiansOfReport(report.id, qrCode.id)
      .catch((err) => this.logger.error(`Failed to queue notifications for report ${report.id}`, err));

    // Auto-create conversation between authenticated finder and QR owner
    let conversationId: string | null = null;
    if (finderUserId && qrCode.userId && finderUserId !== qrCode.userId) {
      void this.messagesService
        .getOrCreateConversation(finderUserId, qrCode.userId)
        .then((convo) => { conversationId = convo.id; })
        .catch((err) => this.logger.error(`Failed to create conversation for report ${report.id}`, err));
    }

    return {
      id: report.id,
      conversationId,
      message: 'Report submitted successfully. The owner has been notified.',
    };
  }
}
