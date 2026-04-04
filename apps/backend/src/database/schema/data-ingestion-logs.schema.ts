import { pgTable, uuid, varchar, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { ingestionStatusEnum } from './enums';

export const dataIngestionLogs = pgTable('data_ingestion_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: varchar('source', { length: 30 }).notNull(),
  status: ingestionStatusEnum('status').notNull(),
  zonesCreated: integer('zones_created').default(0).notNull(),
  zonesUpdated: integer('zones_updated').default(0).notNull(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
