import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core';
import { conversationStatusEnum } from './enums';

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: conversationStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
