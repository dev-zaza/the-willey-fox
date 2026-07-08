import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { eq, and, or, count, gte, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { emergencyContacts, sosAlerts, users } from '../../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { AddContactDto } from './dto/add-contact.dto';
import { TriggerSosDto } from './dto/trigger-sos.dto';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
    private readonly settingsService: SettingsService,
  ) {}

  // ─── Emergency Contacts ───────────────────────────────────────────────

  async addContact(userId: string, dto: AddContactDto) {
    let contactUserId = dto.contactUserId;

    if (dto.contactEmail) {
      const [byEmail] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, dto.contactEmail.trim().toLowerCase()))
        .limit(1);
      if (!byEmail) {
        throw new NotFoundException('No user found with that email. They must register first.');
      }
      contactUserId = byEmail.id;
    }

    if (!contactUserId) {
      throw new NotFoundException('Provide contactUserId or contactEmail');
    }

    if (userId === contactUserId) {
      throw new ForbiddenException('Cannot add yourself as an emergency contact');
    }

    // Enforce tier contact limit
    const [requester] = await this.db
      .select({ subscriptionTier: users.subscriptionTier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const tierKey = requester?.subscriptionTier ?? 'free';
    const pricing = await this.settingsService.getPricingConfig();
    const liveTierLimit = (pricing.tierLimits as Record<string, { maxEmergencyContacts: number }>)[tierKey];
    const limit = liveTierLimit?.maxEmergencyContacts ?? 3;
    const [{ cnt }] = await this.db
      .select({ cnt: count() })
      .from(emergencyContacts)
      .where(and(eq(emergencyContacts.userId, userId), eq(emergencyContacts.status, 'accepted')));
    if (Number(cnt) >= limit) {
      throw new ForbiddenException(
        `Emergency contact limit reached (${limit} for ${tierKey} tier). Upgrade to add more.`,
      );
    }

    const [contactUser] = await this.db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, contactUserId))
      .limit(1);

    if (!contactUser) {
      throw new NotFoundException('User not found');
    }

    // Check for existing relationship (either direction)
    const [existing] = await this.db
      .select({ id: emergencyContacts.id, status: emergencyContacts.status })
      .from(emergencyContacts)
      .where(
        or(
          and(
            eq(emergencyContacts.userId, userId),
            eq(emergencyContacts.contactUserId, contactUserId),
          ),
          and(
            eq(emergencyContacts.userId, contactUserId),
            eq(emergencyContacts.contactUserId, userId),
          ),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(`Emergency contact relationship already exists (status: ${existing.status})`);
    }

    const [contact] = await this.db
      .insert(emergencyContacts)
      .values({
        userId,
        contactUserId,
        status: 'pending',
      })
      .returning();

    // Notify the contact user of the request
    await this.notificationsService.sendPush(contactUserId, {
      title: 'Emergency Contact Request',
      body: 'Someone has added you as an emergency contact. Open the app to accept or decline.',
      data: { type: 'emergency_contact_request', contactId: contact.id },
    });

    this.logger.log(`Emergency contact request sent: ${userId} → ${contactUserId}`);
    return contact;
  }

  async acceptContact(contactId: string, userId: string) {
    const [contact] = await this.db
      .select()
      .from(emergencyContacts)
      .where(
        and(
          eq(emergencyContacts.id, contactId),
          eq(emergencyContacts.contactUserId, userId),
          eq(emergencyContacts.status, 'pending'),
        ),
      )
      .limit(1);

    if (!contact) {
      throw new NotFoundException('Emergency contact request not found');
    }

    const [updated] = await this.db
      .update(emergencyContacts)
      .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(emergencyContacts.id, contactId))
      .returning();

    // Notify the requester that their contact accepted
    await this.notificationsService.sendPush(contact.userId, {
      title: 'Emergency Contact Accepted',
      body: 'Your emergency contact request was accepted.',
      data: { type: 'emergency_contact_accepted', contactId },
    });

    this.logger.log(`Emergency contact ${contactId} accepted by ${userId}`);
    return updated;
  }

  async declineContact(contactId: string, userId: string) {
    const [contact] = await this.db
      .select()
      .from(emergencyContacts)
      .where(
        and(
          eq(emergencyContacts.id, contactId),
          eq(emergencyContacts.contactUserId, userId),
          eq(emergencyContacts.status, 'pending'),
        ),
      )
      .limit(1);

    if (!contact) {
      throw new NotFoundException('Emergency contact request not found');
    }

    const [updated] = await this.db
      .update(emergencyContacts)
      .set({ status: 'declined', updatedAt: new Date() })
      .where(eq(emergencyContacts.id, contactId))
      .returning();

    this.logger.log(`Emergency contact ${contactId} declined by ${userId}`);
    return updated;
  }

  async removeContact(contactId: string, userId: string) {
    const [contact] = await this.db
      .select()
      .from(emergencyContacts)
      .where(
        and(
          eq(emergencyContacts.id, contactId),
          or(
            eq(emergencyContacts.userId, userId),
            eq(emergencyContacts.contactUserId, userId),
          ),
        ),
      )
      .limit(1);

    if (!contact) {
      throw new NotFoundException('Emergency contact not found');
    }

    await this.db
      .delete(emergencyContacts)
      .where(eq(emergencyContacts.id, contactId));

    this.logger.log(`Emergency contact ${contactId} removed by ${userId}`);
  }

  async listContacts(userId: string) {
    // Contacts where the user is the requester OR where they are the contact and accepted
    const rows = await this.db
      .select({
        id: emergencyContacts.id,
        status: emergencyContacts.status,
        isPrimarySos: emergencyContacts.isPrimarySos,
        acceptedAt: emergencyContacts.acceptedAt,
        createdAt: emergencyContacts.createdAt,
        direction: emergencyContacts.userId,
        contactUserId: emergencyContacts.contactUserId,
        requesterUserId: emergencyContacts.userId,
      })
      .from(emergencyContacts)
      .where(
        or(
          eq(emergencyContacts.userId, userId),
          eq(emergencyContacts.contactUserId, userId),
        ),
      );

    // Enrich with user details
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const otherUserId = row.requesterUserId === userId ? row.contactUserId : row.requesterUserId;
        const [otherUser] = await this.db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(eq(users.id, otherUserId))
          .limit(1);

        return {
          id: row.id,
          status: row.status,
          isPrimarySos: row.isPrimarySos,
          acceptedAt: row.acceptedAt,
          createdAt: row.createdAt,
          isRequester: row.requesterUserId === userId,
          contact: otherUser ?? null,
        };
      }),
    );

    return enriched;
  }

  async setPrimaryContact(contactId: string, userId: string): Promise<{ message: string }> {
    // Verify the contact belongs to this user and is accepted
    const [contact] = await this.db
      .select({ id: emergencyContacts.id, status: emergencyContacts.status })
      .from(emergencyContacts)
      .where(
        and(
          eq(emergencyContacts.id, contactId),
          or(
            eq(emergencyContacts.userId, userId),
            eq(emergencyContacts.contactUserId, userId),
          ),
          eq(emergencyContacts.status, 'accepted'),
        ),
      )
      .limit(1);

    if (!contact) throw new NotFoundException('CONTACT_NOT_FOUND');

    // Clear any existing primary on all contacts for this user
    await this.db
      .update(emergencyContacts)
      .set({ isPrimarySos: false })
      .where(
        or(
          eq(emergencyContacts.userId, userId),
          eq(emergencyContacts.contactUserId, userId),
        ),
      );

    // Set the new primary
    await this.db
      .update(emergencyContacts)
      .set({ isPrimarySos: true })
      .where(eq(emergencyContacts.id, contactId));

    return { message: 'Primary SOS contact updated.' };
  }

  // ─── SOS Alerts ──────────────────────────────────────────────────────

  async triggerSos(userId: string, dto: TriggerSosDto) {
    // Rate limiting: max 3 SOS per 24h
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ recentCount }] = await this.db
      .select({ recentCount: count() })
      .from(sosAlerts)
      .where(and(eq(sosAlerts.userId, userId), gte(sosAlerts.createdAt, since24h)));
    if (Number(recentCount) >= 3) {
      throw new HttpException(
        { statusCode: 429, code: 'SOS_RATE_LIMIT_EXCEEDED', message: 'Maximum 3 SOS alerts per 24 hours.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Rate limiting: max 1 SOS per 5 min
    const since5min = new Date(Date.now() - 5 * 60 * 1000);
    const [{ recentMins }] = await this.db
      .select({ recentMins: count() })
      .from(sosAlerts)
      .where(and(eq(sosAlerts.userId, userId), gte(sosAlerts.createdAt, since5min)));
    if (Number(recentMins) >= 1) {
      throw new HttpException(
        { statusCode: 429, code: 'SOS_COOLDOWN_ACTIVE', message: 'Please wait 5 minutes between SOS alerts.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Insert SOS alert record
    const [alert] = await this.db
      .insert(sosAlerts)
      .values({
        userId,
        lat: dto.lat?.toString(),
        lng: dto.lng?.toString(),
        locationAddress: dto.locationAddress,
        message: dto.message,
      })
      .returning();

    // Fetch the user's accepted emergency contacts
    const contactRows = await this.db
      .select({ contactUserId: emergencyContacts.contactUserId, requesterUserId: emergencyContacts.userId })
      .from(emergencyContacts)
      .where(
        and(
          or(
            eq(emergencyContacts.userId, userId),
            eq(emergencyContacts.contactUserId, userId),
          ),
          eq(emergencyContacts.status, 'accepted'),
        ),
      );

    // Get the triggering user's info for the alert message
    const [alertUser] = await this.db
      .select({ firstName: users.firstName, lastName: users.lastName, email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userName = alertUser ? `${alertUser.firstName} ${alertUser.lastName}` : 'A TheWileyfox user';

    const locationText = dto.locationAddress
      ? dto.locationAddress
      : dto.lat && dto.lng
        ? `${dto.lat}, ${dto.lng}`
        : 'unknown location';

    const alertMessage = dto.message
      ? `"${dto.message}" — Location: ${locationText}`
      : `Location: ${locationText}`;

    // Notify all accepted emergency contacts simultaneously
    const contactUserIds = contactRows.map((r) =>
      r.requesterUserId === userId ? r.contactUserId : r.requesterUserId,
    );

    if (contactUserIds.length === 0) {
      this.logger.warn(`SOS triggered by ${userId} but no accepted contacts found`);
    }

    await Promise.allSettled(
      contactUserIds.map((contactId) =>
        this.notifyContact(contactId, userId, userName, alertMessage, alert.id),
      ),
    );

    // 2km nearby broadcast via Haversine
    if (dto.lat && dto.lng) {
      try {
        const nearbyUsers = await this.db.execute(sql`
          SELECT user_id FROM user_locations
          WHERE (6371000 * acos(
            LEAST(1, cos(radians(${dto.lat})) * cos(radians(CAST(lat AS float))) *
            cos(radians(CAST(lng AS float)) - radians(${dto.lng})) +
            sin(radians(${dto.lat})) * sin(radians(CAST(lat AS float))))
          )) < 2000
          AND user_id != ${userId}
        `);

        for (const row of Array.from(nearbyUsers)) {
          const nearbyUserId = (row as any).user_id as string;
          void this.notificationsService.sendPush(
            nearbyUserId,
            {
              title: 'Emergency alert nearby',
              body: 'Someone near you has triggered an emergency SOS.',
              data: { type: 'nearby_sos', sosAlertId: alert.id },
            },
            { priority: 'normal' },
          );
        }
      } catch (err) {
        this.logger.warn(`Nearby SOS broadcast failed: ${(err as Error).message}`);
      }
    }

    this.logger.log(`SOS alert ${alert.id} triggered by ${userId}, notified ${contactUserIds.length} contacts`);
    return { id: alert.id, notifiedCount: contactUserIds.length };
  }

  async acknowledgeSos(alertId: string, userId: string) {
    // Only the SOS user themselves or their contacts can acknowledge
    const [alert] = await this.db
      .select()
      .from(sosAlerts)
      .where(eq(sosAlerts.id, alertId))
      .limit(1);

    if (!alert) {
      throw new NotFoundException('SOS alert not found');
    }

    if (alert.userId !== userId) {
      // Check they are an accepted contact
      const [contact] = await this.db
        .select({ id: emergencyContacts.id })
        .from(emergencyContacts)
        .where(
          and(
            or(
              and(
                eq(emergencyContacts.userId, alert.userId),
                eq(emergencyContacts.contactUserId, userId),
              ),
              and(
                eq(emergencyContacts.userId, userId),
                eq(emergencyContacts.contactUserId, alert.userId),
              ),
            ),
            eq(emergencyContacts.status, 'accepted'),
          ),
        )
        .limit(1);

      if (!contact) {
        throw new ForbiddenException('Not authorized to acknowledge this SOS alert');
      }
    }

    const [updated] = await this.db
      .update(sosAlerts)
      .set({ isAcknowledged: true, acknowledgedAt: new Date() })
      .where(eq(sosAlerts.id, alertId))
      .returning();

    return updated;
  }

  async listSosAlerts(userId: string) {
    return this.db
      .select()
      .from(sosAlerts)
      .where(eq(sosAlerts.userId, userId))
      .orderBy(sosAlerts.createdAt);
  }

  async getActiveSosNear(lat: number, lng: number, radiusMetres = 2000) {
    const results = await this.db.execute(sql`
      SELECT
        sa.id,
        sa.user_id AS "userId",
        sa.lat,
        sa.lng,
        sa.location_address AS "locationAddress",
        sa.message,
        sa.is_acknowledged AS "isAcknowledged",
        sa.created_at AS "createdAt",
        (6371000 * acos(
          LEAST(1, cos(radians(${lat})) * cos(radians(CAST(ul.lat AS float))) *
          cos(radians(CAST(ul.lng AS float)) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(CAST(ul.lat AS float))))
        )) AS distance_metres
      FROM sos_alerts sa
      INNER JOIN user_locations ul ON ul.user_id = sa.user_id
      WHERE sa.is_acknowledged = false
        AND sa.created_at >= NOW() - INTERVAL '24 hours'
        AND (6371000 * acos(
          LEAST(1, cos(radians(${lat})) * cos(radians(CAST(ul.lat AS float))) *
          cos(radians(CAST(ul.lng AS float)) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(CAST(ul.lat AS float))))
        )) <= ${radiusMetres}
      ORDER BY sa.created_at DESC
    `);

    return Array.from(results);
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  private async notifyContact(
    contactId: string,
    alertUserId: string,
    userName: string,
    alertMessage: string,
    sosAlertId: string,
  ): Promise<void> {
    const [contact] = await this.db
      .select({
        id: users.id,
        email: users.email,
        phone: users.phone,
        notificationPreferences: users.notificationPreferences,
      })
      .from(users)
      .where(eq(users.id, contactId))
      .limit(1);

    if (!contact) return;

    const prefs = (contact.notificationPreferences || {}) as {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
    };

    const title = `SOS Alert from ${userName}`;
    const body = alertMessage;

    // Push — critical priority bypasses quiet hours and preference checks
    await this.notificationsService.sendPush(
      contactId,
      { title, body, data: { type: 'sos_alert', sosAlertId, alertUserId } },
      { priority: 'critical' },
    );

    // Email if preference set
    if (prefs.email !== false && contact.email) {
      await this.notificationsService.sendAuthEmail(
        contact.email,
        contactId,
        title,
        `${userName} has triggered an SOS alert.\n\n${alertMessage}\n\nOpen the TheWileyfox app immediately.`,
      );
    }

    // SMS if preference set
    if (prefs.sms && contact.phone) {
      await this.notificationsService.sendAuthEmail(
        contact.phone,
        contactId,
        title,
        `SOS from ${userName}: ${alertMessage}. Open TheWileyfox now.`,
      );
    }
  }
}
