import { pgTable, uuid, integer, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

export const qrBatches = pgTable('qr_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdByAdminId: uuid('created_by_admin_id').references(() => users.id, { onDelete: 'set null' }),
  count: integer('count').notNull(),
  shopifyOrderId: varchar('shopify_order_id', { length: 100 }),
  notes: varchar('notes', { length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
