import {
  Injectable,
  Inject,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { guardianMappings, guardianInvites, users, qrCodes } from '../../database/schema';
import { TIER_LIMITS } from '@safetag/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class GuardiansService {
  private readonly logger = new Logger(GuardiansService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
  ) {}

  async listGuardians(qrCodeId: string) {
    const mappings = await this.db
      .select({
        id: guardianMappings.id,
        userId: guardianMappings.userId,
        status: guardianMappings.status,
        addedBy: guardianMappings.addedBy,
        createdAt: guardianMappings.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(guardianMappings)
      .innerJoin(users, eq(guardianMappings.userId, users.id))
      .where(
        and(
          eq(guardianMappings.qrCodeId, qrCodeId),
          inArray(guardianMappings.status, ['pending', 'active']),
        ),
      );

    return mappings.map(({ firstName, lastName, email, avatarUrl, ...m }) => ({
      ...m,
      user: { id: m.userId, firstName, lastName, email, avatarUrl },
    }));
  }

  async requestAccess(qrCodeId: string, requesterId: string) {
    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, qrCodeId))
      .limit(1);

    if (!qrCode) {
      throw new NotFoundException('QR_NOT_FOUND');
    }

    if (qrCode.userId === requesterId) {
      throw new ConflictException('OWNER_CANNOT_BE_GUARDIAN');
    }

    const [existing] = await this.db
      .select()
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.qrCodeId, qrCodeId),
          eq(guardianMappings.userId, requesterId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === 'active') {
        throw new ConflictException('ALREADY_GUARDIAN');
      }
      if (existing.status === 'pending') {
        throw new ConflictException('REQUEST_ALREADY_PENDING');
      }
      const [updated] = await this.db
        .update(guardianMappings)
        .set({ status: 'pending', addedBy: requesterId, updatedAt: new Date() })
        .where(eq(guardianMappings.id, existing.id))
        .returning();

      void this.notificationsService.notifyOwnerOfGuardianRequest(qrCode.userId!, qrCodeId, requesterId);
      return updated;
    }

    const [mapping] = await this.db
      .insert(guardianMappings)
      .values({
        qrCodeId,
        userId: requesterId,
        status: 'pending',
        addedBy: requesterId,
      })
      .returning();

    void this.notificationsService.notifyOwnerOfGuardianRequest(qrCode.userId!, qrCodeId, requesterId);
    return mapping;
  }

  async approveGuardian(qrCodeId: string, guardianUserId: string, _approverId: string) {
    const [qrCode] = await this.db
      .select({ userId: qrCodes.userId })
      .from(qrCodes)
      .where(eq(qrCodes.id, qrCodeId))
      .limit(1);

    if (!qrCode) {
      throw new NotFoundException('QR_NOT_FOUND');
    }

    const [owner] = await this.db
      .select({ subscriptionTier: users.subscriptionTier })
      .from(users)
      .where(eq(users.id, qrCode.userId!))
      .limit(1);

    const tierKey = (owner?.subscriptionTier || 'free') as keyof typeof TIER_LIMITS;
    const staticLimits = TIER_LIMITS[tierKey];
    const pricing = await this.settingsService.getPricingConfig();
    const liveTierLimit = (pricing.tierLimits as Record<string, { maxGuardians: number }>)[tierKey];
    const maxGuardians = liveTierLimit?.maxGuardians ?? staticLimits.maxGuardians;

    const activeGuardians = await this.db
      .select({ id: guardianMappings.id })
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.qrCodeId, qrCodeId),
          eq(guardianMappings.status, 'active'),
        ),
      );

    if (activeGuardians.length >= maxGuardians) {
      throw new ForbiddenException('GUARDIAN_LIMIT_REACHED');
    }

    const [mapping] = await this.db
      .select()
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.qrCodeId, qrCodeId),
          eq(guardianMappings.userId, guardianUserId),
          eq(guardianMappings.status, 'pending'),
        ),
      )
      .limit(1);

    if (!mapping) {
      throw new NotFoundException('PENDING_REQUEST_NOT_FOUND');
    }

    const [updated] = await this.db
      .update(guardianMappings)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(guardianMappings.id, mapping.id))
      .returning();

    void this.notificationsService.notifyGuardianOfApproval(guardianUserId, qrCodeId, qrCode.userId!);
    // Reputation: +2 to both parties on approval
    void this.usersService.addReputation(guardianUserId, 2).catch(() => {});
    void this.usersService.addReputation(qrCode.userId!, 2).catch(() => {});
    return updated;
  }

  async rejectGuardian(qrCodeId: string, guardianUserId: string, _rejecterId: string) {
    const [mapping] = await this.db
      .select()
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.qrCodeId, qrCodeId),
          eq(guardianMappings.userId, guardianUserId),
          eq(guardianMappings.status, 'pending'),
        ),
      )
      .limit(1);

    if (!mapping) {
      throw new NotFoundException('PENDING_REQUEST_NOT_FOUND');
    }

    const [updated] = await this.db
      .update(guardianMappings)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(guardianMappings.id, mapping.id))
      .returning();

    void this.notificationsService.notifyGuardianOfRejection(guardianUserId, qrCodeId);
    return updated;
  }

  async removeGuardian(qrCodeId: string, guardianUserId: string) {
    const [mapping] = await this.db
      .select()
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.qrCodeId, qrCodeId),
          eq(guardianMappings.userId, guardianUserId),
        ),
      )
      .limit(1);

    if (!mapping) {
      throw new NotFoundException('GUARDIAN_NOT_FOUND');
    }

    const [updated] = await this.db
      .update(guardianMappings)
      .set({ status: 'removed', updatedAt: new Date() })
      .where(eq(guardianMappings.id, mapping.id))
      .returning();

    void this.notificationsService.notifyGuardianOfRemoval(guardianUserId, qrCodeId, 'owner');
    return updated;
  }

  async inviteGuardianByEmail(qrCodeId: string, invitedByUserId: string, dto: { email: string }) {
    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, qrCodeId))
      .limit(1);

    if (!qrCode) {
      throw new NotFoundException('QR_NOT_FOUND');
    }

    // Check tier limit
    const [owner] = await this.db
      .select({ subscriptionTier: users.subscriptionTier })
      .from(users)
      .where(eq(users.id, invitedByUserId))
      .limit(1);

    const tierKey = (owner?.subscriptionTier || 'free') as keyof typeof TIER_LIMITS;
    const staticLimits = TIER_LIMITS[tierKey];
    const pricing = await this.settingsService.getPricingConfig();
    const liveTierLimit = (pricing.tierLimits as Record<string, { maxGuardians: number }>)[tierKey];
    const maxGuardians = liveTierLimit?.maxGuardians ?? staticLimits.maxGuardians;

    const activeGuardians = await this.db
      .select({ id: guardianMappings.id })
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.qrCodeId, qrCodeId),
          eq(guardianMappings.status, 'active'),
        ),
      );

    if (activeGuardians.length >= maxGuardians) {
      throw new ForbiddenException('GUARDIAN_LIMIT_REACHED');
    }

    // Check if invited email belongs to existing user → auto-approve
    const [existingUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      if (existingUser.id === invitedByUserId) {
        throw new ConflictException('OWNER_CANNOT_BE_GUARDIAN');
      }
      // Reuse requestAccess + auto-approve flow
      const [existingMapping] = await this.db
        .select()
        .from(guardianMappings)
        .where(
          and(
            eq(guardianMappings.qrCodeId, qrCodeId),
            eq(guardianMappings.userId, existingUser.id),
          ),
        )
        .limit(1);

      if (existingMapping?.status === 'active') {
        throw new ConflictException('ALREADY_GUARDIAN');
      }

      if (existingMapping?.status === 'pending') {
        throw new ConflictException('INVITE_ALREADY_PENDING');
      }

      // Insert as pending — user must accept via invite link
      if (existingMapping) {
        await this.db
          .update(guardianMappings)
          .set({ status: 'pending', addedBy: invitedByUserId, updatedAt: new Date() })
          .where(eq(guardianMappings.id, existingMapping.id));
      } else {
        await this.db
          .insert(guardianMappings)
          .values({
            qrCodeId,
            userId: existingUser.id,
            status: 'pending',
            addedBy: invitedByUserId,
          });
      }

      // Fall through to create invite token and send email (same as non-existing user)
    }

    // Create invite token and send email (both existing and new users must accept via link)
    const token = randomBytes(32).toString('hex'); // 64 hex chars
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invite] = await this.db
      .insert(guardianInvites)
      .values({
        qrCodeId,
        invitedByUserId,
        email: dto.email.toLowerCase(),
        token,
        status: 'pending',
        expiresAt,
      })
      .returning();

    const [inviter] = await this.db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, invitedByUserId))
      .limit(1);

    const appUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');
    const acceptUrl = `${appUrl}/guardian/accept?token=${token}`;

    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(`[DEV] Guardian invite link for ${invite.email}: ${acceptUrl}`);
    }

    const inviterName = inviter ? `${inviter.firstName} ${inviter.lastName}` : 'A TheWileyfox user';

    void this.notificationsService.sendGuardianInviteEmail(
      dto.email.toLowerCase(),
      inviterName,
      qrCode.name,
      qrCode.category,
      acceptUrl,
      expiresAt,
    );

    return { inviteId: invite.id, email: invite.email, expiresAt: invite.expiresAt, invited: true };
  }

  async acceptInvite(token: string, acceptingUserId: string) {
    const [invite] = await this.db
      .select()
      .from(guardianInvites)
      .where(eq(guardianInvites.token, token))
      .limit(1);

    if (!invite) {
      throw new NotFoundException('INVITE_NOT_FOUND');
    }

    if (invite.status !== 'pending') {
      throw new BadRequestException('INVITE_ALREADY_USED');
    }

    if (invite.expiresAt < new Date()) {
      await this.db
        .update(guardianInvites)
        .set({ status: 'expired' })
        .where(eq(guardianInvites.id, invite.id));
      throw new BadRequestException('INVITE_EXPIRED');
    }

    // Check active guardian limit
    const [qrCode] = await this.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, invite.qrCodeId))
      .limit(1);

    if (!qrCode) {
      throw new NotFoundException('QR_NOT_FOUND');
    }

    if (qrCode.userId === acceptingUserId) {
      throw new ConflictException('OWNER_CANNOT_BE_GUARDIAN');
    }

    const [existingMapping] = await this.db
      .select()
      .from(guardianMappings)
      .where(
        and(
          eq(guardianMappings.qrCodeId, invite.qrCodeId),
          eq(guardianMappings.userId, acceptingUserId),
        ),
      )
      .limit(1);

    let mapping;
    if (existingMapping) {
      const [updated] = await this.db
        .update(guardianMappings)
        .set({ status: 'active', addedBy: invite.invitedByUserId, updatedAt: new Date() })
        .where(eq(guardianMappings.id, existingMapping.id))
        .returning();
      mapping = updated;
    } else {
      const [created] = await this.db
        .insert(guardianMappings)
        .values({
          qrCodeId: invite.qrCodeId,
          userId: acceptingUserId,
          status: 'active',
          addedBy: invite.invitedByUserId,
        })
        .returning();
      mapping = created;
    }

    await this.db
      .update(guardianInvites)
      .set({ status: 'accepted' })
      .where(eq(guardianInvites.id, invite.id));

    void this.notificationsService.notifyGuardianOfApproval(acceptingUserId, invite.qrCodeId, invite.invitedByUserId);

    // Reputation: +2 to acceptor and +2 to QR owner for successful guardian relationship
    void this.usersService.addReputation(acceptingUserId, 2).catch(() => {});
    void this.usersService.addReputation(invite.invitedByUserId, 2).catch(() => {});

    return mapping;
  }
}
