import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { supportTicketStatusEnum } from './enums';
import { users } from './users.schema';

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    message: text('message').notNull(),
    status: supportTicketStatusEnum('status').default('open').notNull(),
    adminReply: text('admin_reply'),
    repliedAt: timestamp('replied_at', { withTimezone: true }),
    repliedByAdminId: uuid('replied_by_admin_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_support_tickets_user_id').on(table.userId),
    index('idx_support_tickets_status').on(table.status),
    index('idx_support_tickets_created_at').on(table.createdAt),
  ],
);
