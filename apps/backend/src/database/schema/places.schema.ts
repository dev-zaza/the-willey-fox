import { pgTable, uuid, varchar, decimal, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { placeTypeEnum } from './enums';
import { users } from './users.schema';

export const places = pgTable('places', {
  id: uuid('id').defaultRandom().primaryKey(),
  mapboxPoiId: varchar('mapbox_poi_id', { length: 255 }),
  name: varchar('name', { length: 200 }).notNull(),
  category: placeTypeEnum('category').notNull(),
  address: varchar('address', { length: 500 }),
  lat: decimal('lat', { precision: 10, scale: 7 }).notNull(),
  lng: decimal('lng', { precision: 10, scale: 7 }).notNull(),
  overallRating: decimal('overall_rating', { precision: 3, scale: 2 }),
  reviewCount: integer('review_count').default(0).notNull(),
  isUserCreated: boolean('is_user_created').default(false).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
