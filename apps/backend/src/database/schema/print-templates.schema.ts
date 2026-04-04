import { pgTable, uuid, varchar, boolean, smallint, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const printTemplates = pgTable('print_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  formatType: varchar('format_type', { length: 20 }).notNull(), // wristband | square | rectangle
  tierRequired: varchar('tier_required', { length: 20 }).default('free').notNull(),
  backgroundColor: varchar('background_color', { length: 7 }).default('#ffffff').notNull(),
  logoPlacement: varchar('logo_placement', { length: 20 }).default('top-left').notNull(), // top-left | top-right | center | none
  logoSize: smallint('logo_size').default(40).notNull(),
  qrPosition: varchar('qr_position', { length: 20 }).default('center').notNull(), // top | center | bottom
  qrSize: smallint('qr_size').default(120).notNull(),
  textSlots: jsonb('text_slots').default({}).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
