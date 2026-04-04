import { pgTable, uuid, varchar, text, decimal, integer, timestamp } from 'drizzle-orm/pg-core';
import { pinTypeEnum, pinStatusEnum } from './enums';
import { users } from './users.schema';

export const pins = pgTable('pins', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: pinTypeEnum('type').notNull(),
  status: pinStatusEnum('status').default('active').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  lat: decimal('lat', { precision: 10, scale: 7 }).notNull(),
  lng: decimal('lng', { precision: 10, scale: 7 }).notNull(),
  upvotes: integer('upvotes').default(0).notNull(),
  downvotes: integer('downvotes').default(0).notNull(),
  expiresAt: timestamp('expires_at'),
  eventEndTime: timestamp('event_end_time'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
