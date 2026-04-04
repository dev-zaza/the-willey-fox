import { pgTable, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 100 }).primaryKey().notNull(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
