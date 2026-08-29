import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { shopifyOrders } from './shopify-orders.schema';

export const shopifyOrderItems = pgTable(
  'shopify_order_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => shopifyOrders.id, { onDelete: 'cascade' }),
    shopifyLineItemId: varchar('shopify_line_item_id', { length: 64 }),
    shopifyProductId: varchar('shopify_product_id', { length: 64 }).notNull(),
    shopifyVariantId: varchar('shopify_variant_id', { length: 64 }),
    title: varchar('title', { length: 255 }),
    variantTitle: varchar('variant_title', { length: 255 }),
    sku: varchar('sku', { length: 100 }),
    quantity: integer('quantity').notNull(),
    productType: varchar('product_type', { length: 50 }).notNull(),
    allocatedCount: integer('allocated_count').notNull().default(0),
    status: varchar('status', { length: 20 }).notNull().default('needs_stock'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_shopify_order_items_order_id').on(table.orderId),
    index('idx_shopify_order_items_product_type').on(table.productType),
  ],
);
