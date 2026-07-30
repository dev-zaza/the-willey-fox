import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { spots } from '../../database/schema';
import { sql, eq } from 'drizzle-orm';

@Injectable()
export class SpotsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findNearby(lat: number, lng: number, radiusMetres: number) {
    const delta = radiusMetres / 111000;
    const rows = await this.db
      .select()
      .from(spots)
      .where(
        sql`${spots.lat} BETWEEN ${lat - delta} AND ${lat + delta}
          AND ${spots.lng} BETWEEN ${lng - delta} AND ${lng + delta}`,
      )
      .limit(50);
    return rows;
  }

  async create(input: {
    locationName: string;
    lat: number;
    lng: number;
    instagramUrl?: string;
    imageUrl?: string;
    caption?: string;
    userId: string | null;
  }) {
    if (!input.locationName?.trim()) throw new BadRequestException('locationName required');
    if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
      throw new BadRequestException('valid lat/lng required');
    }
    const [row] = await this.db
      .insert(spots)
      .values({
        locationName: input.locationName.trim(),
        lat: input.lat,
        lng: input.lng,
        instagramUrl: input.instagramUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        caption: input.caption ?? null,
        userId: input.userId as any,
      })
      .returning();
    return row;
  }

  async remove(id: string, userId: string | null) {
    const [row] = await this.db.select().from(spots).where(eq(spots.id, id));
    if (!row) throw new NotFoundException('Spot not found');
    if (row.userId && userId && row.userId !== userId) throw new ForbiddenException();
    await this.db.delete(spots).where(eq(spots.id, id));
    return { deleted: true };
  }
}
