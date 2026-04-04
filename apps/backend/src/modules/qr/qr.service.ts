import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, count } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import * as QRCode from 'qrcode';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { qrCodes, guardianMappings, visualThemes } from '../../database/schema';
import { TIER_LIMITS } from '@safetag/shared';
import { CreateQrDto, UpdateQrDto, ClaimQrDto, BulkCreateQrDto } from './dto';
import { SetQrThemeDto } from './dto/set-qr-theme.dto';
import { SettingsService } from '../settings/settings.service';

const nanoid = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);

@Injectable()
export class QrService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(userId: string, tier: string, dto: CreateQrDto) {
    const tierKey = tier as keyof typeof TIER_LIMITS;
    const staticLimits = TIER_LIMITS[tierKey];

    const pricing = await this.settingsService.getPricingConfig();
    const liveLimit = (pricing.tierLimits as Record<string, { maxQrCodes: number }>)[tierKey];
    const maxQrCodes = liveLimit?.maxQrCodes ?? staticLimits.maxQrCodes;

    const [{ activeCount }] = await this.db
      .select({ activeCount: count() })
      .from(qrCodes)
      .where(and(eq(qrCodes.userId, userId), eq(qrCodes.isActive, true)));

    if (activeCount >= maxQrCodes) {
      throw new ForbiddenException('QR_LIMIT_REACHED');
    }

    const uniqueCode = nanoid();

    const defaultVisibility = {
      showName: true,
      showPhoto: true,
      showDescription: true,
      showCustomFields: false,
    };

    const [qrCode] = await this.db
      .insert(qrCodes)
      .values({
        userId,
        category: dto.category,
        uniqueCode,
        name: dto.name,
        label: dto.label ?? dto.name,
        description: dto.description,
        photoUrl: dto.photoUrl,
        ownerContactEmail: dto.ownerContactEmail,
        ownerContactPhone: dto.ownerContactPhone,
        rewardMessage: dto.rewardMessage,
        visibilityConfig: dto.visibilityConfig
          ? { ...defaultVisibility, ...dto.visibilityConfig }
          : defaultVisibility,
        customFields: dto.customFields || {},
      })
      .returning();

    return qrCode;
  }

  async findAllByUser(userId: string) {
    const owned = await this.db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.userId, userId), eq(qrCodes.isActive, true)));

    const guardianQrIds = await this.db
      .select({ qrCodeId: guardianMappings.qrCodeId })
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.userId, userId),
          eq(guardianMappings.status, 'active'),
        ),
      );

    if (guardianQrIds.length === 0) {
      return owned;
    }

    const guardianQrs = await Promise.all(
      guardianQrIds.map(({ qrCodeId }) =>
        this.db
          .select()
          .from(qrCodes)
          .where(and(eq(qrCodes.id, qrCodeId), eq(qrCodes.isActive, true)))
          .then((rows) => rows[0]),
      ),
    );

    const ownedIds = new Set(owned.map((q) => q.id));
    const uniqueGuardianQrs = guardianQrs.filter((q) => q && !ownedIds.has(q.id));

    return [
      ...owned.map((q) => ({ ...q, isOwner: true })),
      ...uniqueGuardianQrs.map((q) => ({ ...q, isOwner: false })),
    ];
  }

  async findById(id: string) {
    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, id))
      .limit(1);

    return qrCode || null;
  }

  async findByUniqueCode(code: string) {
    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.uniqueCode, code))
      .limit(1);

    return qrCode || null;
  }

  async findByUniqueCodeActive(code: string) {
    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.uniqueCode, code), eq(qrCodes.isActive, true)))
      .limit(1);

    return qrCode || null;
  }

  async update(id: string, dto: UpdateQrDto) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.photoUrl !== undefined) updateData.photoUrl = dto.photoUrl;
    if (dto.ownerContactEmail !== undefined) updateData.ownerContactEmail = dto.ownerContactEmail;
    if (dto.ownerContactPhone !== undefined) updateData.ownerContactPhone = dto.ownerContactPhone;
    if (dto.rewardMessage !== undefined) updateData.rewardMessage = dto.rewardMessage;
    if (dto.isLost !== undefined) updateData.isLost = dto.isLost;
    if (dto.visibilityConfig !== undefined) updateData.visibilityConfig = dto.visibilityConfig;
    if (dto.customFields !== undefined) updateData.customFields = dto.customFields;

    const [updated] = await this.db
      .update(qrCodes)
      .set(updateData)
      .where(eq(qrCodes.id, id))
      .returning();

    return updated;
  }

  async markLost(id: string) {
    const [qrCode] = await this.db
      .select({ id: qrCodes.id })
      .from(qrCodes)
      .where(eq(qrCodes.id, id))
      .limit(1);

    if (!qrCode) throw new NotFoundException('QR_NOT_FOUND');

    const [updated] = await this.db
      .update(qrCodes)
      .set({ isLost: true, updatedAt: new Date() })
      .where(eq(qrCodes.id, id))
      .returning();

    return updated;
  }

  async markFound(id: string) {
    const [qrCode] = await this.db
      .select({ id: qrCodes.id })
      .from(qrCodes)
      .where(eq(qrCodes.id, id))
      .limit(1);

    if (!qrCode) throw new NotFoundException('QR_NOT_FOUND');

    const [updated] = await this.db
      .update(qrCodes)
      .set({ isLost: false, updatedAt: new Date() })
      .where(eq(qrCodes.id, id))
      .returning();

    return updated;
  }

  async deactivate(id: string) {
    await this.db
      .update(qrCodes)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(qrCodes.id, id));

    return { message: 'QR code deactivated.' };
  }

  async generateQrImage(uniqueCode: string): Promise<Buffer> {
    const publicBaseUrl = this.configService.get<string>(
      'PUBLIC_BASE_URL',
      'http://localhost:3000',
    );
    const url = `${publicBaseUrl}/q/${uniqueCode}`;

    return QRCode.toBuffer(url, {
      type: 'png',
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
  }

  async claimQrCode(code: string, userId: string, tier: string, dto: ClaimQrDto) {
    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.uniqueCode, code))
      .limit(1);

    if (!qrCode) {
      throw new NotFoundException('QR_NOT_FOUND');
    }

    if (qrCode.status !== 'unclaimed') {
      throw new BadRequestException('QR_ALREADY_CLAIMED');
    }

    const tierKey = tier as keyof typeof TIER_LIMITS;
    const limits = TIER_LIMITS[tierKey];

    const [{ activeCount }] = await this.db
      .select({ activeCount: count() })
      .from(qrCodes)
      .where(and(eq(qrCodes.userId, userId), eq(qrCodes.isActive, true)));

    if (activeCount >= limits.maxQrCodes) {
      throw new ForbiddenException('QR_LIMIT_REACHED');
    }

    const defaultVisibility = {
      showName: true,
      showPhoto: true,
      showDescription: true,
      showCustomFields: false,
    };

    const [updated] = await this.db
      .update(qrCodes)
      .set({
        userId,
        status: 'active',
        isActive: true,
        category: dto.category,
        name: dto.name,
        label: dto.label ?? dto.name,
        description: dto.description,
        photoUrl: dto.photoUrl,
        ownerContactEmail: dto.ownerContactEmail,
        ownerContactPhone: dto.ownerContactPhone,
        rewardMessage: dto.rewardMessage,
        visibilityConfig: dto.visibilityConfig
          ? { ...defaultVisibility, ...dto.visibilityConfig }
          : defaultVisibility,
        customFields: dto.customFields || {},
        updatedAt: new Date(),
      })
      .where(eq(qrCodes.id, qrCode.id))
      .returning();

    return updated;
  }

  async bulkGenerateUnclaimed(count: number, shopifyOrderId?: string) {
    if (count < 1 || count > 500) {
      throw new BadRequestException('QR_BULK_LIMIT_EXCEEDED');
    }

    const rows = Array.from({ length: count }, () => ({
      uniqueCode: nanoid(),
      status: 'unclaimed' as const,
      isActive: false,
      shopifyOrderId: shopifyOrderId ?? null,
      // required non-null fields — placeholder values for unclaimed tags
      category: 'other' as const,
      name: 'Unclaimed Tag',
      visibilityConfig: { showName: true, showPhoto: true, showDescription: true, showCustomFields: false },
      customFields: {},
    }));

    const inserted = await this.db.insert(qrCodes).values(rows).returning({
      id: qrCodes.id,
      uniqueCode: qrCodes.uniqueCode,
    });

    return inserted;
  }

  async bulkCreate(userId: string, tier: string, dto: BulkCreateQrDto) {
    if (tier !== 'premium' && tier !== 'enterprise') {
      throw new ForbiddenException('PREMIUM_REQUIRED');
    }

    const tierKey = tier as keyof typeof TIER_LIMITS;
    const limits = TIER_LIMITS[tierKey];

    const [{ activeCount }] = await this.db
      .select({ activeCount: count() })
      .from(qrCodes)
      .where(and(eq(qrCodes.userId, userId), eq(qrCodes.isActive, true)));

    if (activeCount + dto.count > limits.maxQrCodes) {
      throw new ForbiddenException('QR_LIMIT_REACHED');
    }

    const defaultVisibility = {
      showName: true,
      showPhoto: true,
      showDescription: true,
      showCustomFields: false,
    };

    const rows = Array.from({ length: dto.count }, () => ({
      userId,
      category: dto.category,
      uniqueCode: nanoid(),
      name: `${dto.category.charAt(0).toUpperCase() + dto.category.slice(1)} Tag`,
      visibilityConfig: defaultVisibility,
      customFields: {},
    }));

    const inserted = await this.db.insert(qrCodes).values(rows).returning();
    return inserted;
  }

  private readonly TIER_ORDER = ['free', 'basic', 'premium', 'enterprise'];

  async setTheme(qrCodeId: string, userId: string, userTier: string, dto: SetQrThemeDto) {
    const [qrCode] = await this.db
      .select({ id: qrCodes.id, userId: qrCodes.userId })
      .from(qrCodes)
      .where(eq(qrCodes.id, qrCodeId))
      .limit(1);

    if (!qrCode) throw new NotFoundException('QR_NOT_FOUND');
    if (qrCode.userId !== userId) throw new ForbiddenException('QR_NOT_OWNER');

    if (dto.themeId) {
      const [theme] = await this.db
        .select({ tierRequired: visualThemes.tierRequired, isActive: visualThemes.isActive })
        .from(visualThemes)
        .where(eq(visualThemes.id, dto.themeId))
        .limit(1);

      if (!theme || !theme.isActive) throw new NotFoundException('VISUAL_THEME_NOT_FOUND');

      const userTierIndex = this.TIER_ORDER.indexOf(userTier);
      const themeTierIndex = this.TIER_ORDER.indexOf(theme.tierRequired);
      if (userTierIndex < themeTierIndex) {
        throw new ForbiddenException('THEME_TIER_REQUIRED');
      }
    }

    const [updated] = await this.db
      .update(qrCodes)
      .set({ themeId: dto.themeId ?? null, updatedAt: new Date() })
      .where(eq(qrCodes.id, qrCodeId))
      .returning();

    return updated;
  }

  async isOwnerOrGuardian(qrCodeId: string, userId: string): Promise<boolean> {
    const [qrCode] = await this.db
      .select({ userId: qrCodes.userId })
      .from(qrCodes)
      .where(eq(qrCodes.id, qrCodeId))
      .limit(1);

    if (!qrCode) return false;
    if (qrCode.userId === userId) return true;

    const [guardian] = await this.db
      .select({ id: guardianMappings.id })
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.qrCodeId, qrCodeId),
          eq(guardianMappings.userId, userId),
          eq(guardianMappings.status, 'active'),
        ),
      )
      .limit(1);

    return !!guardian;
  }
}
