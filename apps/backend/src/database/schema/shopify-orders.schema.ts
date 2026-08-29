import { pgTable, uuid, varchar, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const shopifyOrders = pgTable(
  'shopify_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopifyOrderId: varchar('shopify_order_id', { length: 64 }).notNull(),
    orderNumber: varchar('order_number', { length: 64 }),
    customerEmail: varchar('customer_email', { length: 255 }),
    customerName: varchar('customer_name', { length: 200 }),
    status: varchar('status', { length: 20 }).notNull().default('needs_stock'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_shopify_orders_shopify_order_id').on(table.shopifyOrderId),
    index('idx_shopify_orders_status').on(table.status),
    index('idx_shopify_orders_created_at').on(table.createdAt),
  ],
);
