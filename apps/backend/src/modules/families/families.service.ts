import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import {
  familyGroups,
  familyMembers,
  familyInvites,
  qrCodes,
  guardianMappings,
  users,
} from '../../database/schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FamiliesService {
  private readonly logger = new Logger(FamiliesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, name: string) {
    const [family] = await this.db
      .insert(familyGroups)
      .values({ name, ownerId: userId })
      .returning();

    await this.db.insert(familyMembers).values({
      familyId: family.id,
      userId,
      role: 'owner',
    });

    return family;
  }

  async listForUser(userId: string) {
    return this.db
      .select({
        familyId: familyMembers.familyId,
        role: familyMembers.role,
        familyName: familyGroups.name,
        ownerId: familyGroups.ownerId,
        createdAt: familyGroups.createdAt,
      })
      .from(familyMembers)
      .innerJoin(familyGroups, eq(familyMembers.familyId, familyGroups.id))
      .where(eq(familyMembers.userId, userId));
  }

  async getById(familyId: string, userId: string) {
    await this.assertMember(familyId, userId);

    const [family] = await this.db
      .select()
      .from(familyGroups)
      .where(eq(familyGroups.id, familyId))
      .limit(1);

    if (!family) throw new NotFoundException('Family not found');

    const members = await this.db
      .select({
        id: familyMembers.id,
        userId: familyMembers.userId,
        role: familyMembers.role,
        joinedAt: familyMembers.joinedAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(familyMembers)
      .innerJoin(users, eq(familyMembers.userId, users.id))
      .where(eq(familyMembers.familyId, familyId));

    const qrList = await this.db
      .select({
        id: qrCodes.id,
        name: qrCodes.name,
        category: qrCodes.category,
        uniqueCode: qrCodes.uniqueCode,
        isLost: qrCodes.isLost,
        photoUrl: qrCodes.photoUrl,
        customFields: qrCodes.customFields,
      })
      .from(qrCodes)
      .where(eq(qrCodes.familyId, familyId));

    const pendingInvites = await this.db
      .select({
        id: familyInvites.id,
        email: familyInvites.email,
        status: familyInvites.status,
        expiresAt: familyInvites.expiresAt,
        createdAt: familyInvites.createdAt,
      })
      .from(familyInvites)
      .where(
        and(eq(familyInvites.familyId, familyId), eq(familyInvites.status, 'pending')),
      );

    return { ...family, members, qrCodes: qrList, pendingInvites };
  }

  async addMember(familyId: string, requesterId: string, targetUserId: string) {
    await this.assertOwner(familyId, requesterId);

    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    const [existing] = await this.db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, targetUserId),
        ),
      )
      .limit(1);
    if (existing) throw new ConflictException('User is already a family member');

    const [member] = await this.db
      .insert(familyMembers)
      .values({ familyId, userId: targetUserId, role: 'member' })
      .returning();

    await this.syncGuardianMappingsForMember(familyId, targetUserId);
    return member;
  }

  async addMemberByEmail(familyId: string, requesterId: string, email: string) {
    await this.assertOwner(familyId, requesterId);

    const normalized = email.toLowerCase().trim();
    if (!normalized.includes('@')) {
      throw new BadRequestException('Invalid email');
    }

    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);

    const [family] = await this.db
      .select({ name: familyGroups.name })
      .from(familyGroups)
      .where(eq(familyGroups.id, familyId))
      .limit(1);

    const [inviter] = await this.db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, requesterId))
      .limit(1);

    const inviterName = inviter
      ? `${inviter.firstName} ${inviter.lastName}`.trim()
      : 'A Wiley Fox user';
    const familyName = family?.name ?? 'a family group';
    const appUrl = this.configService.get<string>('PUBLIC_BASE_URL', 'http://localhost:3001');

    if (user) {
      const member = await this.addMember(familyId, requesterId, user.id);
      void this.notificationsService.sendFamilyInviteEmail(
        normalized,
        inviterName,
        familyName,
        `${appUrl}/dashboard/family`,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        true,
      );
      return { ...member, invited: false, added: true };
    }

    const [existingInvite] = await this.db
      .select({ id: familyInvites.id })
      .from(familyInvites)
      .where(
        and(
          eq(familyInvites.familyId, familyId),
          eq(familyInvites.email, normalized),
          eq(familyInvites.status, 'pending'),
        ),
      )
      .limit(1);

    if (existingInvite) {
      throw new ConflictException('Invite already pending for this email');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [invite] = await this.db
      .insert(familyInvites)
      .values({
        familyId,
        invitedByUserId: requesterId,
        email: normalized,
        token,
        status: 'pending',
        expiresAt,
      })
      .returning();

    const acceptUrl = `${appUrl}/family/accept?token=${token}`;
    if (this.configService.get<string>('NODE_ENV') !== 'production') {
      this.logger.log(`[DEV] Family invite link for ${normalized}: ${acceptUrl}`);
    }

    void this.notificationsService.sendFamilyInviteEmail(
      normalized,
      inviterName,
      familyName,
      acceptUrl,
      expiresAt,
      false,
    );

    return {
      inviteId: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt,
      invited: true,
      added: false,
    };
  }

  async acceptInvite(token: string, acceptingUserId: string) {
    const [invite] = await this.db
      .select()
      .from(familyInvites)
      .where(eq(familyInvites.token, token))
      .limit(1);

    if (!invite) throw new NotFoundException('INVITE_NOT_FOUND');
    if (invite.status === 'accepted') throw new ConflictException('INVITE_ALREADY_USED');
    if (invite.expiresAt < new Date() || invite.status === 'expired') {
      await this.db
        .update(familyInvites)
        .set({ status: 'expired' })
        .where(eq(familyInvites.id, invite.id));
      throw new BadRequestException('INVITE_EXPIRED');
    }

    const [acceptor] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, acceptingUserId))
      .limit(1);

    if (!acceptor) throw new NotFoundException('USER_NOT_FOUND');
    if (acceptor.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException('INVITE_EMAIL_MISMATCH');
    }

    const [existing] = await this.db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, invite.familyId),
          eq(familyMembers.userId, acceptingUserId),
        ),
      )
      .limit(1);

    if (!existing) {
      await this.db.insert(familyMembers).values({
        familyId: invite.familyId,
        userId: acceptingUserId,
        role: invite.role || 'member',
      });
      await this.syncGuardianMappingsForMember(invite.familyId, acceptingUserId);
    }

    await this.db
      .update(familyInvites)
      .set({ status: 'accepted' })
      .where(eq(familyInvites.id, invite.id));

    return { familyId: invite.familyId, success: true };
  }

  async removeMember(familyId: string, requesterId: string, targetUserId: string) {
    await this.assertOwner(familyId, requesterId);

    if (targetUserId === requesterId) {
      throw new BadRequestException('Cannot remove yourself from a family you own');
    }

    await this.db
      .delete(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, targetUserId),
        ),
      );

    const familyQrCodes = await this.db
      .select({ id: qrCodes.id })
      .from(qrCodes)
      .where(eq(qrCodes.familyId, familyId));

    for (const qr of familyQrCodes) {
      await this.db
        .delete(guardianMappings)
        .where(
          and(
            eq(guardianMappings.qrCodeId, qr.id),
            eq(guardianMappings.userId, targetUserId),
          ),
        );
    }
  }

  async addQrToFamily(familyId: string, requesterId: string, qrCodeId: string) {
    await this.assertOwner(familyId, requesterId);

    const [qr] = await this.db
      .select({ id: qrCodes.id, userId: qrCodes.userId })
      .from(qrCodes)
      .where(eq(qrCodes.id, qrCodeId))
      .limit(1);

    if (!qr) throw new NotFoundException('QR code not found');
    if (qr.userId !== requesterId) throw new ForbiddenException('You do not own this QR code');

    await this.db
      .update(qrCodes)
      .set({ familyId, updatedAt: new Date() })
      .where(eq(qrCodes.id, qrCodeId));

    await this.syncGuardianMappingsForQr(familyId, qrCodeId);
  }

  async removeQrFromFamily(familyId: string, requesterId: string, qrCodeId: string) {
    await this.assertOwner(familyId, requesterId);

    await this.db
      .update(qrCodes)
      .set({ familyId: null, updatedAt: new Date() })
      .where(and(eq(qrCodes.id, qrCodeId), eq(qrCodes.familyId, familyId)));
  }

  async deleteFamily(familyId: string, requesterId: string) {
    await this.assertOwner(familyId, requesterId);

    await this.db
      .update(qrCodes)
      .set({ familyId: null, updatedAt: new Date() })
      .where(eq(qrCodes.familyId, familyId));

    await this.db.delete(familyGroups).where(eq(familyGroups.id, familyId));
  }

  private async syncGuardianMappingsForMember(familyId: string, userId: string) {
    const familyQrCodes = await this.db
      .select({ id: qrCodes.id })
      .from(qrCodes)
      .where(eq(qrCodes.familyId, familyId));

    for (const qr of familyQrCodes) {
      const [exists] = await this.db
        .select({ id: guardianMappings.id })
        .from(guardianMappings)
        .where(
          and(
            eq(guardianMappings.qrCodeId, qr.id),
            eq(guardianMappings.userId, userId),
          ),
        )
        .limit(1);

      if (!exists) {
        await this.db.insert(guardianMappings).values({
          qrCodeId: qr.id,
          userId,
          addedBy: userId,
          status: 'active',
        });
      }
    }
  }

  private async syncGuardianMappingsForQr(familyId: string, qrCodeId: string) {
    const [family] = await this.db
      .select({ ownerId: familyGroups.ownerId })
      .from(familyGroups)
      .where(eq(familyGroups.id, familyId))
      .limit(1);

    const members = await this.db
      .select({ userId: familyMembers.userId })
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId));

    for (const member of members) {
      if (family && member.userId === family.ownerId) continue;

      const [exists] = await this.db
        .select({ id: guardianMappings.id })
        .from(guardianMappings)
        .where(
          and(
            eq(guardianMappings.qrCodeId, qrCodeId),
            eq(guardianMappings.userId, member.userId),
          ),
        )
        .limit(1);

      if (!exists) {
        await this.db.insert(guardianMappings).values({
          qrCodeId,
          userId: member.userId,
          addedBy: family?.ownerId ?? member.userId,
          status: 'active',
        });
      }
    }
  }

  private async assertMember(familyId: string, userId: string) {
    const [membership] = await this.db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(
        and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)),
      )
      .limit(1);
    if (!membership) throw new ForbiddenException('Not a family member');
  }

  private async assertOwner(familyId: string, userId: string) {
    const [family] = await this.db
      .select({ ownerId: familyGroups.ownerId })
      .from(familyGroups)
      .where(eq(familyGroups.id, familyId))
      .limit(1);
    if (!family) throw new NotFoundException('Family not found');
    if (family.ownerId !== userId) throw new ForbiddenException('Only the family owner can do this');
  }
}
