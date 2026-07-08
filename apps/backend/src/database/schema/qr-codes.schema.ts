import { pgTable, uuid, varchar, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { qrCategoryEnum } from './enums';
import { users } from './users.schema';
import { visualThemes } from './visual-themes.schema';
import { familyGroups } from './family-groups.schema';
import { qrBatches } from './qr-batches.schema';

export const qrCodes = pgTable(
  'qr_codes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' }),
    category: qrCategoryEnum('category').notNull(),
    uniqueCode: varchar('unique_code', { length: 20 }).notNull().unique(),
    name: varchar('name', { length: 200 }).notNull(),
    label: varchar('label', { length: 200 }),
    description: varchar('description', { length: 1000 }),
    photoUrl: varchar('photo_url', { length: 500 }),
    isLost: boolean('is_lost').default(false).notNull(),
    ownerContactEmail: varchar('owner_contact_email', { length: 255 }),
    ownerContactPhone: varchar('owner_contact_phone', { length: 50 }),
    rewardMessage: varchar('reward_message', { length: 500 }),
    visibilityConfig: jsonb('visibility_config')
      .default({
        showName: true,
        showPhoto: true,
        showDescription: true,
        showCustomFields: false,
      })
      .notNull(),
    customFields: jsonb('custom_fields').default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    shopifyOrderId: varchar('shopify_order_id', { length: 100 }),
    batchId: uuid('batch_id').references(() => qrBatches.id, { onDelete: 'set null' }),
    themeId: uuid('theme_id').references(() => visualThemes.id, { onDelete: 'set null' }),
    familyId: uuid('family_id').references(() => familyGroups.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_qr_codes_user_id').on(table.userId),
    index('idx_qr_codes_unique_code').on(table.uniqueCode),
    index('idx_qr_codes_status').on(table.status),
  ],
);
