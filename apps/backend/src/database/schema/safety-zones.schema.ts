import { pgTable, uuid, varchar, decimal, integer, jsonb, date, timestamp } from 'drizzle-orm/pg-core';
import { safetySourceEnum, safetyGranularityEnum } from './enums';

export const safetyZones = pgTable('safety_zones', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: safetySourceEnum('source').notNull(),
  sourceRegion: varchar('source_region', { length: 100 }).notNull(),
  sourceGranularity: safetyGranularityEnum('source_granularity').notNull(),

  // Geography — point + radius OR bounding box
  centerLat: decimal('center_lat', { precision: 10, scale: 7 }),
  centerLng: decimal('center_lng', { precision: 10, scale: 7 }),
  radiusMetres: integer('radius_metres'),
  bboxMinLat: decimal('bbox_min_lat', { precision: 10, scale: 7 }),
  bboxMinLng: decimal('bbox_min_lng', { precision: 10, scale: 7 }),
  bboxMaxLat: decimal('bbox_max_lat', { precision: 10, scale: 7 }),
  bboxMaxLng: decimal('bbox_max_lng', { precision: 10, scale: 7 }),

  safetyScore: decimal('safety_score', { precision: 5, scale: 2 }).notNull(),
  crimeData: jsonb('crime_data').default({}).notNull(),

  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
