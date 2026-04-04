import { pgTable, uuid, decimal, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const sosAlerts = pgTable('sos_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lat: decimal('lat', { precision: 10, scale: 7 }),
  lng: decimal('lng', { precision: 10, scale: 7 }),
  locationAddress: varchar('location_address', { length: 500 }),
  message: varchar('message', { length: 500 }),
  isAcknowledged: boolean('is_acknowledged').default(false).notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
