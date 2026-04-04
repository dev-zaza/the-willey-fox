import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, and, between, isNull, or, gt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { pins, pinVotes, pinFlags } from '../../database/schema';
import { CreatePinDto, UpdatePinDto, ListPinsDto, VotePinDto, FlagPinDto } from './dto';
import { MessagesGateway } from '../messages/messages.gateway';
import { UsersService } from '../users/users.service';

// Pin types that auto-expire after 4 hours
const AUTO_EXPIRE_TYPES = ['hazard', 'roadblock', 'safety_alert', 'traffic'] as const;
const AUTO_EXPIRE_MS = 4 * 60 * 60 * 1000; // 4 hours

// Downvote deactivation threshold: downvotes > upvotes + 5
const DOWNVOTE_THRESHOLD = 5;

export const PIN_EXPIRY_QUEUE = 'pin-expiry';

@Injectable()
export class PinsService {
  private readonly logger = new Logger(PinsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @InjectQueue(PIN_EXPIRY_QUEUE) private readonly expiryQueue: Queue,
    private readonly messagesGateway: MessagesGateway,
    private readonly usersService: UsersService,
  ) {}

  async create(userId: string, dto: CreatePinDto) {
    let expiresAt: Date | null = null;
    let eventEndTime: Date | null = null;

    if ((AUTO_EXPIRE_TYPES as readonly string[]).includes(dto.type)) {
      expiresAt = new Date(Date.now() + AUTO_EXPIRE_MS);
    } else if (dto.type === 'event' && dto.eventEndTime) {
      eventEndTime = new Date(dto.eventEndTime);
      expiresAt = eventEndTime;
    }
    // construction: no expiry

    const [pin] = await this.db
      .insert(pins)
      .values({
        userId,
        type: dto.type,
        status: 'active',
        title: dto.title,
        description: dto.description ?? null,
        lat: String(dto.lat),
        lng: String(dto.lng),
        expiresAt,
        eventEndTime,
      })
      .returning();

    // Schedule expiry job if applicable
    if (expiresAt) {
      const delay = expiresAt.getTime() - Date.now();
      await this.expiryQueue.add(
        'expire-pin',
        { pinId: pin.id },
        { delay, jobId: `pin-expire-${pin.id}` },
      );
    }

    // Broadcast to all connected clients in the pins room
    this.messagesGateway.server.emit('pin:created', pin);

    return pin;
  }

  async list(dto: ListPinsDto) {
    return this.db
      .select()
      .from(pins)
      .where(
        and(
          eq(pins.status, 'active'),
          or(
            isNull(pins.expiresAt),
            gt(pins.expiresAt, new Date()),
          ),
          between(pins.lat, String(dto.minLat), String(dto.maxLat)),
          between(pins.lng, String(dto.minLng), String(dto.maxLng)),
        ),
      );
  }

  async findOne(id: string) {
    const [pin] = await this.db
      .select()
      .from(pins)
      .where(eq(pins.id, id))
      .limit(1);

    if (!pin) throw new NotFoundException('PIN_NOT_FOUND');
    return pin;
  }

  async update(userId: string, id: string, dto: UpdatePinDto) {
    const pin = await this.findOne(id);

    if (pin.userId !== userId) {
      throw new ForbiddenException('PIN_ACCESS_DENIED');
    }

    const [updated] = await this.db
      .update(pins)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(pins.id, id))
      .returning();

    this.messagesGateway.server.emit('pin:updated', updated);

    return updated;
  }

  async deactivate(userId: string, id: string) {
    const pin = await this.findOne(id);

    if (pin.userId !== userId) {
      throw new ForbiddenException('PIN_ACCESS_DENIED');
    }

    const [updated] = await this.db
      .update(pins)
      .set({ status: 'deactivated', updatedAt: new Date() })
      .where(eq(pins.id, id))
      .returning();

    // Remove scheduled expiry job if any
    const job = await this.expiryQueue.getJob(`pin-expire-${id}`);
    if (job) await job.remove();

    this.messagesGateway.server.emit('pin:deactivated', { id });

    return updated;
  }

  async vote(userId: string, pinId: string, dto: VotePinDto) {
    const pin = await this.findOne(pinId);
    // Capture pre-vote net score for bonus threshold check
    const prevNet = pin.upvotes - pin.downvotes;

    if (pin.status !== 'active') {
      throw new ForbiddenException('Cannot vote on an inactive pin');
    }

    const [existingVote] = await this.db
      .select()
      .from(pinVotes)
      .where(and(eq(pinVotes.pinId, pinId), eq(pinVotes.userId, userId)))
      .limit(1);

    if (existingVote) {
      if (existingVote.isUpvote === dto.isUpvote) {
        throw new ConflictException({
          code: 'PIN_ALREADY_VOTED',
          message: 'You have already voted on this pin.',
        });
      }

      // Change vote: update and adjust counters
      await this.db
        .update(pinVotes)
        .set({ isUpvote: dto.isUpvote, updatedAt: new Date() })
        .where(eq(pinVotes.id, existingVote.id));

      if (dto.isUpvote) {
        await this.db
          .update(pins)
          .set({
            upvotes: sql`${pins.upvotes} + 1`,
            downvotes: sql`${pins.downvotes} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(pins.id, pinId));
      } else {
        await this.db
          .update(pins)
          .set({
            upvotes: sql`${pins.upvotes} - 1`,
            downvotes: sql`${pins.downvotes} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(pins.id, pinId));
      }
    } else {
      // New vote
      await this.db.insert(pinVotes).values({
        pinId,
        userId,
        isUpvote: dto.isUpvote,
      });

      if (dto.isUpvote) {
        await this.db
          .update(pins)
          .set({ upvotes: sql`${pins.upvotes} + 1`, updatedAt: new Date() })
          .where(eq(pins.id, pinId));
      } else {
        await this.db
          .update(pins)
          .set({ downvotes: sql`${pins.downvotes} + 1`, updatedAt: new Date() })
          .where(eq(pins.id, pinId));
      }
    }

    // Re-fetch to get updated counts and check deactivation threshold
    const [updatedPin] = await this.db
      .select()
      .from(pins)
      .where(eq(pins.id, pinId))
      .limit(1);

    if (updatedPin && updatedPin.downvotes > updatedPin.upvotes + DOWNVOTE_THRESHOLD) {
      this.logger.log(`Pin ${pinId} auto-deactivated by downvote threshold`);
      await this.db
        .update(pins)
        .set({ status: 'deactivated', updatedAt: new Date() })
        .where(eq(pins.id, pinId));
      this.messagesGateway.server.emit('pin:deactivated', { id: pinId });
    }

    // Reputation: +1 for upvote on pin creator, -1 for downvote. Fire-and-forget.
    if (pin.userId) {
      const repDelta = dto.isUpvote ? 1 : -1;
      void this.usersService.addReputation(pin.userId, repDelta).catch(() => {});

      // Bonus +5 when net votes cross 10 threshold
      if (updatedPin) {
        const newNet = updatedPin.upvotes - updatedPin.downvotes;
        if (prevNet < 10 && newNet >= 10) {
          void this.usersService.addReputation(pin.userId, 5).catch(() => {});
        }
      }
    }

    return { message: 'Vote recorded.' };
  }

  async flagPin(userId: string, pinId: string, dto: FlagPinDto) {
    await this.findOne(pinId); // Ensure pin exists

    const [existing] = await this.db
      .select({ id: pinFlags.id })
      .from(pinFlags)
      .where(and(eq(pinFlags.pinId, pinId), eq(pinFlags.userId, userId)))
      .limit(1);

    if (existing) {
      throw new ConflictException('PIN_ALREADY_FLAGGED');
    }

    const [flag] = await this.db
      .insert(pinFlags)
      .values({ pinId, userId, reason: dto.reason })
      .returning();

    this.logger.log(`Pin ${pinId} flagged by user ${userId}`);
    return flag;
  }

  /**
   * Called by BullMQ expiry processor to expire a pin
   */
  async expirePin(pinId: string) {
    await this.db
      .update(pins)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(eq(pins.id, pinId), eq(pins.status, 'active')));

    this.messagesGateway.server.emit('pin:deactivated', { id: pinId });
    this.logger.debug(`Pin ${pinId} expired`);
  }
}
