import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import {
  familyGroups,
  familyMembers,
  qrCodes,
  guardianMappings,
  users,
} from '../../database/schema';

@Injectable()
export class FamiliesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(userId: string, name: string) {
    const [family] = await this.db
      .insert(familyGroups)
      .values({ name, ownerId: userId })
      .returning();

    // Owner is automatically a member with 'owner' role
    await this.db.insert(familyMembers).values({
      familyId: family.id,
      userId,
      role: 'owner',
    });

    return family;
  }

  async listForUser(userId: string) {
    const memberships = await this.db
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

    return memberships;
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
      })
      .from(qrCodes)
      .where(eq(qrCodes.familyId, familyId));

    return { ...family, members, qrCodes: qrList };
  }

  async addMember(familyId: string, requesterId: string, targetUserId: string) {
    await this.assertOwner(familyId, requesterId);

    // Check user exists
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');

    // Check not already a member
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

    // Auto-grant guardian access to all QR codes in this family
    await this.syncGuardianMappingsForMember(familyId, targetUserId);

    return member;
  }

  async addMemberByEmail(familyId: string, requesterId: string, email: string) {
    await this.assertOwner(familyId, requesterId);

    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) throw new NotFoundException('No user found with that email');

    return this.addMember(familyId, requesterId, user.id);
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

    // Remove guardian mappings for QR codes in this family
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

    // Verify QR belongs to the requester
    const [qr] = await this.db
      .select({ id: qrCodes.id, userId: qrCodes.userId })
      .from(qrCodes)
      .where(eq(qrCodes.id, qrCodeId))
      .limit(1);

    if (!qr) throw new NotFoundException('QR code not found');
    if (qr.userId !== requesterId) throw new ForbiddenException('You do not own this QR code');

    // Set family_id on the QR code
    await this.db
      .update(qrCodes)
      .set({ familyId, updatedAt: new Date() })
      .where(eq(qrCodes.id, qrCodeId));

    // Auto-create guardian mappings for all family members
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

    // Unlink all QR codes from this family
    await this.db
      .update(qrCodes)
      .set({ familyId: null, updatedAt: new Date() })
      .where(eq(qrCodes.familyId, familyId));

    // Cascade deletes family_members via FK
    await this.db.delete(familyGroups).where(eq(familyGroups.id, familyId));
  }

  /**
   * When a new member joins, create guardian mappings for all family QR codes.
   */
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

  /**
   * When a QR code is added to a family, create guardian mappings for all members.
   */
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
          qrCodeId: qrCodeId,
          userId: member.userId,
          addedBy: family?.ownerId ?? member.userId,
          status: 'active',
        });
      }
    }
  }

  private async assertOwner(familyId: string, userId: string) {
    const [family] = await this.db
      .select({ ownerId: familyGroups.ownerId })
      .from(familyGroups)
      .where(eq(familyGroups.id, familyId))
      .limit(1);

    if (!family) throw new NotFoundException('Family not found');
    if (family.ownerId !== userId)
      throw new ForbiddenException('Only the family owner can perform this action');
  }

  private async assertMember(familyId: string, userId: string) {
    const [membership] = await this.db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership)
      throw new ForbiddenException('You are not a member of this family');
  }
}
