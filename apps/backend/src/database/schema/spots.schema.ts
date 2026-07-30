import { pgTable, uuid, text, real, numeric, timestamp } from 'drizzle-orm/pg-core';

export const spots = pgTable('spots', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  locationName: text('location_name').notNull(),
  lat: real('lat').notNull(),
  lng: real('lng').notNull(),
  instagramUrl: text('instagram_url'),
  imageUrl: text('image_url'),
  caption: text('caption'),
  safetyScore: numeric('safety_score', { precision: 5, scale: 2 }),
  safetyBand: text('safety_band'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
