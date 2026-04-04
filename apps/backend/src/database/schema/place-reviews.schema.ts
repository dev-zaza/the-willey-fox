import { pgTable, uuid, smallint, varchar, integer, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { places } from './places.schema';

export const placeReviews = pgTable('place_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id').notNull().references(() => places.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  overallRating: smallint('overall_rating').notNull(),
  safetyRating: smallint('safety_rating'),
  cleanlinessRating: smallint('cleanliness_rating'),
  valueRating: smallint('value_rating'),
  serviceRating: smallint('service_rating'),
  comment: varchar('comment', { length: 500 }),
  flagCount: integer('flag_count').default(0).notNull(),
  isHidden: boolean('is_hidden').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  uqPlaceUser: unique('uq_place_review_user').on(t.placeId, t.userId),
}));
