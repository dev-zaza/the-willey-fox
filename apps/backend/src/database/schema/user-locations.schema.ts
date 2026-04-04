import { pgTable, uuid, decimal, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const userLocations = pgTable('user_locations', {
  userId: uuid('user_id').primaryKey().notNull().references(() => users.id, { onDelete: 'cascade' }),
  lat: decimal('lat', { precision: 10, scale: 7 }).notNull(),
  lng: decimal('lng', { precision: 10, scale: 7 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
