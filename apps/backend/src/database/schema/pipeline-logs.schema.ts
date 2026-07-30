import {
  pgTable, uuid, text, integer, timestamp,
} from 'drizzle-orm/pg-core';

export const pipelineLogs = pgTable('pipeline_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: text('source').notNull(),
  recordsFetched: integer('records_fetched').default(0).notNull(),
  recordsInserted: integer('records_inserted').default(0).notNull(),
  errors: text('errors'),
  ranAt: timestamp('ran_at').defaultNow().notNull(),
});
