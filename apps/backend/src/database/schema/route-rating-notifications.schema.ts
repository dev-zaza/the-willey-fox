import { pgTable, uuid, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const routeRatingNotifications = pgTable('route_rating_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  routeSnapshot: jsonb('route_snapshot').notNull(),
  notifyAt: timestamp('notify_at').notNull(),
  sentAt: timestamp('sent_at'),
  ratingSubmittedAt: timestamp('rating_submitted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
