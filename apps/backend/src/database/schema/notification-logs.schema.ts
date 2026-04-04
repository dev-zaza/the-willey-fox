import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { notificationTypeEnum, notificationStatusEnum } from './enums';
import { users } from './users.schema';

export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: notificationTypeEnum('type').notNull(),
    recipientId: uuid('recipient_id').references(() => users.id),
    recipientContact: varchar('recipient_contact', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 500 }),
    body: text('body').notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    status: notificationStatusEnum('status').default('pending').notNull(),
    errorMessage: varchar('error_message', { length: 1000 }),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_notification_logs_recipient_id').on(table.recipientId),
    index('idx_notification_logs_status').on(table.status),
  ],
);
