import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { routeRatings, routeRatingNotifications } from '../../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RouteRatingsService {
  private readonly logger = new Logger(RouteRatingsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async create(userId: string, dto: CreateRatingDto) {
    const [rating] = await this.db
      .insert(routeRatings)
      .values({
        userId,
        mapboxRouteId: dto.mapboxRouteId ?? null,
        originLat: String(dto.originLat),
        originLng: String(dto.originLng),
        destinationLat: String(dto.destinationLat),
        destinationLng: String(dto.destinationLng),
        overallRating: dto.overallRating,
        tags: dto.tags ?? [],
        comment: dto.comment ?? null,
        travelTimeMinutes: dto.travelTimeMinutes ?? null,
        departedAt: dto.departedAt ? new Date(dto.departedAt) : null,
      })
      .returning();

    // Mark any pending notification for this route as completed
    await this.markNotificationRated(userId);
    void this.usersService.addReputation(userId, 1).catch(() => {});

    return rating;
  }

  async listByUser(userId: string) {
    return this.db
      .select()
      .from(routeRatings)
      .where(eq(routeRatings.userId, userId))
      .orderBy(desc(routeRatings.createdAt));
  }

  /**
   * Schedule a post-trip notification.
   * Called by the directions service when a user selects a route.
   * notifyAt = departureTime + estimatedDurationMinutes + 10 minutes buffer
   */
  async schedulePostTripNotification(
    userId: string,
    routeSnapshot: {
      originLat: number;
      originLng: number;
      destinationLat: number;
      destinationLng: number;
      durationMinutes: number;
    },
    departureTime: Date,
  ) {
    const notifyAt = new Date(
      departureTime.getTime() + (routeSnapshot.durationMinutes + 10) * 60 * 1000,
    );

    await this.db.insert(routeRatingNotifications).values({
      userId,
      routeSnapshot: routeSnapshot as object,
      notifyAt,
    });

    this.logger.debug(`Scheduled post-trip notification for user ${userId} at ${notifyAt.toISOString()}`);
  }

  /**
   * Called by a scheduled job (or cron) to dispatch pending notifications.
   * Finds all notifications past their notifyAt time and sends push.
   */
  async dispatchPendingNotifications() {
    const pending = await this.db
      .select()
      .from(routeRatingNotifications)
      .where(
        // notifyAt <= now AND not yet sent AND no rating submitted
        eq(routeRatingNotifications.sentAt, null as any),
      );

    for (const notification of pending) {
      if (new Date(notification.notifyAt) > new Date()) continue;

      try {
        await this.notificationsService.sendPush(
          notification.userId,
          {
            title: 'How was your route?',
            body: 'Tap to rate your recent journey and help others stay safe.',
            data: { type: 'ROUTE_RATING_REQUEST', notificationId: notification.id },
          },
        );

        await this.db
          .update(routeRatingNotifications)
          .set({ sentAt: new Date() })
          .where(eq(routeRatingNotifications.id, notification.id));
      } catch (err) {
        this.logger.error(`Failed to send route rating notification ${notification.id}: ${(err as Error).message}`);
      }
    }
  }

  private async markNotificationRated(userId: string) {
    // Mark the most recent unsent notification for this user as having a rating submitted
    const [latest] = await this.db
      .select()
      .from(routeRatingNotifications)
      .where(eq(routeRatingNotifications.userId, userId))
      .orderBy(desc(routeRatingNotifications.createdAt))
      .limit(1);

    if (latest && !latest.ratingSubmittedAt) {
      await this.db
        .update(routeRatingNotifications)
        .set({ ratingSubmittedAt: new Date() })
        .where(eq(routeRatingNotifications.id, latest.id));
    }
  }
}
