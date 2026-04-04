import { pgTable, uuid, varchar, decimal, smallint, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const routeRatings = pgTable('route_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mapboxRouteId: varchar('mapbox_route_id', { length: 255 }),
  originLat: decimal('origin_lat', { precision: 10, scale: 7 }).notNull(),
  originLng: decimal('origin_lng', { precision: 10, scale: 7 }).notNull(),
  destinationLat: decimal('destination_lat', { precision: 10, scale: 7 }).notNull(),
  destinationLng: decimal('destination_lng', { precision: 10, scale: 7 }).notNull(),
  overallRating: smallint('overall_rating').notNull(),
  tags: varchar('tags', { length: 50 }).array().default([]).notNull(),
  comment: varchar('comment', { length: 200 }),
  travelTimeMinutes: integer('travel_time_minutes'),
  departedAt: timestamp('departed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
