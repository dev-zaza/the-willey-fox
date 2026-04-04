import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { reports } from './reports.schema';
import { users } from './users.schema';

export const reportResponses = pgTable(
  'report_responses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => reports.id, { onDelete: 'cascade' }),
    guardianId: uuid('guardian_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: varchar('message', { length: 2000 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_report_responses_report_id').on(table.reportId),
  ],
);
