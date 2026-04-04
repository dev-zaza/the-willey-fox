import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { pins } from './pins.schema';
import { users } from './users.schema';

export const pinFlags = pgTable('pin_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  pinId: uuid('pin_id').notNull().references(() => pins.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: varchar('reason', { length: 500 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uqPinFlag: unique('uq_pin_flag').on(t.pinId, t.userId),
}));
