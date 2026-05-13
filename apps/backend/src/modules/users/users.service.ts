import { Injectable, Inject, Logger, NotFoundException, ConflictException, ForbiddenException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, or, ilike, and, sql } from 'drizzle-orm';
import { randomInt } from 'crypto';
import Redis from 'ioredis';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { users, userBlocks, userReports, userLocations } from '../../database/schema';
import { UpdateProfileDto, UpdateLocationDto, ReportUserDto, VerifyPhoneOtpDto } from './dto';
import { CloudinaryService } from './cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';
import { getRedisConnectionOptions } from '../../config/redis-connection';

@Injectable()
export class UsersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsersService.name);
  private redis: Redis;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.redis = new Redis({
      ...getRedisConnectionOptions(this.configService),
      maxRetriesPerRequest: 3,
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  // ─── Reputation ───────────────────────────────────────────────────────

  async addReputation(userId: string, delta: number): Promise<void> {
    await this.db
      .update(users)
      .set({ reputation: sql`${users.reputation} + ${delta}` })
      .where(eq(users.id, userId));
  }

  // ─── Phone OTP ────────────────────────────────────────────────────────

  async sendPhoneOtp(userId: string): Promise<{ message: string }> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');
    if (!user.phone) throw new BadRequestException('NO_PHONE_NUMBER');

    const code = randomInt(100000, 1000000).toString();
    await this.redis.set(`phone_otp:${userId}`, code, 'EX', 600);

    await this.notificationsService.sendSmsRaw(
      user.phone,
      `Your TheWileyfox verification code: ${code}. Valid for 10 minutes.`,
    );

    this.logger.log(`Phone OTP sent to user ${userId}`);
    return { message: 'OTP sent.' };
  }

  async verifyPhoneOtp(userId: string, dto: VerifyPhoneOtpDto): Promise<{ message: string }> {
    const stored = await this.redis.get(`phone_otp:${userId}`);
    if (!stored) throw new BadRequestException('OTP_EXPIRED');
    if (stored !== dto.code) throw new BadRequestException('INVALID_OTP');

    await this.db
      .update(users)
      .set({ phoneVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));

    await this.redis.del(`phone_otp:${userId}`);
    this.logger.log(`Phone verified for user ${userId}`);
    return { message: 'Phone number verified.' };
  }

  async findById(id: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    const { passwordHash, verificationToken, verificationTokenExpiresAt, resetToken, resetTokenExpiresAt, ...profile } = user;
    return profile;
  }

  async getPublicProfile(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
        reputation: users.reputation,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    return user;
  }

  async search(query: string) {
    if (!query || query.trim().length < 2) return [];
    const term = `%${query.trim()}%`;
    return this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        or(
          ilike(users.firstName, term),
          ilike(users.lastName, term),
          ilike(users.email, term),
        ),
      )
      .limit(20);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;
    if (dto.language !== undefined) updateData.language = dto.language;
    if (dto.notificationPreferences !== undefined) {
      updateData.notificationPreferences = {
        ...(user.notificationPreferences as object),
        ...dto.notificationPreferences,
      };
    }
    if (dto.fcmToken !== undefined) updateData.fcmToken = dto.fcmToken;
    if (dto.safetyMode !== undefined) updateData.safetyMode = dto.safetyMode;

    await this.db.update(users).set(updateData).where(eq(users.id, userId));

    return this.getProfile(userId);
  }

  async uploadAvatar(userId: string, buffer: Buffer): Promise<{ avatarUrl: string }> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('USER_NOT_FOUND');

    const avatarUrl = await this.cloudinaryService.uploadAvatar(buffer, userId);

    await this.db
      .update(users)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { avatarUrl };
  }

  // ─── Location ────────────────────────────────────────────────────────

  async updateLocation(userId: string, dto: UpdateLocationDto): Promise<void> {
    await this.db
      .insert(userLocations)
      .values({
        userId,
        lat: String(dto.lat),
        lng: String(dto.lng),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userLocations.userId,
        set: {
          lat: String(dto.lat),
          lng: String(dto.lng),
          updatedAt: new Date(),
        },
      });
  }

  // ─── Block / Unblock ─────────────────────────────────────────────────

  async blockUser(blockerId: string, blockedId: string): Promise<{ message: string }> {
    if (blockerId === blockedId) {
      throw new ForbiddenException('Cannot block yourself');
    }

    const [exists] = await this.db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)))
      .limit(1);

    if (exists) {
      throw new ConflictException('USER_ALREADY_BLOCKED');
    }

    await this.db.insert(userBlocks).values({ blockerId, blockedId });
    return { message: 'User blocked.' };
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<{ message: string }> {
    await this.db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
    return { message: 'User unblocked.' };
  }

  async listBlocked(userId: string) {
    const rows = await this.db
      .select({
        id: userBlocks.id,
        blockedId: userBlocks.blockedId,
        createdAt: userBlocks.createdAt,
      })
      .from(userBlocks)
      .where(eq(userBlocks.blockerId, userId));

    return rows;
  }

  // ─── Report User ─────────────────────────────────────────────────────

  async reportUser(reporterId: string, reportedId: string, dto: ReportUserDto) {
    if (reporterId === reportedId) {
      throw new ForbiddenException('Cannot report yourself');
    }

    const [reported] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, reportedId))
      .limit(1);

    if (!reported) {
      throw new NotFoundException('USER_NOT_FOUND');
    }

    const [report] = await this.db
      .insert(userReports)
      .values({
        reporterId,
        reportedId,
        reason: dto.reason,
        contextType: dto.contextType ?? null,
        contextId: dto.contextId ?? null,
        status: 'pending',
      })
      .returning();

    return report;
  }
}
