import { pgTable, uuid, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { pins } from './pins.schema';

export const pinVotes = pgTable('pin_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  pinId: uuid('pin_id').notNull().references(() => pins.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  isUpvote: boolean('is_upvote').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  uqPinUser: unique('uq_pin_vote_user').on(t.pinId, t.userId),
}));
