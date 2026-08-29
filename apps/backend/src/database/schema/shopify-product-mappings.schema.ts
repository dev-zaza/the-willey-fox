import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const shopifyProductMappings = pgTable(
  'shopify_product_mappings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopifyProductId: varchar('shopify_product_id', { length: 64 }).notNull(),
    productType: varchar('product_type', { length: 50 }).notNull(),
    label: varchar('label', { length: 200 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('idx_shopify_product_mappings_product_id').on(table.shopifyProductId)],
);
