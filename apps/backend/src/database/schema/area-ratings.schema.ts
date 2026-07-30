import { pgTable, uuid, smallint, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const areaRatings = pgTable('area_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  areaName: text('area_name').notNull(),
  rating: smallint('rating').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
