import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, between, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { places, placeReviews, reviewFlags } from '../../database/schema';
import { SearchPlacesDto, CreatePlaceDto, CreateReviewDto, FlagReviewDto } from './dto';
import { UsersService } from '../users/users.service';

const FLAG_HIDE_THRESHOLD = 3;

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly usersService: UsersService,
  ) {}

  async search(dto: SearchPlacesDto) {
    const baseCondition = and(
      between(places.lat, String(dto.minLat), String(dto.maxLat)),
      between(places.lng, String(dto.minLng), String(dto.maxLng)),
    );

    const condition = dto.category
      ? and(baseCondition, eq(places.category, dto.category as typeof places.category._.data))
      : baseCondition;

    return this.db
      .select()
      .from(places)
      .where(condition)
      .orderBy(sql`${places.overallRating} DESC NULLS LAST`)
      .limit(50);
  }

  async findOne(id: string) {
    const [place] = await this.db
      .select()
      .from(places)
      .where(eq(places.id, id))
      .limit(1);

    if (!place) throw new NotFoundException('PLACE_NOT_FOUND');

    const reviews = await this.db
      .select()
      .from(placeReviews)
      .where(and(eq(placeReviews.placeId, id), eq(placeReviews.isHidden, false)))
      .orderBy(sql`${placeReviews.createdAt} DESC`)
      .limit(20);

    return { ...place, reviews };
  }

  async create(userId: string, dto: CreatePlaceDto) {
    const [place] = await this.db
      .insert(places)
      .values({
        name: dto.name,
        category: dto.category as typeof places.category._.data,
        lat: String(dto.lat),
        lng: String(dto.lng),
        address: dto.address ?? null,
        mapboxPoiId: dto.mapboxPoiId ?? null,
        isUserCreated: true,
        createdBy: userId,
      })
      .returning();

    return place;
  }

  async createReview(placeId: string, userId: string, dto: CreateReviewDto) {
    const [place] = await this.db
      .select()
      .from(places)
      .where(eq(places.id, placeId))
      .limit(1);

    if (!place) throw new NotFoundException('PLACE_NOT_FOUND');

    const [existing] = await this.db
      .select()
      .from(placeReviews)
      .where(and(eq(placeReviews.placeId, placeId), eq(placeReviews.userId, userId)))
      .limit(1);

    if (existing) throw new ConflictException('REVIEW_ALREADY_EXISTS');

    const [review] = await this.db
      .insert(placeReviews)
      .values({
        placeId,
        userId,
        overallRating: dto.overallRating,
        safetyRating: dto.safetyRating ?? null,
        cleanlinessRating: dto.cleanlinessRating ?? null,
        valueRating: dto.valueRating ?? null,
        serviceRating: dto.serviceRating ?? null,
        comment: dto.comment ?? null,
      })
      .returning();

    await this.recalculateRating(placeId);
    void this.usersService.addReputation(userId, 1).catch(() => {});

    return review;
  }

  async updateReview(placeId: string, reviewId: string, userId: string, dto: CreateReviewDto) {
    const [review] = await this.db
      .select()
      .from(placeReviews)
      .where(and(eq(placeReviews.id, reviewId), eq(placeReviews.placeId, placeId)))
      .limit(1);

    if (!review) throw new NotFoundException('REVIEW_NOT_FOUND');
    if (review.userId !== userId) throw new ForbiddenException('REVIEW_ACCESS_DENIED');

    const [updated] = await this.db
      .update(placeReviews)
      .set({
        overallRating: dto.overallRating,
        safetyRating: dto.safetyRating ?? null,
        cleanlinessRating: dto.cleanlinessRating ?? null,
        valueRating: dto.valueRating ?? null,
        serviceRating: dto.serviceRating ?? null,
        comment: dto.comment ?? null,
        updatedAt: new Date(),
      })
      .where(eq(placeReviews.id, reviewId))
      .returning();

    await this.recalculateRating(placeId);

    return updated;
  }

  async deleteReview(placeId: string, reviewId: string, userId: string) {
    const [review] = await this.db
      .select()
      .from(placeReviews)
      .where(and(eq(placeReviews.id, reviewId), eq(placeReviews.placeId, placeId)))
      .limit(1);

    if (!review) throw new NotFoundException('REVIEW_NOT_FOUND');
    if (review.userId !== userId) throw new ForbiddenException('REVIEW_ACCESS_DENIED');

    await this.db.delete(placeReviews).where(eq(placeReviews.id, reviewId));
    await this.recalculateRating(placeId);

    return { message: 'Review deleted.' };
  }

  async flagReview(reviewId: string, userId: string, dto: FlagReviewDto) {
    const [review] = await this.db
      .select()
      .from(placeReviews)
      .where(eq(placeReviews.id, reviewId))
      .limit(1);

    if (!review) throw new NotFoundException('REVIEW_NOT_FOUND');

    const [existingFlag] = await this.db
      .select()
      .from(reviewFlags)
      .where(and(eq(reviewFlags.reviewId, reviewId), eq(reviewFlags.userId, userId)))
      .limit(1);

    if (existingFlag) throw new ConflictException('REVIEW_ALREADY_FLAGGED');

    await this.db.insert(reviewFlags).values({
      reviewId,
      userId,
      reason: dto.reason,
    });

    const [updated] = await this.db
      .update(placeReviews)
      .set({ flagCount: sql`${placeReviews.flagCount} + 1`, updatedAt: new Date() })
      .where(eq(placeReviews.id, reviewId))
      .returning();

    if (updated && updated.flagCount >= FLAG_HIDE_THRESHOLD) {
      this.logger.log(`Review ${reviewId} auto-hidden after ${updated.flagCount} flags`);
      await this.db
        .update(placeReviews)
        .set({ isHidden: true, updatedAt: new Date() })
        .where(eq(placeReviews.id, reviewId));

      await this.recalculateRating(review.placeId);
    }

    return { message: 'Review flagged.' };
  }

  private async recalculateRating(placeId: string) {
    const visibleReviews = await this.db
      .select({ overallRating: placeReviews.overallRating })
      .from(placeReviews)
      .where(and(eq(placeReviews.placeId, placeId), eq(placeReviews.isHidden, false)));

    const count = visibleReviews.length;
    const avg =
      count > 0
        ? visibleReviews.reduce((sum, r) => sum + r.overallRating, 0) / count
        : null;

    await this.db
      .update(places)
      .set({
        reviewCount: count,
        overallRating: avg !== null ? String(avg.toFixed(2)) : null,
        updatedAt: new Date(),
      })
      .where(eq(places.id, placeId));
  }
}
